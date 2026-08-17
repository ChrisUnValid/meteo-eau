<script>
	// Le bulletin : chiffre héros + vigilance en solo, duel à deux colonnes en comparaison,
	// coupe de la nappe, « Et maintenant ? », bouton carte de partage.
	import { app, fmtPct, fmtTemp, vigiOf, THIS_YEAR } from '$lib/state.svelte.js';
	import { MAX_JOURS } from '$lib/data/archetypes.js';
	import { archOf } from '$lib/data/france.js';
	import { statsAt } from '$lib/data/series.js';
	import { bulletinPhrase, duelPhrase } from '$lib/data/phrases.js';
	import Coupe from './Coupe.svelte';

	let { onshare } = $props();

	const a = $derived(archOf(app.dept));
	const stats = $derived(statsAt(app.dept, app.year));
	const j = $derived(stats.jours);
	const lvl = $derived(vigiOf(j));
	const age = $derived(app.year - app.birth);
	const statsB = $derived(app.compare ? statsAt(app.compare.dept, app.year) : null);
	const jB = $derived(statsB ? statsB.jours : 0);
	const lvlB = $derived(vigiOf(jB));
	const isObs = $derived(stats.observed.nappe || stats.observed.debit || stats.observed.jours);
	const provenance = $derived.by(() => {
		if (!isObs)
			return stats.explore2
				? 'projection locale Explore2 · 36 chaînes'
				: stats.anchored
					? 'projection ancrée sur l’observé'
					: 'projection type';
		const src = [];
		if (stats.observed.nappe || stats.observed.debit)
			src.push(`Hub'Eau (${(stats.stations?.debit || 0) + (stats.stations?.nappe || 0)} stations)`);
		if (stats.observed.jours) src.push('arrêtés VigiEau');
		return `données observées · ${src.join(' + ')}`;
	});
	const phrase = $derived(
		app.compare
			? duelPhrase(stats, statsB, app.year, app.communeName, app.compare.name)
			: bulletinPhrase(stats, app.year, app.communeName, app.birth, THIS_YEAR)
	);
</script>

<div class="card">
	<div class="loc">
		{app.compare ? `${app.communeName} ⚡ ${app.compare.name}` : app.communeName} · été {app.year}
		<span class="agebadge">
			{age < 0 ? 'avant toi' : age === 0 ? 'ta naissance' : `${age} ans`}
		</span>
	</div>
	<div class="arch" class:obs={isObs}>
		{app.compare ? `duel de communes · ${provenance}` : `${provenance} · ${a.label}`}
	</div>

	<div class="phrase">🎙 {phrase}</div>

	{#if !app.compare}
		<div class="heronum">
			<div class="n">{j}</div>
			<div class="u">jours sans arroser cet été-là{#if stats.observed.jours}<i class="dot" title="arrêtés observés (Propluvia / VigiEau)"></i>{/if}</div>
		</div>
		<div class="vigi">
			<div class="lab">
				<span>Vigilance sécheresse</span>
				<span class="lvl" style="color:{lvl[1]}">{lvl[0]}</span>
			</div>
			<div class="lifebar" class:crit={lvl[0] === 'ROUGE'}>
				<div
					class="fill"
					style="width:{Math.min(100, (j / MAX_JOURS) * 100)}%; background:linear-gradient(90deg,#2a9d8f,{lvl[1]})"
				></div>
			</div>
		</div>
		<div class="gauges">
			<div class="g">
				<div class="l">Nappe {#if stats.observed.nappe}<i class="dot" title="mesuré (Hub'Eau)"></i>{/if}</div>
				<div class="v">{fmtPct(stats.nappe)}</div>
			</div>
			<div class="g">
				<div class="l">
					Débit été
					{#if stats.observed.debit}<i class="dot" title="mesuré (Hub'Eau)"></i>
					{:else if stats.explore2}<span class="sub">moy. 30 ans</span>{/if}
				</div>
				<div class="v">{fmtPct(stats.debit)}</div>
				{#if stats.band}
					<div class="band" title="enveloppe des 36 chaînes de modélisation Explore2 — les années sèches isolées sortent de cette fourchette">
						{fmtPct(stats.band.lo)} … {fmtPct(stats.band.hi)}
					</div>
				{/if}
			</div>
			<div class="g"><div class="l">Temp.</div><div class="v t">{fmtTemp(stats.temp)}</div></div>
		</div>
	{:else}
		<div class="duelgrid">
			<div class="duelcol a">
				<div class="who">{app.communeName}</div>
				<div class="dn">{j}</div>
				<div class="du">jours sans arroser{#if stats.observed.jours}<i class="dot"></i>{/if}</div>
				<div class="minibar"><i style="width:{Math.min(100, (j / MAX_JOURS) * 100)}%; background:{lvl[1]}"></i></div>
				<div class="dv"><span>Nappe{#if stats.observed.nappe}<i class="dot"></i>{/if}</span><b>{fmtPct(stats.nappe)}</b></div>
				<div class="dv"><span>Débit été{#if stats.observed.debit}<i class="dot"></i>{/if}</span><b>{fmtPct(stats.debit)}</b></div>
				<div class="dv"><span>Temp.</span><b>{fmtTemp(stats.temp)}</b></div>
			</div>
			<div class="duelcol b">
				<div class="who">{app.compare.name}</div>
				<div class="dn">{jB}</div>
				<div class="du">jours sans arroser{#if statsB.observed.jours}<i class="dot"></i>{/if}</div>
				<div class="minibar"><i style="width:{Math.min(100, (jB / MAX_JOURS) * 100)}%; background:{lvlB[1]}"></i></div>
				<div class="dv"><span>Nappe{#if statsB.observed.nappe}<i class="dot"></i>{/if}</span><b>{fmtPct(statsB.nappe)}</b></div>
				<div class="dv"><span>Débit été{#if statsB.observed.debit}<i class="dot"></i>{/if}</span><b>{fmtPct(statsB.debit)}</b></div>
				<div class="dv"><span>Temp.</span><b>{fmtTemp(statsB.temp)}</b></div>
			</div>
		</div>
	{/if}

	<Coupe />

	<div class="apres">
		<b>Et maintenant ?</b>
		Vérifie tes restrictions sur
		<a href="https://vigieau.gouv.fr" target="_blank" rel="noreferrer">VigiEau</a>
		· récupère l'eau de pluie · envoie ce bulletin à trois personnes.
	</div>
	<button class="shareBtn" onclick={onshare}>📤 Générer ma carte de partage</button>
</div>

<style>
	.card {
		flex: none;
		background: rgba(11, 20, 28, 0.93); border: 1px solid #1e2f3b; border-radius: 14px;
		padding: 15px 18px; backdrop-filter: blur(8px); box-shadow: 0 14px 44px rgba(0, 0, 0, 0.6);
	}
	.loc { font-size: 11px; letter-spacing: 1.8px; color: #6f8898; text-transform: uppercase; }
	.arch { font-size: 11px; color: #4f6a7b; margin-top: 3px; font-style: italic; }
	.arch.obs { color: #35c4b5; }
	.dot {
		display: inline-block; width: 6px; height: 6px; border-radius: 50%;
		background: #35c4b5; margin-left: 4px; vertical-align: middle;
		box-shadow: 0 0 5px rgba(53, 196, 181, 0.9);
	}
	.phrase {
		margin-top: 11px; padding: 9px 12px; border-left: 3px solid #35c4b5; border-radius: 0 8px 8px 0;
		background: rgba(53, 196, 181, 0.07); font-size: 13px; font-style: italic;
		color: #cfe0e9; line-height: 1.55;
	}
	.agebadge {
		display: inline-block; margin-left: 7px; background: #1b2b36; color: #35c4b5;
		font-size: 10.5px; font-weight: 800; padding: 2px 8px; border-radius: 10px;
		letter-spacing: 0.5px; vertical-align: middle; text-transform: none;
	}
	.heronum { display: flex; align-items: baseline; gap: 12px; margin-top: 10px; }
	.heronum .n {
		font-size: 68px; font-weight: 900; line-height: 0.95; color: #ffb347;
		font-variant-numeric: tabular-nums; letter-spacing: -2px;
	}
	.heronum .u { font-size: 13.5px; color: #b7c9d5; max-width: 125px; line-height: 1.35; }
	.vigi { margin-top: 15px; }
	.vigi .lab {
		display: flex; justify-content: space-between; align-items: baseline;
		font-size: 10px; letter-spacing: 1.4px; color: #6f8898; text-transform: uppercase; margin-bottom: 6px;
	}
	.vigi .lvl { font-weight: 900; font-size: 12px; letter-spacing: 1px; }
	.lifebar { height: 13px; border-radius: 7px; background: #08131c; border: 1px solid #1c2b36; overflow: hidden; }
	.lifebar .fill { height: 100%; border-radius: 7px; transition: width 180ms linear, background 400ms; }
	.lifebar.crit { animation: pulse 1.1s infinite; }
	@keyframes pulse { 50% { box-shadow: 0 0 16px rgba(230, 57, 70, 0.85); } }
	.gauges { display: flex; gap: 7px; margin-top: 13px; }
	.g { flex: 1; background: #08131c; border: 1px solid #1c2b36; border-radius: 8px; padding: 8px 9px; }
	.g .l { font-size: 9px; letter-spacing: 1px; color: #6f8898; text-transform: uppercase; }
	.g .v { font-size: 18px; font-weight: 800; margin-top: 3px; color: #ffb347; font-variant-numeric: tabular-nums; }
	.g .v.t { color: #ff6b6b; }
	.g .band { font-size: 9px; color: #5f7d8e; margin-top: 2px; letter-spacing: 0.2px; }
	.g .sub { display: block; font-size: 8px; color: #52697a; letter-spacing: 0.3px; margin-top: 1px; }

	.duelgrid { display: grid; grid-template-columns: 1fr 1fr; gap: 0 14px; margin-top: 10px; }
	.duelcol .who {
		font-size: 11px; font-weight: 800; letter-spacing: 1px; text-transform: uppercase;
		margin-bottom: 4px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
	}
	.duelcol.a .who, .duelcol.a .dn { color: #ffb347; }
	.duelcol.b .who, .duelcol.b .dn { color: #35c4b5; }
	.duelcol .dn { font-size: 40px; font-weight: 900; line-height: 1; font-variant-numeric: tabular-nums; }
	.duelcol .du { font-size: 10.5px; color: #8fa6b4; margin-top: 2px; }
	.duelcol .dv {
		display: flex; justify-content: space-between; font-size: 12px; color: #b7c9d5;
		border-top: 1px solid #1c2b36; padding: 5px 0;
	}
	.duelcol .dv b { font-variant-numeric: tabular-nums; }
	.minibar { height: 7px; border-radius: 4px; background: #08131c; border: 1px solid #1c2b36; margin: 7px 0 9px; overflow: hidden; }
	.minibar i { display: block; height: 100%; border-radius: 4px; transition: width 180ms linear; }

	.apres { margin-top: 14px; padding-top: 11px; border-top: 1px solid #1c2b36; font-size: 12.5px; color: #b7c9d5; line-height: 1.5; }
	.apres b { color: #35c4b5; display: block; margin-bottom: 4px; font-size: 11px; letter-spacing: 1.2px; text-transform: uppercase; }
	.apres a { color: #35c4b5; }
	.shareBtn {
		width: 100%; margin-top: 13px; background: #182a35; color: #e8eef2; border: 1px solid #2a4150;
		border-radius: 8px; font-size: 13px; font-weight: 700; padding: 10px; cursor: pointer; font-family: inherit;
	}
	.shareBtn:hover { border-color: #35c4b5; color: #35c4b5; }
</style>
