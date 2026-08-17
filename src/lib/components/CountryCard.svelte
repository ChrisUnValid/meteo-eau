<script>
	// Fiche pays : stress hydrique WRI Aqueduct 4.0 — catégorie, année de bascule
	// en stress élevé, fourchette de scénarios 2050.
	import { app, Y1, selectedCountry } from '$lib/state.svelte.js';
	import {
		worldStress, stressCat, firstHighYear, countryLabel, countryScore, aqueductFor
	} from '$lib/data/world.js';

	const f = $derived(selectedCountry());
	const s = $derived(f ? worldStress(f, app.year) : null);
	const cat = $derived(s == null ? null : stressCat(s));
	const fy = $derived(f ? firstHighYear(f, Y1) : null);
	const aq = $derived(f ? aqueductFor(f.id) : null);
	const score = $derived(f ? countryScore(f.id, app.year) : null);

	// Les catégories du WRI sont des parts de la ressource prélevée.
	const partPrelevee = (sc) =>
		sc == null ? null
		: sc < 1 ? 'moins de 10 %'
		: sc < 2 ? '10 à 20 %'
		: sc < 3 ? '20 à 40 %'
		: sc < 4 ? '40 à 80 %'
		: 'plus de 80 %';

	function close() { app.countryId = null; }
	function goFrance() { close(); app.view = 'france'; }
</script>

{#if f && app.view === 'world'}
	<div class="countryCard">
		<button class="cx" onclick={close}>✕</button>
		<div class="cn">{countryLabel(f)}</div>

		{#if !aq}
			<span class="cb nodata">données indisponibles</span>
			<div class="cs">Ce pays n'est pas couvert par les classements Aqueduct.</div>
		{:else}
			<span class="cb" style="background:{cat[1]}22; color:{cat[1]}; border:1px solid {cat[1]}">
				stress {cat[0]}
			</span>
			<div class="cs">
				<b>{partPrelevee(score)}</b> de l'eau disponible est prélevée
				{#if app.year > 2020}<span class="muted">(projection {app.year})</span>{/if}
				<br />
				{#if fy === null}
					Reste sous le seuil de stress élevé d'ici 2080.
				{:else if fy <= 2020}
					En stress élevé dès la référence 1979-2019.
				{:else if fy <= app.year}
					Bascule en stress élevé vers {fy}.
				{:else}
					Passerait en stress élevé vers <b>{fy}</b>.
				{/if}
				{#if aq.opt2050 != null && aq.pes2050 != null}
					<div class="scen">
						2050 selon le scénario : {partPrelevee(aq.opt2050)} (optimiste) …
						{partPrelevee(aq.pes2050)} (pessimiste)
					</div>
				{/if}
			</div>
		{/if}

		{#if f.id === 'FRA'}
			<button class="cfr" onclick={goFrance}>Voir la France en détail →</button>
		{/if}
	</div>
{/if}

<style>
	.countryCard {
		position: fixed; top: 216px; right: 24px; width: 250px; z-index: 5;
		background: rgba(11, 20, 28, 0.94); border: 1px solid #1e2f3b; border-radius: 12px;
		padding: 14px 16px; box-shadow: 0 14px 44px rgba(0, 0, 0, 0.6);
	}
	.cn { font-size: 16px; font-weight: 800; padding-right: 18px; }
	.cb {
		display: inline-block; margin-top: 7px; font-size: 10.5px; font-weight: 800;
		letter-spacing: 1px; padding: 3px 9px; border-radius: 10px; text-transform: uppercase;
	}
	.cb.nodata { background: #3a4a5522; color: #8fa6b4; border: 1px solid #3a4a55; }
	.cs { font-size: 12.5px; color: #b7c9d5; margin-top: 9px; line-height: 1.5; }
	.cs b { color: #ffb347; }
	.cs .muted { color: #6f8898; }
	.scen { margin-top: 7px; padding-top: 7px; border-top: 1px solid #1c2b36; font-size: 11px; color: #8fa6b4; }
	.cx {
		position: absolute; top: 9px; right: 12px; background: none; border: none;
		color: #6f8898; font-size: 15px; cursor: pointer;
	}
	.cfr {
		width: 100%; margin-top: 10px; background: #182a35; border: 1px solid #2a4150; color: #35c4b5;
		border-radius: 7px; font-size: 12px; font-weight: 700; padding: 8px; cursor: pointer; font-family: inherit;
	}
	@media (max-width: 900px) {
		.countryCard { top: auto; bottom: 230px; }
	}
</style>
