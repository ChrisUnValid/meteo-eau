#!/usr/bin/env node
// Noms de pays en français → src/lib/data/countries-fr.js (fichier généré)
//
// Source des noms : Intl.DisplayNames de Node (données CLDR/Unicode), locale « fr ».
// Aucune dépendance, aucun dictionnaire à maintenir à la main.
//
// Intl travaille sur des codes ISO 3166-1 alpha-2, alors que le fond de carte et
// Aqueduct utilisent l'alpha-3 : la table de correspondance vient du dépôt de
// référence lukes/ISO-3166-Countries-with-Regional-Codes (domaine public).
//
// Usage : node scripts/build-country-names.mjs

import { readFile, writeFile } from 'node:fs/promises';

const ISO_URL =
	'https://raw.githubusercontent.com/lukes/ISO-3166-Countries-with-Regional-Codes/master/all/all.json';

// Usages français plus courants que la forme CLDR, ou codes non standards du fond de carte.
const OVERRIDES = {
	COD: 'RD Congo', // CLDR : « Congo-Kinshasa »
	MMR: 'Birmanie', // CLDR : « Myanmar (Birmanie) »
	'CS-KM': 'Kosovo' // code non standard employé par world.geo.json
};

console.log('Table ISO 3166…');
const iso = await (await fetch(ISO_URL)).json();
const a3to2 = new Map(iso.map((r) => [r['alpha-3'], r['alpha-2']]));

const W = JSON.parse(await readFile('static/data/world.geojson', 'utf8'));
const A = JSON.parse(await readFile('static/data/aqueduct.json', 'utf8')).countries;
const needed = new Set([...W.features.map((f) => f.id), ...Object.keys(A)]);
needed.delete('-99'); // entités sans code dans le fond de carte

const dn = new Intl.DisplayNames(['fr'], { type: 'region' });
const names = {};
const missing = [];
for (const id3 of [...needed].sort()) {
	if (OVERRIDES[id3]) { names[id3] = OVERRIDES[id3]; continue; }
	const id2 = a3to2.get(id3);
	let n = null;
	if (id2) { try { const v = dn.of(id2); if (v && v !== id2) n = v; } catch {} }
	if (n) names[id3] = n; else missing.push(id3);
}

// les clés non conformes aux identifiants JS (ex. « CS-KM ») doivent être citées
const lines = Object.entries(names).map(
	([k, v]) => `\t${/^[A-Za-z_$][\w$]*$/.test(k) ? k : JSON.stringify(k)}: ${JSON.stringify(v)}`
);
await writeFile(
	'src/lib/data/countries-fr.js',
	`// Fichier généré par scripts/build-country-names.mjs — ne pas éditer à la main.
// Noms français des pays (Intl.DisplayNames / CLDR), clés ISO 3166-1 alpha-3.
// ${Object.keys(names).length} pays couverts.

export const COUNTRY_FR = {
${lines.join(',\n')}
};
`
);
console.log(`Écrit : src/lib/data/countries-fr.js — ${Object.keys(names).length} pays`);
if (missing.length) console.warn('  sans nom français :', missing.join(' '));
