// Météo de l'Eau — 10 archétypes hydro couvrant les 96 départements métropolitains.
// Valeurs simulées, calibrées sur les ordres de grandeur Explore2 (INRAE / Météo-France) :
// débits d'été -20% national en 2100, jusqu'à -40% dans le Sud-Ouest,
// recharge des nappes en baisse au sud-est, quasi stable au nord-est.
// Pivots : 1975, 2000, 2025, 2050, 2075 — interpolation linéaire entre pivots.
// temp = anomalie vs préindustriel (1850-1900).
//
// ⚠ Acte 2 : remplacer par les vraies séries Hub'Eau (passé) et les 187 secteurs
// Explore2/DRIAS-Eau (futur). Voir README, section « Dette d'acte 2 ».

export const PIVOT_YEARS = [1975, 2000, 2025, 2050, 2075];

export const ARCHETYPES = [
	{
		id: 'mediterraneen',
		label: 'Territoires méditerranéens',
		exemple: 'Nîmes',
		departements: ['06', '11', '13', '2A', '2B', '30', '34', '66', '83', '84'],
		series: {
			jours: [2, 8, 24, 47, 68],
			nappe: [0, -8, -18, -30, -38],
			debit: [0, -6, -15, -28, -40],
			temp: [0.2, 0.9, 1.7, 2.6, 3.4]
		}
	},
	{
		id: 'sud-ouest',
		label: 'Bassin de la Garonne',
		exemple: 'Toulouse',
		departements: ['09', '12', '24', '31', '32', '33', '40', '46', '47', '64', '65', '81', '82'],
		series: {
			jours: [2, 7, 21, 42, 62],
			nappe: [0, -7, -16, -28, -36],
			debit: [0, -8, -18, -32, -45],
			temp: [0.2, 0.9, 1.6, 2.5, 3.3]
		}
	},
	{
		id: 'massif-central',
		label: 'Massif central',
		exemple: 'Clermont-Ferrand',
		departements: ['03', '15', '19', '23', '42', '43', '48', '63', '87'],
		series: {
			jours: [1, 4, 13, 26, 40],
			nappe: [0, -4, -10, -18, -24],
			debit: [0, -5, -12, -22, -32],
			temp: [0.2, 0.8, 1.5, 2.4, 3.1]
		}
	},
	{
		id: 'rhone-alpes',
		label: 'Vallée du Rhône et Alpes',
		exemple: 'Grenoble',
		departements: ['01', '04', '05', '07', '26', '38', '69', '73', '74'],
		series: {
			jours: [1, 5, 16, 32, 48],
			nappe: [0, -5, -12, -21, -28],
			debit: [0, -6, -14, -26, -36],
			temp: [0.2, 0.9, 1.7, 2.7, 3.5]
		}
	},
	{
		id: 'bretagne-atlantique',
		label: 'Façade atlantique et Bretagne',
		exemple: 'Rennes',
		departements: ['22', '29', '35', '44', '56', '85'],
		series: {
			jours: [0, 2, 7, 15, 24],
			nappe: [0, -2, -5, -9, -13],
			debit: [0, -3, -8, -15, -22],
			temp: [0.2, 0.7, 1.3, 2.0, 2.7]
		}
	},
	{
		id: 'val-de-loire',
		label: 'Val de Loire et Poitou',
		exemple: 'Tours',
		departements: ['16', '17', '18', '28', '36', '37', '41', '45', '49', '53', '72', '79', '86'],
		series: {
			jours: [1, 4, 12, 25, 38],
			nappe: [0, -4, -10, -17, -23],
			debit: [0, -5, -12, -21, -30],
			temp: [0.2, 0.8, 1.4, 2.2, 2.9]
		}
	},
	{
		id: 'bassin-parisien',
		label: 'Bassin parisien',
		exemple: 'Paris',
		departements: ['02', '10', '27', '51', '60', '75', '77', '78', '89', '91', '92', '93', '94', '95'],
		series: {
			jours: [1, 3, 10, 21, 32],
			nappe: [0, -3, -7, -12, -16],
			debit: [0, -4, -10, -18, -26],
			temp: [0.2, 0.8, 1.5, 2.3, 3.0]
		}
	},
	{
		id: 'nord',
		label: 'Nord et Picardie',
		exemple: 'Lille',
		departements: ['59', '62', '80'],
		series: {
			jours: [0, 2, 6, 13, 21],
			nappe: [0, -2, -4, -7, -9],
			debit: [0, -3, -7, -13, -19],
			temp: [0.2, 0.7, 1.3, 2.1, 2.8]
		}
	},
	{
		id: 'est-continental',
		label: 'Grand Est, Bourgogne et Jura',
		exemple: 'Strasbourg',
		departements: ['08', '21', '25', '39', '52', '54', '55', '57', '58', '67', '68', '70', '71', '88', '90'],
		series: {
			jours: [0, 3, 9, 18, 28],
			nappe: [0, -1, -3, -4, -5],
			debit: [0, -3, -8, -15, -22],
			temp: [0.2, 0.8, 1.5, 2.4, 3.1]
		}
	},
	{
		id: 'normandie',
		label: 'Normandie',
		exemple: 'Caen',
		departements: ['14', '50', '61', '76'],
		series: {
			jours: [0, 2, 7, 14, 22],
			nappe: [0, -2, -5, -8, -11],
			debit: [0, -3, -8, -14, -20],
			temp: [0.2, 0.7, 1.3, 2.0, 2.7]
		}
	}
];

// Années remarquables : valeurs spécifiques prioritaires sur l'interpolation.
// Le facteur multiplie les jours de restriction de l'archétype pour cette année-là.
export const EVENTS = {
	1976: { label: 'Sécheresse historique de 1976', factor: 6.0 },
	1989: { label: 'Sécheresse de 1989-1990', factor: 2.2 },
	2003: { label: 'Canicule de 2003', factor: 2.6 },
	2022: { label: 'Été 2022 : 700 communes à sec', factor: 2.1 }
};

// Table dérivée : département → archétype (unicité + couverture vérifiées au chargement).
export const DEPT_TO_ARCH = {};
for (const a of ARCHETYPES) {
	for (const d of a.departements) {
		if (DEPT_TO_ARCH[d]) console.error('Département en double :', d);
		DEPT_TO_ARCH[d] = a;
	}
}

export const MAX_JOURS = 92;

export function lerpSeries(vals, y) {
	if (y <= PIVOT_YEARS[0]) return vals[0];
	if (y >= PIVOT_YEARS[PIVOT_YEARS.length - 1]) return vals[vals.length - 1];
	let i = 0;
	while (i < PIVOT_YEARS.length - 2 && PIVOT_YEARS[i + 1] <= y) i++;
	const t = (y - PIVOT_YEARS[i]) / (PIVOT_YEARS[i + 1] - PIVOT_YEARS[i]);
	return vals[i] + (vals[i + 1] - vals[i]) * t;
}

// jours de restriction, avec les années remarquables prioritaires sur l'interpolation
export function joursAt(arch, y) {
	const base = lerpSeries(arch.series.jours, y);
	const ev = EVENTS[y];
	return ev ? Math.min(MAX_JOURS, Math.round(base * ev.factor + 4)) : Math.round(base);
}
