// Fusion observations réelles / projections — le cœur de l'acte 2.
//
// Passé   : observations Hub'Eau quand elles existent pour le département
//           (débits d'été en % vs référence 1975-2005, nappes en indice
//           percentile type IPS, écart au médian ±50).
// Futur   : ordres de grandeur Explore2 portés par l'archétype, RACCORDÉS à la
//           moyenne des 5 dernières années observées — pas de saut au passage
//           observé → projeté.
// Repli   : archétype seul si le département n'a pas de données réelles.
//
// ⚠ Dette : l'ingestion des 540 chaînes NetCDF Explore2 par secteur
// (doi:10.57745/8CZUWN) remplacera l'ancrage par les vraies trajectoires locales.

import { DEPT_TO_ARCH, joursAt, lerpSeries } from './archetypes.js';

let REAL = {}; // dept -> { debit:{y:v}, nappe:{y:v}, lastYear, baseline, stations }
let GENERATED = null;

export async function loadReal(fetchFn = fetch) {
	try {
		const r = await fetchFn('/data/real.json');
		if (!r.ok) return false;
		const j = await r.json();
		REAL = j.depts || {};
		GENERATED = j.generated || null;
		return true;
	} catch {
		return false;
	}
}

export const realGeneratedOn = () => GENERATED;
export const realFor = (dept) => REAL[dept] || null;

/**
 * Les chiffres du bulletin pour un département et une année.
 * `observed.nappe` / `observed.debit` disent, métrique par métrique, si la
 * valeur vient d'une mesure Hub'Eau ou d'une projection.
 * `jours` (restrictions) reste toujours modelé — c'est le récit de l'archétype.
 */
export function statsAt(dept, year) {
	const arch = DEPT_TO_ARCH[dept];
	const real = REAL[dept];
	const out = {
		jours: joursAt(arch, year),
		nappe: lerpSeries(arch.series.nappe, year),
		debit: lerpSeries(arch.series.debit, year),
		temp: lerpSeries(arch.series.temp, year),
		observed: { nappe: false, debit: false, jours: false },
		anchored: false,
		stations: real ? real.stations : null
	};
	if (!real) return out;

	// jours de restriction observés (historique Propluvia → VigiEau, quotidien par commune)
	const jm = real.joursMeta;
	if (jm && year >= jm.firstYear && year <= jm.lastYear && real.jours?.[year] != null) {
		out.jours = Math.round(real.jours[year]);
		out.observed.jours = true;
	}

	if (!real.lastYear) return out;

	if (year <= real.lastYear) {
		const n = real.nappe?.[year];
		const d = real.debit?.[year];
		if (n != null) { out.nappe = n; out.observed.nappe = true; }
		if (d != null) { out.debit = d; out.observed.debit = true; }
	} else {
		// futur ancré : baseline observée + delta de l'archétype depuis lastYear
		const aN = lerpSeries(arch.series.nappe, real.lastYear);
		const aD = lerpSeries(arch.series.debit, real.lastYear);
		if (real.baseline?.nappe != null) {
			out.nappe = clamp(real.baseline.nappe + (out.nappe - aN), -50, 50);
			out.anchored = true;
		}
		if (real.baseline?.debit != null) {
			out.debit = clamp(real.baseline.debit + (out.debit - aD), -85, 60);
			out.anchored = true;
		}
	}
	return out;
}

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
