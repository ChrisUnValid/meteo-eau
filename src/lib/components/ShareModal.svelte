<script>
	// Carte de partage 1200×630 générée côté client (zéro backend) :
	// silhouette du département en halo doré, chiffre héros, badge vigilance,
	// mention de source obligatoire (règle d'honnêteté des chiffres du design doc).
	import * as d3 from 'd3';
	import { app, Y0, SPAN, fmtPct, fmtTemp, vigiOf } from '$lib/state.svelte.js';
	import { joursAt, lerpSeries } from '$lib/data/archetypes.js';
	import { archOf, deptFeature } from '$lib/data/france.js';

	let { onclose } = $props();
	let canvas;
	let href = $state('');
	let filename = $state('meteo-eau.png');

	$effect(() => {
		if (!canvas) return;
		draw();
	});

	function draw() {
		canvas.width = 1200;
		canvas.height = 630;
		const cx = canvas.getContext('2d');
		const y = app.year, t = (y - Y0) / SPAN;
		const F = "'Helvetica Neue', Helvetica, Arial, sans-serif";

		const gr = cx.createLinearGradient(0, 0, 1200, 630);
		gr.addColorStop(0, `rgb(${Math.round(8 + t * 30)},${Math.round(18 + t * 8)},${Math.round(26 - t * 8)})`);
		gr.addColorStop(1, `rgb(${Math.round(30 + t * 70)},${Math.round(40 + t * 18)},${Math.round(36 - t * 12)})`);
		cx.fillStyle = gr;
		cx.fillRect(0, 0, 1200, 630);

		// silhouette du département, halo doré
		const f = deptFeature(app.dept);
		if (f) {
			const p2 = d3.geoConicConformal().rotate([-3, 0]).fitExtent([[770, 100], [1140, 540]], f);
			const pp = d3.geoPath(p2, cx);
			cx.beginPath(); pp(f);
			cx.fillStyle = 'rgba(255,179,71,.13)'; cx.fill();
			cx.lineWidth = 5; cx.strokeStyle = '#ffb347';
			cx.shadowColor = '#ffb347'; cx.shadowBlur = 26; cx.stroke(); cx.shadowBlur = 0;
		}

		cx.fillStyle = '#e8eef2'; cx.font = '800 30px ' + F;
		cx.fillText("MÉTÉO DE L'EAU", 60, 80);
		cx.fillStyle = '#35c4b5'; cx.font = '600 21px ' + F;
		cx.fillText('le bulletin de ton eau · 1975 → 2075', 60, 112);

		cx.fillStyle = '#e8eef2'; cx.font = '800 54px ' + F;
		cx.fillText(`${app.communeName} · été ${y}`, 60, 212);

		const arch = archOf(app.dept);
		const j = joursAt(arch, y), v = vigiOf(j);
		cx.fillStyle = '#ffb347'; cx.font = '900 190px ' + F;
		cx.fillText(j, 54, 408);
		const w = cx.measureText(String(j)).width;
		cx.fillStyle = '#e8eef2'; cx.font = '700 36px ' + F;
		cx.fillText('jours sans', 86 + w, 352);
		cx.fillText('arroser', 86 + w, 396);

		cx.fillStyle = v[1];
		cx.beginPath(); cx.roundRect(60, 442, 350, 58, 12); cx.fill();
		cx.fillStyle = '#04121a'; cx.font = '800 27px ' + F;
		cx.fillText('VIGILANCE ' + v[0], 86, 481);

		cx.fillStyle = '#b7c9d5'; cx.font = '600 25px ' + F;
		cx.fillText(
			`nappe ${fmtPct(lerpSeries(arch.series.nappe, y))} · débit été ${fmtPct(lerpSeries(arch.series.debit, y))} · ${fmtTemp(lerpSeries(arch.series.temp, y))}C`,
			60, 552
		);

		cx.fillStyle = 'rgba(232,238,242,.55)'; cx.font = '500 19px ' + F;
		cx.fillText("Projection simulée, calibrée sur Explore2 (INRAE / Météo-France) et Hub'Eau", 60, 600);

		const slug = app.communeName.toLowerCase().normalize('NFD')
			.replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
		filename = `meteo-eau-${slug}-${y}.png`;
		href = canvas.toDataURL('image/png');
	}
</script>

<div class="shareModal" onclick={(e) => e.target === e.currentTarget && onclose()} role="presentation">
	<div class="sharebox">
		<h3>Ta carte de partage — envoie le choc à trois personnes</h3>
		<canvas bind:this={canvas}></canvas>
		<div class="sharerow">
			<a {href} download={filename}>Télécharger l'image</a>
			<button class="ghost" onclick={onclose}>Fermer</button>
		</div>
	</div>
</div>

<style>
	.shareModal {
		position: fixed; inset: 0; z-index: 20; display: flex; align-items: center; justify-content: center;
		background: rgba(3, 8, 12, 0.8); backdrop-filter: blur(4px);
	}
	.sharebox {
		background: #0b141c; border: 1px solid #22333f; border-radius: 16px;
		padding: 20px; width: min(680px, 92vw);
	}
	h3 { font-size: 15px; margin: 0 0 12px; letter-spacing: 0.5px; font-weight: 700; }
	canvas { width: 100%; border-radius: 10px; display: block; }
	.sharerow { display: flex; gap: 10px; margin-top: 14px; }
	.sharerow a, .sharerow button {
		flex: 1; text-align: center; background: #35c4b5; color: #04121a; border: none;
		border-radius: 8px; font-size: 13.5px; font-weight: 800; padding: 11px;
		cursor: pointer; font-family: inherit; text-decoration: none;
	}
	.sharerow .ghost { background: transparent; border: 1px solid #2a4150; color: #8fa6b4; }
</style>
