// Fusion observations réelles / projections — le cœur de l'acte 2.
//
// Passé   : observations Hub'Eau (débits d'été en % vs référence 1975-2005,
//           nappes en indice percentile type IPS) et arrêtés réels VigiEau
//           pour les jours de restriction (2012 →).
// Futur   : débits = vraies projections locales Explore2 (indicateur
//           delta-QMNA_summer, médiane de 36 chaînes de modélisation, par
//           département) ; nappes et jours = ordres de grandeur de l'archétype.
//           Dans les deux cas la courbe est RACCORDÉE à la moyenne des
//           5 dernières années observées — pas de saut au passage observé → projeté.
// Repli   : archétype seul si le département n'a pas de données réelles.

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

// Trajectoire Explore2 locale : interpolation entre la référence 1976-2005 (0 %)
// et les 3 horizons (centres 2035 / 2055 / 2085), pour la médiane et l'enveloppe.
const H_YEARS = [1990, 2035, 2055, 2085];
function explore2At(e, year, key = 'med') {
	const pts = [0, e.H1[key] ?? 0, e.H2[key] ?? 0, e.H3[key] ?? 0];
	if (year <= H_YEARS[0]) return 0;
	if (year >= H_YEARS[3]) return pts[3];
	let i = 0;
	while (i < 2 && H_YEARS[i + 1] <= year) i++;
	const t = (year - H_YEARS[i]) / (H_YEARS[i + 1] - H_YEARS[i]);
	return pts[i] + (pts[i + 1] - pts[i]) * t;
}

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
		explore2: false,
		band: null, // enveloppe q10-q90 des 36 chaînes Explore2 (débit), en projection
		// En projection, la jauge « nappe » change de grandeur : le niveau mesuré
		// (percentile) laisse la place à la recharge potentielle estivale projetée (%).
		// Deux quantités différentes, donc étiquetées différemment dans l'UI.
		nappeIsRecharge: false,
		nappeBand: null,
		rechargeHiver: null,
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
		// Nappes : la recharge potentielle d'été projetée (Explore2 / modèle RECHARGE)
		// remplace l'indice de niveau, sans raccordement — ce n'est pas la même grandeur.
		if (real.recharge) {
			out.nappe = clamp(explore2At(real.recharge.JJA, year), -95, 95);
			out.nappeBand = {
				lo: clamp(explore2At(real.recharge.JJA, year, 'q5'), -95, 95),
				hi: clamp(explore2At(real.recharge.JJA, year, 'q95'), -95, 95)
			};
			out.rechargeHiver = Math.round(explore2At(real.recharge.DJF, year));
			out.nappeIsRecharge = true;
			out.anchored = true;
		} else {
			const aN = lerpSeries(arch.series.nappe, real.lastYear);
			if (real.baseline?.nappe != null) {
				out.nappe = clamp(real.baseline.nappe + (out.nappe - aN), -50, 50);
				out.anchored = true;
			}
		}
		if (real.baseline?.debit != null) {
			if (real.explore2) {
				// vraie trajectoire locale Explore2 (médiane de 36 chaînes)
				const e = real.explore2;
				const d0 = explore2At(e, real.lastYear);
				const shift = real.baseline.debit - d0;
				out.debit = clamp(explore2At(e, year) + shift, -95, 60);
				out.band = {
					lo: clamp(explore2At(e, year, 'q10') + shift, -95, 60),
					hi: clamp(explore2At(e, year, 'q90') + shift, -95, 60)
				};
				out.explore2 = true;
			} else {
				const aD = lerpSeries(arch.series.debit, real.lastYear);
				out.debit = clamp(real.baseline.debit + (out.debit - aD), -85, 60);
			}
			out.anchored = true;
		}
	}
	return out;
}

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
