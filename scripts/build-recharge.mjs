#!/usr/bin/env node
// Projections de recharge des nappes → static/data/real.json (clé `recharge`)
//
// Source : « Données de recharge potentielle des aquifères par MESO en France hexagonale
// - modèle RECHARGE » (doi:10.57745/F9QE5D, Explore2, licence Etalab). Anomalie relative
// de recharge potentielle par masse d'eau souterraine (MESO), RCP 8.5, médiane des
// 17 modèles climatiques (`ANMed17Re`) et enveloppe Q5-Q95, aux périodes
// 2021-2050 / 2041-2070 / 2071-2100, référence 1976-2005.
//
// Saison retenue : JJA (été) — cohérent avec le reste du bulletin, qui est un bulletin
// d'été (QMNA d'été, jours de restriction de juin-août). La recharge d'hiver (DJF) est
// aussi extraite : le contraste hiver/été EST le message d'Explore2 (« hivers plus
// humides, étés plus secs ») et l'anomalie annuelle, positive, le masquerait.
//
// Rattachement MESO → département : via les piézomètres Hub'Eau du département, qui
// déclarent leur masse d'eau (`codes_masse_eau_edl`). Les aquifères projetés sont donc
// exactement ceux qu'on mesure par ailleurs.
//
// Usage : node scripts/build-recharge.mjs <dir-des-dbf> [real.json]

import { readFile, writeFile } from 'node:fs/promises';

const DIR = process.argv[2];
const REAL = process.argv[3] || 'static/data/real.json';
if (!DIR) {
	console.error('usage: node scripts/build-recharge.mjs <dir-des-dbf> [real.json]');
	process.exit(1);
}

// identifiants Recherche Data Gouv des .dbf (saison → horizon → id)
const FILES = {
	JJA: { H1: '349342', H2: '349369', H3: '349375' },
	DJF: { H1: '349349', H2: '349362', H3: '349380' }
};

/* ---------- lecture dBASE (format simple, pas de dépendance) ---------- */
function readDBF(buf) {
	const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
	const nrec = dv.getUint32(4, true);
	const hlen = dv.getUint16(8, true);
	const rlen = dv.getUint16(10, true);
	const fields = [];
	let off = 32;
	while (buf[off] !== 0x0d) {
		const name = new TextDecoder('latin1').decode(buf.subarray(off, off + 11)).replace(/\0.*$/, '');
		fields.push({ name, len: buf[off + 16] });
		off += 32;
	}
	const dec = new TextDecoder('latin1');
	const rows = [];
	for (let i = 0; i < nrec; i++) {
		let o = hlen + i * rlen + 1; // 1er octet = marqueur de suppression
		const r = {};
		for (const f of fields) {
			r[f.name] = dec.decode(buf.subarray(o, o + f.len)).trim();
			o += f.len;
		}
		rows.push(r);
	}
	return rows;
}

const num = (v) => (v === '' || v === 'NA' ? null : parseFloat(v));
const median = (a) => {
	if (!a.length) return null;
	const s = [...a].sort((x, y) => x - y);
	const m = s.length >> 1;
	return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

/* ---------- lecture des projections par MESO ---------- */
console.log('Lecture des projections de recharge…');
const byMeso = {}; // saison -> horizon -> code MESO -> {med,q5,q95}
for (const [season, horizons] of Object.entries(FILES)) {
	byMeso[season] = {};
	for (const [h, id] of Object.entries(horizons)) {
		const rows = readDBF(await readFile(`${DIR}/${id}.dbf`));
		const store = (byMeso[season][h] = {});
		for (const r of rows) {
			const med = num(r.ANMed17Re);
			if (med == null) continue;
			store[r.CdEuMasseD] = {
				med: med * 100,
				q5: num(r.ANQ517Re) * 100,
				q95: num(r.ANQ9517Re) * 100
			};
		}
		console.log(`  ${season} ${h}: ${Object.keys(store).length} masses d'eau`);
	}
}

/* ---------- rattachement MESO → département (piézomètres Hub'Eau) ---------- */
const real = JSON.parse(await readFile(REAL, 'utf8'));
const depts = Object.keys(real.depts);
console.log(`Rattachement des masses d'eau à ${depts.length} départements…`);

async function mesoOf(dept) {
	const url = `https://hubeau.eaufrance.fr/api/v1/niveaux_nappes/stations?code_departement=${dept}&size=2000&format=json&fields=codes_masse_eau_edl,nb_mesures_piezo`;
	for (let i = 0; i < 3; i++) {
		try {
			const ctrl = new AbortController();
			const to = setTimeout(() => ctrl.abort(), 25000);
			const r = await fetch(url, { signal: ctrl.signal });
			clearTimeout(to);
			if (!r.ok) throw new Error('HTTP ' + r.status);
			const j = await r.json();
			const counts = new Map(); // code MESO -> nb de piézomètres
			for (const s of j.data || []) {
				for (const c of s.codes_masse_eau_edl || []) {
					counts.set(c, (counts.get(c) || 0) + 1);
				}
			}
			return counts;
		} catch (e) {
			if (i === 2) return new Map();
			await new Promise((res) => setTimeout(res, 1500 * (i + 1)));
		}
	}
	return new Map();
}

let merged = 0;
const queue = [...depts];
const workers = Array.from({ length: 5 }, async () => {
	while (queue.length) {
		const dept = queue.shift();
		const counts = await mesoOf(dept);
		if (!counts.size) continue;
		// les codes Hub'Eau sont sans le préfixe pays : FG005B → FRFG005B
		const out = {};
		let ok = true;
		for (const season of Object.keys(FILES)) {
			out[season] = {};
			for (const h of ['H1', 'H2', 'H3']) {
				const table = byMeso[season][h];
				const meds = [], q5s = [], q95s = [];
				for (const [code, n] of counts) {
					const v = table['FR' + code] || table[code];
					if (!v) continue;
					// pondération par le nombre de piézomètres suivis dans cette masse d'eau
					for (let k = 0; k < Math.min(n, 12); k++) {
						meds.push(v.med); q5s.push(v.q5); q95s.push(v.q95);
					}
				}
				if (!meds.length) { ok = false; break; }
				out[season][h] = {
					med: Math.round(median(meds) * 10) / 10,
					q5: Math.round(median(q5s) * 10) / 10,
					q95: Math.round(median(q95s) * 10) / 10
				};
			}
			if (!ok) break;
		}
		if (ok) {
			real.depts[dept].recharge = out;
			merged++;
		}
	}
});
await Promise.all(workers);

await writeFile(REAL, JSON.stringify(real));
console.log(`\nFusionné : ${merged}/${depts.length} départements → ${REAL}`);
for (const d of ['19', '30', '35', '59']) {
	const r = real.depts[d]?.recharge;
	if (r) console.log(`  ${d}: été ${r.JJA.H1.med}% → ${r.JJA.H3.med}% (${r.JJA.H3.q5}…${r.JJA.H3.q95}) · hiver ${r.DJF.H3.med}%`);
}
