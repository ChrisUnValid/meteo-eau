// Gabarits de phrases « présentateur » — la voix du bulletin.
// Sélection déterministe par seuils (niveau de vigilance × temporalité × événements),
// variation par parité d'année pour éviter la répétition en tirant le slider.
// Aucun aléatoire : même année + même commune = même phrase.

import { EVENTS } from './archetypes.js';
import { fmtPct, vigiOf } from '$lib/state.svelte.js';

// Accord du lieu : « à Nîmes », « au Havre », « aux Sables-d'Olonne »
function aVille(commune) {
	if (/^Les? /i.test(commune)) return commune.replace(/^Les /i, 'aux ').replace(/^Le /i, 'au ');
	if (/^L'/i.test(commune)) return 'à ' + commune;
	return 'à ' + commune;
}

function suffixAge(age, tense) {
	if (age < 0 || age > 110) return '';
	if (age === 0) return " L'année de ta naissance.";
	if (tense === 'past') return ` Tu avais ${age} ans.`;
	if (tense === 'present') return ` Tu as ${age} ans.`;
	return ` Tu auras ${age} ans.`;
}

/**
 * La phrase du bulletin solo. ~15 gabarits :
 *  - 2 événements (1976 + générique 1989/2003/2022)
 *  - 4 niveaux de vigilance × 3 temporalités (avec variantes sur les plus fréquents)
 *  - 1 extrême (≥ 60 jours)
 */
export function bulletinPhrase(stats, year, commune, birth, thisYear) {
	const j = stats.jours;
	// en projection, la jauge « nappe » porte la recharge potentielle d'été
	const nappeMot = stats.nappeIsRecharge ? 'recharge d’été' : 'nappe';
	const nappe = fmtPct(stats.nappe);
	const debit = fmtPct(stats.debit);
	// le contraste hiver/été est LE message d'Explore2 : à dire quand il est net
	const contraste =
		stats.rechargeHiver != null && stats.rechargeHiver >= 5 && stats.nappe <= -15
			? ` Il pleuvra davantage l’hiver (recharge ${fmtPct(stats.rechargeHiver)}), mais l’eau ne sera plus là l’été.`
			: '';
	const lvl = vigiOf(j)[0];
	const tense = year < thisYear ? 'past' : year === thisYear ? 'present' : 'future';
	const age = year - birth;
	const ici = aVille(commune);
	const alt = year % 2 === 0; // variante A/B
	const fin = suffixAge(age, tense);

	// Années remarquables — prioritaires sur tout le reste
	const ev = EVENTS[year];
	if (ev) {
		if (year === 1976)
			return `Souviens-toi de l'été 1976 : la grande sécheresse. ${j} jours sans arroser ${ici} — on pensait vivre une exception.${fin}`;
		return `${ev.label} — ${j} jours sans arroser ${ici}. On appelait encore ça une année exceptionnelle.${fin}`;
	}

	// Extrême : au-delà de deux mois de restrictions
	if (j >= 60)
		return `${commune}, été ${year} : ${j} jours sans arroser — deux mois. À ce niveau, on ne parle plus de sécheresse, on parle d'un nouveau climat.${fin}`;

	if (lvl === 'VERTE') {
		if (tense === 'past')
			return `L'été ${year} ${ici} avait des airs d'abondance : ${j} jour${j > 1 ? 's' : ''} de restriction à peine, des nappes presque pleines.${fin}`;
		if (tense === 'present')
			return `Cet été ${ici}, l'eau tient bon : vigilance verte, ${j} jour${j > 1 ? 's' : ''} de restriction seulement.${fin}`;
		return `Bonne nouvelle relative pour ${commune} : en ${year}, l'été resterait en vigilance verte — ${j} jour${j > 1 ? 's' : ''} sans arroser.${fin}`;
	}

	if (lvl === 'JAUNE') {
		if (tense === 'past')
			return `Été ${year} ${ici} : les premiers signes. ${j} jours de restriction, la nappe glissait déjà à ${nappe}.${fin}`;
		if (tense === 'present')
			return `${commune} passe l'été en vigilance jaune : ${j} jours sans arroser, nappe à ${nappe}. Rien de grave — pour l'instant.${fin}`;
		return alt
			? `En ${year} ${ici}, l'été s'annoncerait sous surveillance : ${j} jours sans arroser, ${nappeMot} à ${nappe}.${fin}${contraste}`
			: `Bulletin de l'été ${year} ${ici} : vigilance jaune probable, ${j} jours de restrictions et des rivières en baisse (${debit}).${fin}${contraste}`;
	}

	if (lvl === 'ORANGE') {
		if (tense === 'past')
			return `L'été ${year} ${ici} était déjà orange : ${j} jours sans arroser, des rivières à ${debit}.${fin}`;
		if (tense === 'present')
			return `Vigilance orange ${ici} cet été : ${j} jours sans arroser, nappe à ${nappe}. L'arrosoir se mérite.${fin}`;
		return alt
			? `Été ${year} ${ici} : vigilance orange attendue. ${j} jours sans arroser, ${nappeMot} à ${nappe} — l'eau se compte.${fin}${contraste}`
			: `En ${year}, ${commune} passerait l'été en orange : ${j} jours de restrictions, des rivières à ${debit}.${fin}${contraste}`;
	}

	// ROUGE
	if (tense === 'past')
		return `Été ${year} ${ici} : alerte rouge. ${j} jours sans arroser, nappe à ${nappe} — et on trouvait déjà ça énorme.${fin}`;
	if (tense === 'present')
		return `Alerte rouge ${ici} : ${j} jours sans arroser cet été, nappe à ${nappe}, rivières à ${debit}.${fin}`;
	return alt
		? `Bulletin de l'été ${year} ${ici} : alerte rouge. ${j} jours sans arroser, ${nappeMot} à ${nappe} — l'arrosoir devient un souvenir.${fin}${contraste}`
		: `${commune}, été ${year} : rouge. ${j} jours sans arroser, des rivières à ${debit}. L'eau devient un budget.${fin}${contraste}`;
}

/** La phrase du duel — 2 gabarits selon l'écart. */
export function duelPhrase(statsA, statsB, year, communeA, communeB) {
	const jA = statsA.jours;
	const jB = statsB.jours;
	const ecart = Math.abs(jA - jB);
	if (ecart <= 5)
		return `${communeA} et ${communeB}, été ${year} : match nul ou presque — ${jA} et ${jB} jours sans arroser. Le même ciel pour tous.`;
	const [gagnant] = jA < jB ? [communeA] : [communeB];
	return `Duel ${communeA}–${communeB}, été ${year} : ${jA} jours contre ${jB}. Même pays, deux mondes d'eau — avantage ${gagnant}.`;
}
