<script>
	// Panneau d'entrée : code postal + année de naissance, comparaison optionnelle.
	import { app } from '$lib/state.svelte.js';
	import { submitForm } from '$lib/data/france.js';

	let cp = $state(app.cp);
	let birth = $state(String(app.birth));
	let cp2 = $state('');
	let compareOpen = $state(false);
	let error = $state('');

	function submit() {
		error = submitForm(cp, birth, cp2, compareOpen) || '';
	}
	function toggleCompare() {
		if (compareOpen) {
			compareOpen = false;
			cp2 = '';
			app.compare = null;
			return;
		}
		compareOpen = true;
	}
	function removeCompare() {
		compareOpen = false;
		cp2 = '';
		app.compare = null;
	}
	const onEnter = (e) => { if (e.key === 'Enter') submit(); };
</script>

<div class="inputs">
	<div class="row2">
		<div class="field">
			<label for="cp">Ton code postal</label>
			<input id="cp" type="text" inputmode="numeric" maxlength="5" bind:value={cp} onkeydown={onEnter} placeholder="30000" />
		</div>
		<div class="field">
			<label for="by">Année de naissance</label>
			<input id="by" type="number" min="1900" max="2026" bind:value={birth} onkeydown={onEnter} placeholder="1992" />
		</div>
	</div>
	<button class="go" onclick={submit}>Voir mon bulletin</button>
	{#if error}<div class="err">{error}</div>{/if}
	<button class="cmpToggle" onclick={toggleCompare}>
		{compareOpen ? '✕ Retirer la comparaison' : '⇄ Comparer avec une autre commune'}
	</button>
	{#if compareOpen}
		<div class="cmpRow">
			<div class="field">
				<label for="cp2">Commune à comparer</label>
				<input id="cp2" type="text" inputmode="numeric" maxlength="5" bind:value={cp2} onkeydown={onEnter} placeholder="13001" />
			</div>
			<button class="rm" onclick={removeCompare} title="Retirer la comparaison">✕</button>
		</div>
	{/if}
</div>

<style>
	.inputs {
		flex: none;
		background: rgba(11, 20, 28, 0.92); border: 1px solid #1e2f3b; border-radius: 14px;
		padding: 14px; backdrop-filter: blur(8px);
	}
	.field label {
		display: block; font-size: 10px; letter-spacing: 1.6px; text-transform: uppercase;
		color: #6f8898; margin-bottom: 5px;
	}
	.field input {
		width: 100%; background: #08131c; border: 1px solid #22333f; border-radius: 8px;
		color: #e8eef2; font-size: 16px; padding: 10px 12px; outline: none; font-family: inherit;
		box-sizing: border-box;
	}
	.field input:focus { border-color: #35c4b5; }
	.row2 { display: flex; gap: 10px; }
	.row2 .field { flex: 1; }
	.go {
		width: 100%; margin-top: 11px; background: #35c4b5; color: #04121a; border: none; border-radius: 8px;
		font-size: 14px; font-weight: 800; letter-spacing: 0.5px; padding: 11px; cursor: pointer; font-family: inherit;
	}
	.go:hover { filter: brightness(1.12); }
	.err { font-size: 12px; color: #ff7a7a; margin-top: 9px; line-height: 1.4; }
	.cmpToggle {
		margin-top: 9px; background: none; border: none; color: #35c4b5; font-size: 12px;
		cursor: pointer; font-family: inherit; padding: 0; letter-spacing: 0.3px;
	}
	.cmpToggle:hover { text-decoration: underline; }
	.cmpRow { display: flex; margin-top: 10px; gap: 8px; align-items: flex-end; }
	.cmpRow .field { flex: 1; }
	.cmpRow .rm {
		background: #182a35; border: 1px solid #22333f; color: #8fa6b4; border-radius: 8px;
		width: 38px; height: 38px; font-size: 15px; cursor: pointer;
	}
</style>
