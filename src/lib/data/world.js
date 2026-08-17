// Stress hydrique mondial — données réelles WRI Aqueduct 4.0 (CC BY 4.0).
// Indicateur `bws` (prélèvements / ressource disponible), pondéré par la demande
// totale, score 0-5 ramené ici sur 0-1. Seuil « stress élevé » = score 3 (40 % de
// la ressource prélevée), soit 0,6 — c'est la définition du WRI, pas la nôtre.
//
// Temporalité : la référence Aqueduct est une moyenne 1979-2019, donc constante sur
// tout le passé du bulletin (aucune série annuelle n'existe) ; le futur suit le
// scénario « business as usual » aux horizons 2030 / 2050 / 2080.

import { geoArea, geoContains } from 'd3';

export const HIGH_STRESS = 0.6; // score 3/5 = seuil « High » du WRI
const BASE_YEAR = 2020; // fin de la fenêtre de référence 1979-2019
const H_YEARS = [BASE_YEAR, 2030, 2050, 2080];

let AQ = {}; // ISO3 -> { name, base, bau:{2030,2050,2080}, opt2050, pes2050 }
let AQ_META = null;

export async function loadAqueduct(fetchFn = fetch) {
	try {
		const r = await fetchFn('/data/aqueduct.json');
		if (!r.ok) return false;
		const j = await r.json();
		AQ = j.countries || {};
		AQ_META = j;
		return true;
	} catch {
		return false;
	}
}
export const aqueductFor = (id) => AQ[id] || null;
export const aqueductMeta = () => AQ_META;

// score Aqueduct (0-5) interpolé dans le temps, ou null si le pays n'est pas couvert
export function countryScore(id, year) {
	const c = AQ[id];
	if (!c) return null;
	if (year <= BASE_YEAR) return c.base;
	const pts = [c.base, c.bau['2030'], c.bau['2050'], c.bau['2080']];
	if (pts.some((v) => v == null)) return c.base;
	if (year >= H_YEARS[3]) return pts[3];
	let i = 0;
	while (i < 2 && H_YEARS[i + 1] <= year) i++;
	const t = (year - H_YEARS[i]) / (H_YEARS[i + 1] - H_YEARS[i]);
	return pts[i] + (pts[i + 1] - pts[i]) * t;
}

// worldStress renvoie 0-1, ou null si le pays n'est pas couvert par Aqueduct
// (25 pays « NoData » : on les grise plutôt que d'inventer une valeur).
export function worldStress(f, y) {
	const score = countryScore(f.id, y);
	return score == null ? null : Math.max(0, Math.min(1, score / 5));
}

// Compté sur l'univers Aqueduct (164 pays), pas sur les polygones du fond de carte :
// une vingtaine de micro-États n'ont pas de contour ici et fausseraient le total.
// Ainsi le compteur retombe exactement sur les chiffres publiés par le WRI.
export function countHighStress(y) {
	let n = 0;
	for (const id of Object.keys(AQ)) {
		const s = countryScore(id, y);
		if (s != null && s / 5 >= HIGH_STRESS) n++;
	}
	return n;
}

// première année où le pays franchit le seuil de stress élevé (null si jamais)
export function firstHighYear(f, Y1) {
	if (!AQ[f.id]) return null;
	for (let y = 1975; y <= Y1; y++) {
		const s = worldStress(f, y);
		if (s != null && s >= HIGH_STRESS) return y;
	}
	return null;
}

export const stressCat = (s) =>
	s >= 0.85 ? ['CRITIQUE', '#e63946']
	: s >= HIGH_STRESS ? ['ÉLEVÉ', '#e07030']
	: s >= 0.45 ? ['MODÉRÉ', '#e9c46a']
	: ['FAIBLE', '#2a9d8f'];

// d3 attend des anneaux extérieurs orientés dans le sens antihoraire (règle de la main droite).
// world.geo.json en contient à l'envers : en projection orthographique, d3 les lit comme
// « tout le globe sauf ce pays » et ils recouvrent l'océan. On les remet à l'endroit.
export function rewindWorld(WORLD) {
	let fixed = 0;
	for (const f of WORLD.features) {
		const g = f.geometry;
		const polys = g.type === 'Polygon' ? [g.coordinates] : g.type === 'MultiPolygon' ? g.coordinates : [];
		for (const poly of polys) {
			if (geoArea({ type: 'Polygon', coordinates: poly }) > 2 * Math.PI) {
				poly[0].reverse();
				fixed++;
			}
		}
	}
	if (fixed) console.info(`[globe] ${fixed} polygone(s) réorienté(s)`);
	return WORLD;
}

export function countryAt(WORLD, lonlat) {
	return WORLD.features.find((ft) => geoContains(ft, lonlat)) || null;
}

// Noms français des pays : dictionnaire généré (Intl.DisplayNames / CLDR),
// cf. scripts/build-country-names.mjs. Repli sur le nom anglais du fond de carte,
// puis sur le code ISO — en pratique les 182 pays du globe sont couverts.
import { COUNTRY_FR } from './countries-fr.js';
export const countryLabel = (f) => COUNTRY_FR[f.id] || (f.properties && f.properties.name) || f.id;
