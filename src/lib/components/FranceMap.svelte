<script>
	// Carte de France D3 : 96 départements colorés par archétype, halos or/turquoise,
	// infobulle au survol, clic pour changer de territoire.
	import { onMount } from 'svelte';
	import * as d3 from 'd3';
	import { app, geo } from '$lib/state.svelte.js';
	import { franceColor, deptStress, applyLocation } from '$lib/data/france.js';
	import { DEPT_TO_ARCH } from '$lib/data/archetypes.js';
	import { statsAt } from '$lib/data/series.js';

	let svgEl;
	let tip = $state({ show: false, x: 0, y: 0, nom: '', jours: 0, arch: '' });

	let fproj, fpath, deptSel, haloSel, haloSelB;

	function build() {
		const W = innerWidth, H = innerHeight;
		const svg = d3.select(svgEl);
		svg.attr('viewBox', `0 0 ${W} ${H}`);
		fproj = d3.geoConicConformal().rotate([-3, 0]).fitExtent([[W * 0.31, 40], [W - 40, H - 150]], geo.DEPTS);
		fpath = d3.geoPath(fproj);
		svg.selectAll('*').remove();
		deptSel = svg.append('g').selectAll('path').data(geo.DEPTS.features).join('path')
			.attr('class', 'dept').attr('d', fpath)
			.on('mousemove', (e, f) => {
				const a = DEPT_TO_ARCH[f.properties.code];
				const s = a ? statsAt(f.properties.code, app.year) : null;
				tip = {
					show: true, x: e.clientX + 16, y: e.clientY - 12,
					nom: f.properties.nom,
					jours: s ? s.jours : 0,
					arch: s && s.observed.jours ? 'arrêtés observés · VigiEau' : a ? a.label : ''
				};
			})
			.on('mouseleave', () => (tip.show = false))
			.on('click', (e, f) => {
				const code = f.properties.code;
				if (!DEPT_TO_ARCH[code]) return;
				app.cp = code === '2A' ? '20000' : code === '2B' ? '20200' : code + '000';
				applyLocation(code, f.properties.nom, null);
			});
		haloSelB = svg.append('path').attr('fill', 'none')
			.attr('stroke', '#35c4b5').attr('stroke-width', 3)
			.attr('filter', 'drop-shadow(0 0 9px #35c4b5)');
		haloSel = svg.append('path').attr('fill', 'none')
			.attr('stroke', '#ffb347').attr('stroke-width', 3)
			.attr('filter', 'drop-shadow(0 0 9px #ffb347)');
	}

	function paint() {
		if (!deptSel) return;
		deptSel.attr('fill', (f) => franceColor(deptStress(f.properties.code, app.year)));
		const f = geo.DEPTS.features.find((d) => d.properties.code === app.dept);
		haloSel.attr('d', f ? fpath(f) : null);
		const fB = app.compare ? geo.DEPTS.features.find((d) => d.properties.code === app.compare.dept) : null;
		haloSelB.attr('d', fB ? fpath(fB) : null);
	}

	function pinPos(lonlat, dept) {
		if (!fproj) return null;
		const f = geo.DEPTS.features.find((d) => d.properties.code === dept);
		return (lonlat && fproj(lonlat)) || (f && fproj(d3.geoCentroid(f))) || null;
	}
	let rebuilt = $state(0);
	let pinA = $derived.by(() => {
		void app.dept; void app.lonlat; void rebuilt;
		return app.view === 'france' ? pinPos(app.lonlat, app.dept) : null;
	});
	let pinB = $derived.by(() => {
		void app.compare; void rebuilt;
		return app.view === 'france' && app.compare ? pinPos(app.compare.lonlat, app.compare.dept) : null;
	});

	onMount(() => {
		build();
		paint();
		const onResize = () => { build(); paint(); rebuilt++; };
		addEventListener('resize', onResize);
		return () => removeEventListener('resize', onResize);
	});

	$effect(() => {
		void app.year; void app.dept; void app.compare;
		paint();
	});
</script>

<div id="france" class:on={app.view === 'france'}>
	<svg bind:this={svgEl}></svg>
</div>

{#if pinA}
	<div class="pin pinA" style="left:{pinA[0]}px; top:{pinA[1]}px">
		<div class="lbl">{app.communeName.toUpperCase()}</div>
		<div class="dot"></div>
	</div>
{/if}
{#if pinB}
	<div class="pin pinB" style="left:{pinB[0]}px; top:{pinB[1]}px">
		<div class="lbl">{app.compare.name.toUpperCase()}</div>
		<div class="dot"></div>
	</div>
{/if}

{#if tip.show && app.view === 'france'}
	<div class="tip" style="left:{tip.x}px; top:{tip.y}px">
		<b>{tip.nom}</b><br />
		{tip.jours} jours sans arroser · été {app.year}<br />
		<span class="muted">{tip.arch}</span>
	</div>
{/if}

<style>
	#france {
		position: fixed; inset: 0; z-index: 2; opacity: 0; pointer-events: none;
		transition: opacity 650ms ease;
	}
	#france.on { opacity: 1; pointer-events: auto; }
	#france svg { width: 100vw; height: 100vh; }
	#france :global(.dept) { stroke: #050b12; stroke-width: 0.6; cursor: pointer; transition: opacity 0.12s; }
	#france :global(.dept:hover) { opacity: 0.7; stroke: #fff; stroke-width: 1.6; }

	.tip {
		position: fixed; pointer-events: none; z-index: 9;
		background: rgba(5, 17, 25, 0.96); border: 1px solid #35c4b5; border-radius: 8px;
		padding: 7px 11px; font-size: 12px; line-height: 1.5;
	}
	.tip b { color: #ffb347; }
	.tip .muted { color: #6f8898; }

	.pin {
		position: fixed; pointer-events: none; z-index: 6;
		transform: translate(-50%, -100%);
	}
	.pin .dot { width: 11px; height: 11px; border-radius: 50%; border: 2.5px solid #fff; margin: 0 auto; }
	.pinA .dot { background: #ffb347; box-shadow: 0 0 14px rgba(255, 179, 71, 0.95); }
	.pinB .dot { background: #35c4b5; box-shadow: 0 0 14px rgba(53, 196, 181, 0.95); }
	.pin .lbl {
		color: #04121a; font-size: 10.5px; font-weight: 800; letter-spacing: 0.5px;
		padding: 3px 8px; border-radius: 4px; margin-bottom: 5px; white-space: nowrap;
	}
	.pinA .lbl { background: #ffb347; }
	.pinB .lbl { background: #35c4b5; }
</style>
