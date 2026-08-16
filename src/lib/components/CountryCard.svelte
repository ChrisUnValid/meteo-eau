<script>
	// Fiche pays : stress de l'année, badge de niveau, année de bascule en stress élevé.
	import { app, Y1, selectedCountry } from '$lib/state.svelte.js';
	import { worldStress, stressCat, firstHighYear, countryLabel } from '$lib/data/world.js';

	const f = $derived(selectedCountry());
	const s = $derived(f ? worldStress(f, app.year) : 0);
	const cat = $derived(stressCat(s));
	const fy = $derived(f ? firstHighYear(f, Y1) : null);

	function close() {
		app.countryId = null;
	}
	function goFrance() {
		close();
		app.view = 'france';
	}
</script>

{#if f && app.view === 'world'}
	<div class="countryCard">
		<button class="cx" onclick={close}>✕</button>
		<div class="cn">{countryLabel(f)}</div>
		<span class="cb" style="background:{cat[1]}22; color:{cat[1]}; border:1px solid {cat[1]}">
			stress {cat[0]}
		</span>
		<div class="cs">
			Stress hydrique {app.year} : <b>{Math.round(s * 100)}%</b><br />
			{#if fy === null}
				Reste sous le seuil critique d'ici 2075.
			{:else if fy <= app.year}
				En stress élevé depuis {fy <= 1975 ? 'avant 1975' : fy}.
			{:else}
				Passera en stress élevé vers <b>{fy}</b>.
			{/if}
		</div>
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
	.cs { font-size: 12.5px; color: #b7c9d5; margin-top: 9px; line-height: 1.5; }
	.cs b { color: #ffb347; }
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
