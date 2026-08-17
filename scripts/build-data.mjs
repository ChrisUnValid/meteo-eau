#!/usr/bin/env node
// Pipeline de données réelles — Hub'Eau → static/data/real.json
//
// Pour chaque département métropolitain :
//   débit  : stations hydrométriques les plus anciennes → QmM (débits moyens mensuels),
//            moyenne juin-août par année, exprimée en % d'écart à la référence 1975-2005
//            de la station, médiane entre stations.
//   nappe  : piézomètres aux chroniques les plus longues → moyenne annuelle du niveau,
//            percentile dans l'historique de la station (type IPS), moyenne entre stations,
//            exprimé en écart au médian (percentile − 50, borné ±50).
//
// Usage : node scripts/build-data.mjs [--depts 30,34] [--out static/data/real.json]
// Le cache par département (scripts/.cache/) permet de reprendre un run interrompu.

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';

const HYDRO = 'https://hubeau.eaufrance.fr/api/v2/hydrometrie';
const PIEZO = 'https://hubeau.eaufrance.fr/api/v1/niveaux_nappes';
const CACHE_DIR = new URL('./.cache/', import.meta.url).pathname;
const OUT = process.argv.includes('--out')
	? process.argv[process.argv.indexOf('--out') + 1]
	: 'static/data/real.json';

const DEPTS = process.argv.includes('--depts')
	? process.argv[process.argv.indexOf('--depts') + 1].split(',')
	: [
			...Array.from({ length: 19 }, (_, i) => String(i + 1).padStart(2, '0')),
			'2A', '2B',
			...Array.from({ length: 75 }, (_, i) => String(i + 21)).filter((d) => d !== '96')
		];

const Y_MIN = 1975;
const REF_MIN = 1975, REF_MAX = 2005;

/* ---------- utilitaires ---------- */
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function getJSON(url, tries = 3) {
	for (let i = 0; i < tries; i++) {
		try {
			const ctrl = new AbortController();
			const to = setTimeout(() => ctrl.abort(), 25000);
			const r = await fetch(url, { signal: ctrl.signal });
			clearTimeout(to);
			if (r.status === 404) return null; // pas de données
			if (!r.ok) throw new Error(`HTTP ${r.status}`);
			return await r.json();
		} catch (e) {
			if (i === tries - 1) throw e;
			await sleep(1200 * (i + 1));
		}
	}
}

const median = (a) => {
	const s = [...a].sort((x, y) => x - y);
	const m = s.length >> 1;
	return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};
const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;

/* ---------- débits d'été (hydrométrie, QmM) ---------- */
async function fetchDebit(dept) {
	const st = await getJSON(
		`${HYDRO}/referentiel/stations?code_departement=${dept}&format=json&size=1000&fields=code_station,date_ouverture_station,en_service`
	);
	const all = (st?.data || []).filter((s) => s.date_ouverture_station);
	all.sort((a, b) => a.date_ouverture_station.localeCompare(b.date_ouverture_station));
	// Les longues chroniques sont portées par le SITE (8 premiers caractères du code
	// station), héritage Banque Hydro. On travaille par site, dédupliqué :
	// les 4 sites les plus anciens + les 2 plus anciens encore en service.
	const open = all.filter((s) => s.en_service);
	const sites = [...new Set([...all.slice(0, 6), ...open.slice(0, 3)].map((s) => s.code_station.slice(0, 8)))].slice(0, 6);

	const perStation = [];
	for (const site of sites) {
		if (perStation.length >= 4) break;
		let obs = await getJSON(
			`${HYDRO}/obs_elab?code_entite=${site}&grandeur_hydro_elab=QmM&size=20000&fields=date_obs_elab,resultat_obs_elab`
		);
		let rows = obs?.data || [];
		if (rows.length < 120) {
			// repli : certains historiques restent au code station complet
			const full = all.find((s) => s.code_station.startsWith(site));
			obs = full
				? await getJSON(
						`${HYDRO}/obs_elab?code_entite=${full.code_station}&grandeur_hydro_elab=QmM&size=20000&fields=date_obs_elab,resultat_obs_elab`
					)
				: null;
			rows = obs?.data || [];
		}
		if (rows.length < 120) continue; // moins de 10 ans de mensuels : ignorer
		const summers = {}; // year -> [QmM juin, juillet, août]
		for (const o of rows) {
			if (o.resultat_obs_elab == null || o.resultat_obs_elab < 0) continue;
			const y = +o.date_obs_elab.slice(0, 4);
			const m = +o.date_obs_elab.slice(5, 7);
			if (y < Y_MIN || m < 6 || m > 8) continue;
			(summers[y] ||= []).push(o.resultat_obs_elab);
		}
		const annual = {};
		for (const [y, v] of Object.entries(summers)) if (v.length >= 2) annual[y] = mean(v);
		const years = Object.keys(annual).map(Number);
		if (years.length < 15) continue;
		const refYears = years.filter((y) => y >= REF_MIN && y <= REF_MAX);
		const baseYears = refYears.length >= 8 ? refYears : years.slice(0, 15);
		const base = mean(baseYears.map((y) => annual[y]));
		if (!(base > 0)) continue;
		const pct = {};
		for (const y of years) pct[y] = Math.max(-85, Math.min(150, ((annual[y] / base) - 1) * 100));
		perStation.push(pct);
	}
	return aggregate(perStation, median);
}

/* ---------- nappes (piézométrie, percentile annuel type IPS) ---------- */
async function fetchNappe(dept) {
	const st = await getJSON(
		`${PIEZO}/stations?code_departement=${dept}&format=json&size=2000&fields=code_bss,date_debut_mesure,nb_mesures_piezo`
	);
	const all = (st?.data || []).filter((s) => s.date_debut_mesure && (s.nb_mesures_piezo || 0) >= 2000);
	all.sort((a, b) => a.date_debut_mesure.localeCompare(b.date_debut_mesure));
	const picked = all.slice(0, 3);

	const perStation = [];
	for (const s of picked) {
		const byYear = {};
		let url = `${PIEZO}/chroniques?code_bss=${encodeURIComponent(s.code_bss)}&size=20000&fields=date_mesure,niveau_nappe_eau`;
		for (let page = 0; page < 3 && url; page++) {
			const obs = await getJSON(url);
			for (const o of obs?.data || []) {
				if (o.niveau_nappe_eau == null) continue;
				const y = +o.date_mesure.slice(0, 4);
				if (y < Y_MIN) continue;
				(byYear[y] ||= []).push(o.niveau_nappe_eau);
			}
			url = obs?.next || null;
		}
		const annual = {};
		for (const [y, v] of Object.entries(byYear)) if (v.length >= 4) annual[y] = mean(v);
		const years = Object.keys(annual).map(Number);
		if (years.length < 15) continue;
		const sorted = years.map((y) => annual[y]).sort((a, b) => a - b);
		const pct = {};
		for (const y of years) {
			const rank = sorted.filter((v) => v <= annual[y]).length / sorted.length; // percentile 0..1
			pct[y] = Math.round((rank - 0.5) * 100); // écart au médian, ±50
		}
		perStation.push(pct);
	}
	return aggregate(perStation, mean);
}

/* fusionne les séries par station en une série départementale */
function aggregate(perStation, combine) {
	if (!perStation.length) return { series: null, n: 0 };
	const years = new Set();
	perStation.forEach((p) => Object.keys(p).forEach((y) => years.add(+y)));
	const series = {};
	for (const y of [...years].sort()) {
		const vals = perStation.map((p) => p[y]).filter((v) => v != null);
		if (vals.length) series[y] = Math.round(combine(vals) * 10) / 10;
	}
	return { series, n: perStation.length };
}

/* ---------- orchestration ---------- */
async function buildDept(dept) {
	const cache = `${CACHE_DIR}${dept}.json`;
	if (existsSync(cache)) return JSON.parse(await readFile(cache, 'utf8'));
	const [debit, nappe] = [await fetchDebit(dept), await fetchNappe(dept)];
	const years = [
		...Object.keys(debit.series || {}).map(Number),
		...Object.keys(nappe.series || {}).map(Number)
	];
	const lastYear = years.length ? Math.max(...years) : null;
	const lastN = (s) => {
		if (!s) return null;
		const ys = Object.keys(s).map(Number).sort((a, b) => b - a).slice(0, 5);
		return ys.length ? Math.round(mean(ys.map((y) => s[y])) * 10) / 10 : null;
	};
	const out = {
		debit: debit.series,
		nappe: nappe.series,
		lastYear,
		baseline: { debit: lastN(debit.series), nappe: lastN(nappe.series) },
		stations: { debit: debit.n, nappe: nappe.n }
	};
	await writeFile(cache, JSON.stringify(out));
	return out;
}

await mkdir(CACHE_DIR, { recursive: true });
const result = {};
let done = 0;
const queue = [...DEPTS];
const workers = Array.from({ length: 5 }, async () => {
	while (queue.length) {
		const dept = queue.shift();
		try {
			const d = await buildDept(dept);
			result[dept] = d;
			done++;
			console.log(
				`[${done}/${DEPTS.length}] ${dept} — débit: ${d.stations.debit} st. (${Object.keys(d.debit || {}).length} ans) · nappe: ${d.stations.nappe} st. (${Object.keys(d.nappe || {}).length} ans)`
			);
		} catch (e) {
			done++;
			console.error(`[${done}/${DEPTS.length}] ${dept} — ÉCHEC: ${e.message}`);
		}
	}
});
await Promise.all(workers);

// stats de couverture
const covered = Object.values(result).filter((d) => d.debit || d.nappe).length;
const both = Object.values(result).filter((d) => d.debit && d.nappe).length;
console.log(`\nCouverture : ${covered}/${DEPTS.length} départements (dont ${both} avec débit ET nappe)`);

await writeFile(OUT, JSON.stringify({ generated: new Date().toISOString().slice(0, 10), depts: result }));
console.log(`Écrit : ${OUT} (${(JSON.stringify(result).length / 1024).toFixed(0)} Ko)`);
