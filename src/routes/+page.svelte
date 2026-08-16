<script>
	import { onMount } from 'svelte';
	import { app, geo, Y0, SPAN } from '$lib/state.svelte.js';
	import { rewindWorld, countHighStress } from '$lib/data/world.js';
	import Globe from '$lib/components/Globe.svelte';
	import FranceMap from '$lib/components/FranceMap.svelte';
	import InputsPanel from '$lib/components/InputsPanel.svelte';
	import BulletinCard from '$lib/components/BulletinCard.svelte';
	import Timeline from '$lib/components/Timeline.svelte';
	import CountryCard from '$lib/components/CountryCard.svelte';
	import ShareModal from '$lib/components/ShareModal.svelte';

	let shareOpen = $state(false);
	let starsCanvas;

	onMount(async () => {
		const [depts, world] = await Promise.all([
			fetch('/data/depts.geojson').then((r) => r.json()),
			fetch('/data/world.geojson').then((r) => r.json())
		]);
		geo.DEPTS = depts;
		geo.WORLD = rewindWorld(world);
		app.geoReady = true;

		// étoiles
		const ctx = starsCanvas.getContext('2d');
		const draw = () => {
			starsCanvas.width = innerWidth;
			starsCanvas.height = innerHeight;
			ctx.clearRect(0, 0, innerWidth, innerHeight);
			for (let i = 0; i < 220; i++) {
				const x = Math.random() * innerWidth, y = Math.random() * innerHeight;
				ctx.fillStyle = `rgba(200,225,240,${0.15 + Math.random() * 0.55})`;
				ctx.beginPath();
				ctx.arc(x, y, Math.random() * 1.25, 0, 7);
				ctx.fill();
			}
		};
		draw();
		addEventListener('resize', draw);
		return () => removeEventListener('resize', draw);
	});

	// fond de page qui s'assèche avec les années
	const bg = $derived.by(() => {
		const t = (app.year - Y0) / SPAN;
		const c1 = [5 + t * 34, 16 + t * 8, 22 - t * 7].map(Math.round);
		const c2 = [14 + t * 74, 32 + t * 20, 34 - t * 12].map(Math.round);
		return `radial-gradient(ellipse at 60% 40%, rgb(${c2}) 0%, rgb(${c1}) 70%)`;
	});

	const worldCount = $derived(app.geoReady ? countHighStress(geo.WORLD, app.year) : 0);

	function onCountryPick(f) {
		app.countryId = f ? f.id : null;
	}
</script>

<svelte:head>
	<title>Météo de l'Eau — le bulletin de ton eau, 1975 → 2075</title>
</svelte:head>

<div id="bg" style="background:{bg}"></div>
<canvas id="stars" bind:this={starsCanvas} class:dim={app.view === 'france'}></canvas>

{#if app.geoReady}
	<Globe oncountrypick={onCountryPick} />
	<FranceMap />

	<div class="brand">
		<div class="w">Météo <span>de l'Eau</span></div>
		<div class="s">le bulletin de ton eau · 1975 → 2075</div>
	</div>

	<div class="leftcol">
		<InputsPanel />
		<BulletinCard onshare={() => (shareOpen = true)} />
	</div>

	{#if app.view === 'world'}
		<div class="worldstat">
			<div class="h">Le monde en {app.year}</div>
			<div class="n">{worldCount}</div>
			<div class="l">pays en stress hydrique élevé — fais tourner le globe, clique un pays</div>
		</div>
		<button
			class="rotBtn"
			onclick={() => (app.autoRotate = !app.autoRotate)}
			title={app.autoRotate ? 'Mettre la rotation en pause' : 'Relancer la rotation'}
		>
			{app.autoRotate ? '⏸ Pause rotation' : '▶ Rotation auto'}
		</button>
	{/if}

	<CountryCard />

	<div class="legend">
		stress hydrique simulé
		<div class="bar"></div>
		<div class="lr"><span>faible</span><span>critique</span></div>
	</div>

	<div class="toggle">
		<button class:on={app.view === 'world'} onclick={() => (app.view = 'world')}>🌍 Le monde</button>
		<button class:on={app.view === 'france'} onclick={() => (app.view = 'france')}>🇫🇷 Chez moi</button>
	</div>

	{#if app.toast}
		<div class="toast">⚠ {app.toast}</div>
	{/if}

	<Timeline />

	<div class="src">
		Projection simulée, calibrée sur
		<a href="https://www.drias-eau.fr" target="_blank" rel="noreferrer">Explore2 (INRAE / Météo-France)</a>
		et
		<a href="https://hubeau.eaufrance.fr" target="_blank" rel="noreferrer">Hub'Eau</a>
		— <a href="https://github.com/ChrisUnValid/meteo-eau#doù-viennent-ces-chiffres-" target="_blank" rel="noreferrer">d'où viennent ces chiffres&nbsp;?</a>
	</div>

	{#if shareOpen}
		<ShareModal onclose={() => (shareOpen = false)} />
	{/if}
{:else}
	<div class="loading">Chargement des cartes…</div>
{/if}

<style>
	#bg { position: fixed; inset: 0; z-index: 0; transition: background 700ms ease; }
	#stars { position: fixed; inset: 0; z-index: 1; opacity: 0.9; transition: opacity 650ms ease; }
	#stars.dim { opacity: 0.25; }

	.brand { position: fixed; top: 22px; left: 24px; z-index: 5; }
	.brand .w { font-weight: 800; letter-spacing: 2.5px; font-size: 14px; text-transform: uppercase; }
	.brand .w span { color: #35c4b5; }
	.brand .s { font-size: 11px; color: #6f8898; margin-top: 3px; letter-spacing: 0.5px; }

	.leftcol {
		position: fixed; z-index: 5; top: 66px; left: 24px; width: 340px; bottom: 172px;
		display: flex; flex-direction: column; gap: 12px; overflow-y: auto; overflow-x: hidden;
		scrollbar-width: none;
	}
	.leftcol::-webkit-scrollbar { width: 0; }

	.worldstat { position: fixed; top: 22px; right: 24px; text-align: right; z-index: 5; }
	.worldstat .h { font-size: 10px; letter-spacing: 2px; text-transform: uppercase; color: #6f8898; margin-bottom: 6px; }
	.worldstat .n { font-size: 62px; font-weight: 900; color: #ffb347; line-height: 1; font-variant-numeric: tabular-nums; }
	.worldstat .l { font-size: 12px; color: #b7c9d5; max-width: 230px; line-height: 1.4; margin-top: 5px; margin-left: auto; }
	.rotBtn {
		position: fixed; top: 168px; right: 24px; z-index: 5;
		background: rgba(11, 20, 28, 0.92); border: 1px solid #2a4150; color: #8fa6b4;
		border-radius: 18px; font-size: 12px; font-weight: 700; padding: 7px 14px;
		cursor: pointer; font-family: inherit; letter-spacing: 0.3px;
	}
	.rotBtn:hover { border-color: #35c4b5; color: #35c4b5; }

	.legend {
		position: fixed; bottom: 152px; right: 24px; z-index: 5;
		background: rgba(11, 20, 28, 0.92); border: 1px solid #1e2f3b; border-radius: 10px;
		padding: 9px 12px; font-size: 10px; color: #6f8898; letter-spacing: 0.4px;
	}
	.legend .bar {
		width: 136px; height: 7px; border-radius: 4px; margin: 7px 0 3px;
		background: linear-gradient(90deg, #1d6e64, #b98f3e, #a8481f);
	}
	.legend .lr { display: flex; justify-content: space-between; }

	.toggle {
		position: fixed; bottom: 152px; left: 50%; transform: translateX(-50%); z-index: 5;
		display: flex; background: rgba(11, 20, 28, 0.92); border: 1px solid #1e2f3b;
		border-radius: 22px; padding: 4px; gap: 3px;
	}
	.toggle button {
		background: transparent; border: none; color: #8fa6b4; font-size: 12.5px; font-weight: 700;
		padding: 8px 18px; border-radius: 18px; cursor: pointer; font-family: inherit; letter-spacing: 0.4px;
	}
	.toggle button.on { background: #35c4b5; color: #04121a; }

	.toast {
		position: fixed; top: 26px; left: 50%; transform: translateX(-50%); z-index: 8;
		background: #e63946; color: #fff; font-weight: 800; font-size: 13px; letter-spacing: 0.8px;
		padding: 10px 22px; border-radius: 22px; box-shadow: 0 10px 34px rgba(230, 57, 70, 0.55);
		pointer-events: none;
	}

	.src { position: fixed; bottom: 4px; left: 0; right: 0; text-align: center; font-size: 9.5px; color: #4a606e; z-index: 5; }
	.src a { color: #4a606e; }

	.loading {
		position: fixed; inset: 0; display: flex; align-items: center; justify-content: center;
		color: #6f8898; font-size: 14px; letter-spacing: 1px; z-index: 5;
	}

	@media (max-width: 900px) {
		.leftcol { width: calc(100vw - 32px); left: 16px; top: 58px; bottom: 170px; }
		.worldstat { display: none; }
	}
</style>
