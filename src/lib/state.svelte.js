// État partagé de l'application (runes Svelte 5).
// Une seule source de vérité : chaque composant lit `app` et réagit.

export const Y0 = 1975;
export const Y1 = 2075;
export const SPAN = Y1 - Y0;
export const THIS_YEAR = new Date().getFullYear();

export const app = $state({
	year: THIS_YEAR,
	birth: 1991,
	cp: '19240',
	dept: '19',
	communeName: 'Allassac',
	lonlat: [1.4609, 45.2573],
	view: 'world', // 'world' | 'france'
	compare: null, // { dept, name, lonlat } | null
	countryId: null, // id alpha-3 du pays sélectionné sur le globe
	autoRotate: false, // rotation du globe : immobile par défaut, lancée par le bouton ▶
	geoReady: false,
	toast: null // { label, at } — années remarquables
});

// Données géo chargées une fois au démarrage (non réactives : gros objets figés)
export const geo = { DEPTS: null, WORLD: null };

export function selectedCountry() {
	if (!app.countryId || !geo.WORLD) return null;
	return geo.WORLD.features.find((f) => f.id === app.countryId) || null;
}

/* helpers de formatage partagés (bulletin, duel, carte de partage) */
export const fmtPct = (v) => (v <= -0.5 ? '−' : '') + Math.abs(Math.round(v)) + '%';
export const fmtTemp = (v) => '+' + v.toFixed(1).replace('.', ',') + '°';
export const vigiOf = (j) =>
	j < 8 ? ['VERTE', '#2a9d8f']
	: j < 24 ? ['JAUNE', '#e9c46a']
	: j < 45 ? ['ORANGE', '#e07030']
	: ['ROUGE', '#e63946'];

// ?static=1 fige rotation et clapotis (captures d'écran, tests) ; on respecte
// aussi prefers-reduced-motion.
export const staticMode = () =>
	typeof location !== 'undefined' && new URLSearchParams(location.search).has('static');
export const reducedMotion = () =>
	staticMode() ||
	(typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches);
