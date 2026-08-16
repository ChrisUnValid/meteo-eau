// Indice de stress hydrique mondial — SIMULÉ, inspiré des catégories WRI Aqueduct.
// Calibrage : ~13 pays en stress élevé en 1975, 40 aujourd'hui, 49 en 2050
// (le WRI en projette 51 sur 164 pays analysés), 60 en 2075.
//
// ⚠ Acte 2 : remplacer par les vraies données WRI Aqueduct par pays.

import { geoCentroid, geoArea, geoContains } from 'd3';
import { Y0, SPAN } from '$lib/state.svelte.js';

export const HIGH_STRESS = 0.7;

const WORLD_BASE = {
	SAU:.97,ARE:.97,KWT:.98,QAT:.98,BHR:.97,OMN:.95,YEM:.94,IRQ:.92,IRN:.93,JOR:.96,
	ISR:.95,LBN:.92,SYR:.93,LBY:.95,EGY:.96,DZA:.90,TUN:.90,MAR:.88,ESH:.92,MRT:.88,
	PAK:.93,IND:.90,AFG:.90,TKM:.92,UZB:.91,TJK:.72,KGZ:.68,KAZ:.78,MNG:.72,
	ERI:.88,DJI:.90,SOM:.88,SDN:.86,TCD:.82,NER:.84,MLI:.80,BFA:.76,SEN:.70,ETH:.72,
	ESP:.78,GRC:.72,TUR:.74,PRT:.70,CYP:.82,ITA:.62,FRA:.55,MEX:.72,CHL:.74,ARG:.52,
	ZAF:.74,NAM:.78,BWA:.76,ZWE:.66,AUS:.70,USA:.55,CHN:.70,LKA:.60,NPL:.58,
	DEU:.32,GBR:.30,IRL:.16,NOR:.10,SWE:.12,FIN:.10,DNK:.28,NLD:.30,BEL:.34,CHE:.22,
	AUT:.20,POL:.42,CZE:.38,RUS:.24,CAN:.12,BRA:.28,COD:.10,COG:.10,GAB:.10,NGA:.36,
	IDN:.30,MYS:.22,PHL:.34,VNM:.32,THA:.38,JPN:.42,KOR:.52,NZL:.18,ISL:.06,COL:.22,
	PER:.36,BOL:.34,VEN:.26,ECU:.24,PRY:.30,URY:.26,BGD:.42,MMR:.26,KHM:.28,LAO:.20,
	UKR:.46,ROU:.42,BGR:.44,HUN:.40,SRB:.40,HRV:.30,GEO:.44,ARM:.66,AZE:.72,
	MDG:.40,KEN:.60,TZA:.34,UGA:.30,ZMB:.26,MOZ:.36,AGO:.24,GHA:.34,CIV:.30,CMR:.22
};

const worldBaseCache = new Map();
export function worldBase(f) {
	if (worldBaseCache.has(f.id)) return worldBaseCache.get(f.id);
	let v = WORLD_BASE[f.id];
	if (v === undefined) {
		const [, lat] = geoCentroid(f);
		// bande subtropicale aride centrée sur ±27°
		v = 0.14 + 0.74 * Math.exp(-Math.pow(Math.abs(lat) - 27, 2) / (2 * 81));
	}
	worldBaseCache.set(f.id, v);
	return v;
}

export function worldStress(f, y) {
	const t = (y - Y0) / SPAN;
	return Math.max(0, Math.min(1, worldBase(f) * (0.76 + t * 0.27)));
}

export function countHighStress(WORLD, y) {
	let n = 0;
	for (const f of WORLD.features) if (worldStress(f, y) > HIGH_STRESS) n++;
	return n;
}

export function firstHighYear(f, Y1) {
	for (let y = Y0; y <= Y1; y++) if (worldStress(f, y) > HIGH_STRESS) return y;
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

// Noms français (~95 pays), repli sur le nom anglais du GeoJSON.
// ⚠ Acte 2 : compléter ou remplacer par une lib i18n.
const COUNTRY_FR = {
	FRA:'France', ESP:'Espagne', PRT:'Portugal', ITA:'Italie', DEU:'Allemagne', GBR:'Royaume-Uni',
	IRL:'Irlande', BEL:'Belgique', NLD:'Pays-Bas', CHE:'Suisse', AUT:'Autriche', POL:'Pologne',
	CZE:'Tchéquie', GRC:'Grèce', TUR:'Turquie', NOR:'Norvège', SWE:'Suède', FIN:'Finlande',
	DNK:'Danemark', ISL:'Islande', RUS:'Russie', UKR:'Ukraine', ROU:'Roumanie', BGR:'Bulgarie',
	HUN:'Hongrie', SRB:'Serbie', HRV:'Croatie', MAR:'Maroc', DZA:'Algérie', TUN:'Tunisie',
	LBY:'Libye', EGY:'Égypte', SAU:'Arabie saoudite', ARE:'Émirats arabes unis', QAT:'Qatar',
	KWT:'Koweït', IRQ:'Irak', IRN:'Iran', ISR:'Israël', JOR:'Jordanie', LBN:'Liban', SYR:'Syrie',
	YEM:'Yémen', OMN:'Oman', PAK:'Pakistan', IND:'Inde', CHN:'Chine', JPN:'Japon', KOR:'Corée du Sud',
	IDN:'Indonésie', AUS:'Australie', NZL:'Nouvelle-Zélande', USA:'États-Unis', CAN:'Canada',
	MEX:'Mexique', BRA:'Brésil', ARG:'Argentine', CHL:'Chili', PER:'Pérou', COL:'Colombie',
	VEN:'Venezuela', BOL:'Bolivie', ZAF:'Afrique du Sud', NGA:'Nigeria', ETH:'Éthiopie',
	KEN:'Kenya', TZA:'Tanzanie', SEN:'Sénégal', MLI:'Mali', NER:'Niger', TCD:'Tchad',
	SDN:'Soudan', SOM:'Somalie', MDG:'Madagascar', COD:'RD Congo', CMR:'Cameroun',
	CIV:"Côte d'Ivoire", GHA:'Ghana', MRT:'Mauritanie', BFA:'Burkina Faso', AFG:'Afghanistan',
	KAZ:'Kazakhstan', UZB:'Ouzbékistan', TKM:'Turkménistan', MNG:'Mongolie', THA:'Thaïlande',
	VNM:'Viêt Nam', MMR:'Birmanie', BGD:'Bangladesh', LKA:'Sri Lanka', NPL:'Népal',
	PHL:'Philippines', MYS:'Malaisie', GEO:'Géorgie', ARM:'Arménie', AZE:'Azerbaïdjan',
	CYP:'Chypre', GRL:'Groenland', CUB:'Cuba'
};
export const countryLabel = (f) => COUNTRY_FR[f.id] || (f.properties && f.properties.name) || f.id;
