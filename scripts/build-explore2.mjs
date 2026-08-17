#!/usr/bin/env node
// Projections hydrologiques locales Explore2 → static/data/real.json (clé `explore2`)
//
// Source : « Indicateurs des changements par horizons temporels issus des narratifs
// des projections hydrologiques Explore2 » (doi:10.57745/E7LHGT, licence Etalab),
// indicateur delta-QMNA_summer — le changement relatif du débit mensuel minimal
// d'été, indicateur de référence de l'étiage en France, exprimé en % par rapport
// à la période 1976-2005.
//
// 36 chaînes de modélisation = 4 narratifs climatiques Explore2 (RCP 8.5) × 9 modèles
// hydrologiques. Le README d'Explore2 insiste : « l'approche multi-modèle doit être
// privilégiée », donc on ne retient jamais une chaîne isolée — on calcule la médiane
// et l'enveloppe (q10-q90) de l'ensemble, après filtrage des chaînes jugées aberrantes
// par les auteurs (doi:10.57745/YZNENQ).
//
// Chaque point de simulation est rattaché à son département par point-dans-polygone,
// puis le département prend la médiane de ses points.
//
// Prérequis (téléchargés à la main, cf. README) :
//   <dir>/qmna/*.parquet        les 108 fichiers delta-QMNA_summer
//   <dir>/stations_explore2.tab référentiel des points (doi:10.57745/UTKWR5)
//   <dir>/outliers.tab          chaînes aberrantes    (doi:10.57745/YZNENQ)
//
// Usage : node scripts/build-explore2.mjs <dir> [real.json]

import { readFile, readdir, writeFile } from 'node:fs/promises';
import { geoContains } from 'd3-geo';
import { parquetReadObjects } from 'hyparquet';

const DIR = process.argv[2];
const REAL = process.argv[3] || 'static/data/real.json';
if (!DIR) {
	console.error('usage: node scripts/build-explore2.mjs <dir-des-donnees> [real.json]');
	process.exit(1);
}

// Années centrales : référence 1976-2005, puis les 3 horizons Explore2.
export const HORIZON_YEAR = { ref: 1990, H1: 2035, H2: 2055, H3: 2085 };

const median = (a) => {
	if (!a.length) return null;
	const s = [...a].sort((x, y) => x - y);
	const m = s.length >> 1;
	return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};
const quantile = (a, q) => {
	if (!a.length) return null;
	const s = [...a].sort((x, y) => x - y);
	const i = (s.length - 1) * q;
	const lo = Math.floor(i), hi = Math.ceil(i);
	return lo === hi ? s[lo] : s[lo] + (s[hi] - s[lo]) * (i - lo);
};

/* ---------- référentiels ---------- */
function parseTab(text) {
	const lines = text.split('\n').filter(Boolean);
	const head = lines[0].split('\t');
	return lines.slice(1).map((l) => {
		const cells = l.split('\t');
		const o = {};
		head.forEach((h, i) => (o[h] = (cells[i] || '').replace(/^"|"$/g, '')));
		return o;
	});
}

console.log('Lecture des référentiels…');
const stations = parseTab(await readFile(`${DIR}/stations_explore2.tab`, 'utf8'));
const pointLL = new Map();
for (const s of stations) {
	const lon = parseFloat(s.lon_deg), lat = parseFloat(s.lat_deg);
	if (Number.isFinite(lon) && Number.isFinite(lat)) pointLL.set(s.code, [lon, lat]);
}
console.log(`  ${pointLL.size} points de simulation localisés`);

const outliers = new Set();
for (const o of parseTab(await readFile(`${DIR}/outliers.tab`, 'utf8'))) {
	if (o.EXP !== 'historical-rcp85') continue; // les narratifs sont tous en RCP 8.5
	outliers.add(`${o.code}|${o.GCM}|${o.RCM}|${o.BC}|${o.HM}`);
}
console.log(`  ${outliers.size} couples point×chaîne écartés (aberrants, RCP 8.5)`);

/* ---------- rattachement point → département ---------- */
const DEPTS = JSON.parse(await readFile('static/data/depts.geojson', 'utf8'));
// pré-filtrage par boîte englobante pour éviter 4000 × 96 tests exacts
const bboxes = DEPTS.features.map((f) => {
	let x0 = 180, y0 = 90, x1 = -180, y1 = -90;
	const walk = (c) => {
		if (typeof c[0] === 'number') {
			x0 = Math.min(x0, c[0]); x1 = Math.max(x1, c[0]);
			y0 = Math.min(y0, c[1]); y1 = Math.max(y1, c[1]);
		} else c.forEach(walk);
	};
	walk(f.geometry.coordinates);
	return { f, x0, y0, x1, y1 };
});
const deptCache = new Map();
function deptOf(code) {
	if (deptCache.has(code)) return deptCache.get(code);
	const ll = pointLL.get(code);
	let dept = null;
	if (ll) {
		for (const b of bboxes) {
			if (ll[0] < b.x0 || ll[0] > b.x1 || ll[1] < b.y0 || ll[1] > b.y1) continue;
			if (geoContains(b.f, ll)) { dept = b.f.properties.code; break; }
		}
	}
	deptCache.set(code, dept);
	return dept;
}

/* ---------- lecture des projections ---------- */
const files = (await readdir(`${DIR}/qmna`)).filter((f) => f.endsWith('.parquet'));
console.log(`Lecture de ${files.length} fichiers parquet…`);

// horizon -> code point -> [valeurs des chaînes]
const perPoint = { H1: new Map(), H2: new Map(), H3: new Map() };
let kept = 0, dropped = 0;

for (const name of files) {
	const m = name.match(/^delta-QMNA_summer_(H[123])_historical-rcp85_([^_]+)_([^_]+)_([^_]+)_([^_]+)_ref-/);
	if (!m) { console.warn('  nom inattendu:', name); continue; }
	const [, horizon, GCM, RCM, BC, HM] = m;
	const buf = await readFile(`${DIR}/qmna/${name}`);
	const rows = await parquetReadObjects({ file: new Uint8Array(buf).buffer });
	const col = `delta-QMNA_summer_${horizon}`;
	const store = perPoint[horizon];
	for (const r of rows) {
		const v = r[col];
		if (v == null || !Number.isFinite(v)) continue;
		if (outliers.has(`${r.code}|${GCM}|${RCM}|${BC}|${HM}`)) { dropped++; continue; }
		let arr = store.get(r.code);
		if (!arr) store.set(r.code, (arr = []));
		arr.push(v);
		kept++;
	}
}
console.log(`  ${kept} valeurs retenues, ${dropped} écartées (aberrantes)`);

/* ---------- agrégation par département ---------- */
const byDept = {}; // dept -> horizon -> { med:[], q10:[], q90:[] }
for (const horizon of ['H1', 'H2', 'H3']) {
	for (const [code, vals] of perPoint[horizon]) {
		if (vals.length < 8) continue; // point trop peu couvert par l'ensemble
		const dept = deptOf(code);
		if (!dept) continue;
		((byDept[dept] ||= {})[horizon] ||= { med: [], q10: [], q90: [], points: 0 });
		const slot = byDept[dept][horizon];
		slot.med.push(median(vals));
		slot.q10.push(quantile(vals, 0.1));
		slot.q90.push(quantile(vals, 0.9));
		slot.points++;
	}
}

const real = JSON.parse(await readFile(REAL, 'utf8'));
let merged = 0;
for (const [dept, horizons] of Object.entries(byDept)) {
	const d = real.depts[dept];
	if (!d) continue;
	const out = {};
	for (const [h, s] of Object.entries(horizons)) {
		out[h] = {
			med: Math.round(median(s.med) * 10) / 10,
			q10: Math.round(median(s.q10) * 10) / 10,
			q90: Math.round(median(s.q90) * 10) / 10,
			points: s.points
		};
	}
	if (Object.keys(out).length === 3) { d.explore2 = out; merged++; }
}

await writeFile(REAL, JSON.stringify(real));
console.log(`\nFusionné : ${merged}/${Object.keys(real.depts).length} départements → ${REAL}`);
for (const dep of ['19', '30', '35', '59']) {
	const e = real.depts[dep]?.explore2;
	if (e) console.log(`  ${dep}: 2035 ${e.H1.med}% · 2055 ${e.H2.med}% · 2085 ${e.H3.med}% (${e.H3.q10}…${e.H3.q90}) — ${e.H1.points} points`);
}
