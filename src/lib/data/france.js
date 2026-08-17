// Résolution du lieu : code postal → département → archétype,
// couleurs de la carte de France, enrichissement geo.api.gouv.fr.

import { scaleLinear, geoCentroid } from 'd3';
import { DEPT_TO_ARCH } from './archetypes.js';
import { statsAt } from './series.js';
import { app, geo, THIS_YEAR } from '$lib/state.svelte.js';

export const stressColor = scaleLinear()
	.domain([0, 0.35, 0.62, 1])
	.range(['#1d6e64', '#5f8f57', '#c8a03f', '#a8481f'])
	.clamp(true);

// Échelle France : les écarts utiles sont dans le bas de la plage,
// on l'étire pour que Bretagne et Languedoc ne soient pas du même vert.
export const franceColor = scaleLinear()
	.domain([0, 0.1, 0.22, 0.4, 0.7, 1])
	.range(['#1d6e64', '#2f8a6a', '#7fa85c', '#c8a03f', '#d9722f', '#a8481f'])
	.clamp(true);

// La carte se colore avec les jours de restriction — observés quand ils existent
// (2012+, arrêtés réels), modelés sinon.
export function deptStress(code, y) {
	if (!DEPT_TO_ARCH[code]) return 0;
	return Math.max(0, Math.min(1, statsAt(code, y).jours / 70));
}

export function archOf(dept) {
	return DEPT_TO_ARCH[dept];
}

export function deptFeature(code) {
	return geo.DEPTS ? geo.DEPTS.features.find((d) => d.properties.code === code) : null;
}
export function deptName(code) {
	const f = deptFeature(code);
	return f ? f.properties.nom : code;
}

export function deptFromCP(cp) {
	if (!/^\d{5}$/.test(cp)) return { error: 'Il faut 5 chiffres, comme 30000.' };
	const n = parseInt(cp, 10);
	if (cp.startsWith('97') || cp.startsWith('98'))
		return { error: "L'outre-mer n'est pas encore couvert. Ça vient." };
	if (cp.startsWith('20')) return { dept: n < 20200 ? '2A' : '2B' };
	const d = cp.slice(0, 2);
	if (!DEPT_TO_ARCH[d]) return { error: 'Ce code postal ne correspond à aucun département de métropole.' };
	return { dept: d };
}

// enrichissement optionnel : nom de commune + centre exact (repli silencieux hors ligne)
export async function lookupCP(cp) {
	const ctrl = new AbortController();
	const to = setTimeout(() => ctrl.abort(), 2500);
	try {
		const r = await fetch(
			`https://geo.api.gouv.fr/communes?codePostal=${cp}&fields=nom,codeDepartement,population,centre&format=json`,
			{ signal: ctrl.signal }
		);
		clearTimeout(to);
		if (!r.ok) return null;
		const list = await r.json();
		if (!Array.isArray(list) || !list.length) return null;
		list.sort((a, b) => (b.population || 0) - (a.population || 0)); // commune principale
		return list[0];
	} catch {
		clearTimeout(to);
		return null;
	}
}

export function applyLocation(dept, name, lonlat) {
	app.dept = dept;
	app.communeName = name;
	const f = deptFeature(dept);
	app.lonlat = lonlat || (f ? geoCentroid(f) : app.lonlat);
}
export function applyLocationB(dept, name, lonlat) {
	const f = deptFeature(dept);
	app.compare = { dept, name, lonlat: lonlat || (f ? geoCentroid(f) : null) };
}

// résolution partagée commune A / commune B : repli hors ligne immédiat, enrichissement réseau ensuite
export function resolveAndApply(cp, applyFn) {
	const res = deptFromCP(cp);
	if (res.error) return res.error;
	applyFn(res.dept, deptName(res.dept), null);
	lookupCP(cp).then((c) => {
		if (c && c.nom) {
			const dept = DEPT_TO_ARCH[c.codeDepartement] ? c.codeDepartement : res.dept;
			const ll = c.centre && c.centre.coordinates ? c.centre.coordinates : null;
			applyFn(dept, c.nom, ll);
		}
	});
	return null;
}

export function submitForm(cp, birthValue, cp2, compareOpen) {
	const by = parseInt(birthValue, 10);
	if (!by || by < 1900 || by > THIS_YEAR)
		return `L'année de naissance doit être entre 1900 et ${THIS_YEAR}.`;
	app.birth = by;

	const e1 = resolveAndApply(cp.trim(), applyLocation);
	if (e1) return e1;
	app.cp = cp.trim();

	if (compareOpen && cp2 && cp2.trim()) {
		const e2 = resolveAndApply(cp2.trim(), applyLocationB);
		if (e2) return 'Commune à comparer : ' + e2;
	}
	return null;
}
