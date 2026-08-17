#!/usr/bin/env node
// Stress hydrique mondial réel → static/data/aqueduct.json
//
// Source : WRI Aqueduct 4.0 Country Rankings (licence CC BY 4.0)
//   https://www.wri.org/data/aqueduct-40-country-rankings
//   Kuzma, S. et al. 2023. « Aqueduct 4.0 » — doi.org/10.46830/writn.23.00061
//
// Indicateur `bws` (baseline water stress : prélèvements / ressource disponible),
// pondéré par la demande totale en eau (weight = Tot), score 0-5 :
//   0-1 faible (<10 %) · 1-2 faible-moyen (10-20 %) · 2-3 moyen-élevé (20-40 %)
//   3-4 élevé (40-80 %) · 4-5 extrêmement élevé (>80 %)
//
// La référence Aqueduct est une moyenne 1979-2019 : elle vaut donc pour tout le
// passé du bulletin, sans série annuelle. Le futur suit le scénario « business as
// usual » (bau) aux horizons 2030 / 2050 / 2080 ; les scénarios optimiste et
// pessimiste de 2050 sont conservés pour donner la fourchette.
//
// Le xlsx est lu sans dépendance : c'est un zip de XML.
//
// Usage : node scripts/build-aqueduct.mjs <fichier.xlsx> [sortie.json]

import { readFile, writeFile } from 'node:fs/promises';
import { inflateRawSync } from 'node:zlib';

const XLSX = process.argv[2];
const OUT = process.argv[3] || 'static/data/aqueduct.json';
if (!XLSX) {
	console.error('usage: node scripts/build-aqueduct.mjs <fichier.xlsx> [sortie.json]');
	process.exit(1);
}

/* ---------- lecture zip minimale (le xlsx est un zip stocké/déflaté) ---------- */
function readZipEntries(buf) {
	const entries = new Map();
	// End of Central Directory
	let eocd = buf.length - 22;
	while (eocd >= 0 && buf.readUInt32LE(eocd) !== 0x06054b50) eocd--;
	if (eocd < 0) throw new Error('zip illisible');
	const count = buf.readUInt16LE(eocd + 10);
	let off = buf.readUInt32LE(eocd + 16);
	for (let i = 0; i < count; i++) {
		if (buf.readUInt32LE(off) !== 0x02014b50) break;
		const method = buf.readUInt16LE(off + 10);
		const csize = buf.readUInt32LE(off + 20);
		const nameLen = buf.readUInt16LE(off + 28);
		const extraLen = buf.readUInt16LE(off + 30);
		const commentLen = buf.readUInt16LE(off + 32);
		const lho = buf.readUInt32LE(off + 42);
		const name = buf.subarray(off + 46, off + 46 + nameLen).toString('utf8');
		// en-tête local : longueurs propres
		const lNameLen = buf.readUInt16LE(lho + 26);
		const lExtraLen = buf.readUInt16LE(lho + 28);
		const dataStart = lho + 30 + lNameLen + lExtraLen;
		const raw = buf.subarray(dataStart, dataStart + csize);
		entries.set(name, method === 0 ? raw : inflateRawSync(raw));
		off += 46 + nameLen + extraLen + commentLen;
	}
	return entries;
}

/* ---------- lecture xlsx ---------- */
const buf = await readFile(XLSX);
const files = readZipEntries(buf);

const sharedXml = files.get('xl/sharedStrings.xml').toString('utf8');
const shared = [];
for (const m of sharedXml.matchAll(/<si>([\s\S]*?)<\/si>/g)) {
	shared.push(
		[...m[1].matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)]
			.map((t) => t[1])
			.join('')
			.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'")
	);
}

function sheetRows(path) {
	const xml = files.get(path).toString('utf8');
	const rows = [];
	let header = null;
	for (const rm of xml.matchAll(/<row[^>]*>([\s\S]*?)<\/row>/g)) {
		const cells = {};
		for (const cm of rm[1].matchAll(/<c r="([A-Z]+)\d+"([^>]*)>([\s\S]*?)<\/c>/g)) {
			const col = cm[1];
			const attrs = cm[2];
			const vm = cm[3].match(/<v>([\s\S]*?)<\/v>/);
			if (!vm) continue;
			cells[col] = / t="s"/.test(attrs) ? shared[+vm[1]] : vm[1];
		}
		if (!header) { header = cells; continue; }
		const o = {};
		for (const [k, v] of Object.entries(cells)) o[header[k] || k] = v;
		rows.push(o);
	}
	return rows;
}

console.log('Lecture du classeur Aqueduct…');
const baseline = sheetRows('xl/worksheets/sheet2.xml').filter(
	(r) => r.indicator_name === 'bws' && r.weight === 'Tot'
);
const future = sheetRows('xl/worksheets/sheet3.xml').filter((r) => r.weight === 'Tot');
console.log(`  ${baseline.length} pays en référence, ${future.length} lignes de projection`);

const countries = {};
for (const r of baseline) {
	if (r.label === 'NoData' || r.score == null || r.score === '') continue;
	countries[r.gid_0] = { name: r.name_0, base: Math.round(parseFloat(r.score) * 1000) / 1000, bau: {} };
}
let futCount = 0;
for (const r of future) {
	const c = countries[r.gid_0];
	if (!c || r.label === 'NoData' || !r.score) continue;
	const s = Math.round(parseFloat(r.score) * 1000) / 1000;
	if (r.scenario === 'bau') { c.bau[r.year] = s; futCount++; }
	else if (r.year === '2050') (c[r.scenario === 'opt' ? 'opt2050' : 'pes2050'] = s);
}
console.log(`  ${Object.keys(countries).length} pays retenus, ${futCount} points de projection bau`);

// contrôle : le chiffre communiqué par le WRI (51 pays en stress élevé en 2050)
const high = (score) => score >= 3;
const n2050 = Object.values(countries).filter((c) => c.bau['2050'] != null && high(c.bau['2050'])).length;
const nBase = Object.values(countries).filter((c) => high(c.base)).length;
console.log(`  contrôle : ${nBase} pays en stress élevé en référence, ${n2050} en 2050 (bau)`);

await writeFile(
	OUT,
	JSON.stringify({
		generated: new Date().toISOString().slice(0, 10),
		source: 'WRI Aqueduct 4.0 Country Rankings (CC BY 4.0)',
		indicator: 'bws (baseline water stress), pondéré demande totale, score 0-5',
		refPeriod: '1979-2019',
		countries
	})
);
console.log(`Écrit : ${OUT} (${(JSON.stringify(countries).length / 1024).toFixed(0)} Ko)`);
