<script>
	// Globe SVG — projection orthographique D3, 100 % vectoriel : net à toutes les tailles,
	// aucun besoin de WebGL. Rotation auto pilotée par app.autoRotate (bouton pause),
	// drag pour tourner, molette pour zoomer, clic (< 6 px de déplacement) pour un pays.
	import { onMount } from 'svelte';
	import * as d3 from 'd3';
	import { app, geo, selectedCountry, reducedMotion } from '$lib/state.svelte.js';
	import { worldStress, countryAt } from '$lib/data/world.js';
	import { stressColor } from '$lib/data/france.js';

	let host, svgEl, pinEl, pinBEl;
	let markDirty = () => {};

	let { oncountrypick } = $props();

	onMount(() => {
		if (reducedMotion()) app.autoRotate = false;

		const svg = d3.select(svgEl);
		const proj = d3.geoOrthographic().clipAngle(90);
		const path = d3.geoPath(proj);
		if (typeof path.digits === 'function') path.digits(1); // chemins plus courts, DOM plus léger
		const graticule = d3.geoGraticule10();
		const sphere = { type: 'Sphere' };

		/* ---- calques (ordre de peinture) ---- */
		const defs = svg.append('defs');
		const og = defs.append('radialGradient').attr('id', 'oceang')
			.attr('cx', '38%').attr('cy', '32%').attr('r', '78%');
		og.append('stop').attr('offset', '0%').attr('stop-color', '#14405a');
		og.append('stop').attr('offset', '65%').attr('stop-color', '#0a2233');
		og.append('stop').attr('offset', '100%').attr('stop-color', '#071826');
		const ag = defs.append('radialGradient').attr('id', 'atmog');
		ag.append('stop').attr('offset', '78%').attr('stop-color', 'rgba(53,196,181,0)');
		ag.append('stop').attr('offset', '84%').attr('stop-color', 'rgba(53,196,181,.28)');
		ag.append('stop').attr('offset', '100%').attr('stop-color', 'rgba(53,196,181,0)');
		const sg = defs.append('radialGradient').attr('id', 'shadeg')
			.attr('cx', '38%').attr('cy', '32%').attr('r', '80%');
		sg.append('stop').attr('offset', '0%').attr('stop-color', 'rgba(255,255,255,.10)');
		sg.append('stop').attr('offset', '52%').attr('stop-color', 'rgba(255,255,255,0)');
		sg.append('stop').attr('offset', '86%').attr('stop-color', 'rgba(2,10,16,.22)');
		sg.append('stop').attr('offset', '100%').attr('stop-color', 'rgba(2,10,16,.5)');

		const atmo = svg.append('circle').attr('fill', 'url(#atmog)').attr('pointer-events', 'none');
		const ocean = svg.append('path').attr('fill', 'url(#oceang)');
		const grat = svg.append('path').attr('fill', 'none')
			.attr('stroke', 'rgba(160,205,225,.09)').attr('stroke-width', 0.6);
		const landSel = svg.append('g').selectAll('path').data(geo.WORLD.features).join('path')
			.attr('stroke', 'rgba(5,20,30,.85)').attr('stroke-width', 0.5).attr('stroke-linejoin', 'round');
		const selStroke = svg.append('path').attr('fill', 'none')
			.attr('stroke', '#ffb347').attr('stroke-width', 2.5).attr('stroke-linejoin', 'round')
			.attr('filter', 'drop-shadow(0 0 6px rgba(255,179,71,.8))').attr('pointer-events', 'none');
		const shade = svg.append('circle').attr('fill', 'url(#shadeg)').attr('pointer-events', 'none');
		const rim = svg.append('circle').attr('fill', 'none')
			.attr('stroke', 'rgba(53,196,181,.5)').attr('stroke-width', 1.4).attr('pointer-events', 'none');

		/* ---- état du rendu ---- */
		let rot = -10, tilt = -12, scaleK = 0.34;
		let dragging = false, lastX = 0, lastY = 0, downX = 0, downY = 0, idle = 0;
		let dirty = true, lastFrame = 0, disposed = false;
		let colors = [], colorYear = null;
		function ensureColors(y) {
			if (colorYear === y) return false;
			colorYear = y;
			colors = geo.WORLD.features.map((f) => stressColor(worldStress(f, y)));
			return true;
		}

		function size() {
			const W = innerWidth, H = innerHeight;
			svg.attr('viewBox', `0 0 ${W} ${H}`);
			const R = Math.min(W, H) * scaleK;
			proj.translate([W / 2, H / 2]).scale(R);
			atmo.attr('cx', W / 2).attr('cy', H / 2).attr('r', R * 1.24);
			shade.attr('cx', W / 2).attr('cy', H / 2).attr('r', R);
			rim.attr('cx', W / 2).attr('cy', H / 2).attr('r', R);
			ocean.attr('d', path(sphere)); // la silhouette de la sphère ne dépend pas de la rotation
			dirty = true;
		}
		size();
		addEventListener('resize', size);

		/* ---- interactions ---- */
		host.addEventListener('pointerdown', (e) => {
			dragging = true;
			lastX = downX = e.clientX;
			lastY = downY = e.clientY;
			idle = 0;
			host.classList.add('grabbing');
			host.setPointerCapture(e.pointerId);
		});
		host.addEventListener('pointermove', (e) => {
			if (!dragging) return;
			rot += (e.clientX - lastX) * 0.32;
			tilt = Math.max(-70, Math.min(70, tilt + (e.clientY - lastY) * 0.22));
			lastX = e.clientX;
			lastY = e.clientY;
			idle = 0;
			dirty = true;
		});
		const stopDrag = () => { dragging = false; host.classList.remove('grabbing'); };
		host.addEventListener('pointerup', (e) => {
			stopDrag();
			if (Math.hypot(e.clientX - downX, e.clientY - downY) >= 6) return;
			const ll = proj.invert([e.clientX, e.clientY]);
			// invert peut répondre hors sphère : on reprojette pour valider le point
			const back = ll && proj(ll);
			if (!back || Math.hypot(back[0] - e.clientX, back[1] - e.clientY) > 2) { oncountrypick?.(null); return; }
			oncountrypick?.(countryAt(geo.WORLD, ll));
			dirty = true;
		});
		host.addEventListener('pointercancel', stopDrag);
		host.addEventListener('wheel', (e) => {
			e.preventDefault();
			scaleK = Math.max(0.22, Math.min(0.8, scaleK - e.deltaY * 0.0005));
			size();
		}, { passive: false });

		/* ---- boucle de rendu (~30 fps, uniquement si nécessaire) ---- */
		function frame(ts) {
			if (disposed) return;
			requestAnimationFrame(frame);
			if (app.view !== 'world') return;
			if (ts - lastFrame < 33) return;
			lastFrame = ts;
			if (!dragging && app.autoRotate) { idle++; if (idle > 45) { rot += 0.18; dirty = true; } }
			if (!dirty) return;
			dirty = false;

			proj.rotate([rot, tilt]);
			const yearChanged = ensureColors(app.year);
			landSel.attr('d', path);
			if (yearChanged) landSel.attr('fill', (f, i) => colors[i]);
			grat.attr('d', path(graticule));
			const sel = selectedCountry();
			selStroke.attr('d', sel ? path(sel) : null);

			const place = (el, lonlat) => {
				if (!el) return;
				if (!lonlat) { el.style.opacity = 0; return; }
				const p = proj(lonlat);
				const vis = p && d3.geoDistance([-rot, -tilt], lonlat) < Math.PI / 2;
				if (p) { el.style.left = p[0] + 'px'; el.style.top = p[1] + 'px'; }
				el.style.opacity = vis ? 1 : 0;
			};
			place(pinEl, app.lonlat);
			place(pinBEl, app.compare ? app.compare.lonlat : null);
		}
		requestAnimationFrame(frame);

		// premier passage des couleurs (yearChanged sera vrai à la première frame)
		markDirty = () => { colorYear = null; dirty = true; };

		return () => {
			disposed = true;
			removeEventListener('resize', size);
		};
	});

	// l'année, le pays sélectionné, le lieu ou la comparaison changent → redessiner
	$effect(() => {
		void app.year;
		void app.countryId;
		void app.lonlat;
		void app.compare;
		markDirty();
	});
</script>

<div id="globe" bind:this={host} class:hidden={app.view !== 'world'}>
	<svg bind:this={svgEl}></svg>
</div>

<div class="pin pinA" bind:this={pinEl} class:off={app.view !== 'world'}>
	<div class="lbl">{app.communeName.toUpperCase()}</div>
	<div class="dot"></div>
</div>
<div class="pin pinB" bind:this={pinBEl} class:off={app.view !== 'world' || !app.compare}>
	<div class="lbl">{app.compare ? app.compare.name.toUpperCase() : ''}</div>
	<div class="dot"></div>
</div>

<style>
	#globe {
		position: fixed; inset: 0; z-index: 2; cursor: grab;
		transition: opacity 650ms ease;
	}
	#globe.hidden { opacity: 0; pointer-events: none; }
	#globe:global(.grabbing) { cursor: grabbing; }
	#globe svg { width: 100vw; height: 100vh; display: block; }

	.pin {
		position: fixed; pointer-events: none; z-index: 6; opacity: 0;
		transition: opacity 0.3s; transform: translate(-50%, -100%);
	}
	.pin.off { opacity: 0 !important; }
	.pin .dot {
		width: 11px; height: 11px; border-radius: 50%; border: 2.5px solid #fff; margin: 0 auto;
	}
	.pinA .dot { background: #ffb347; box-shadow: 0 0 14px rgba(255, 179, 71, 0.95); }
	.pinB .dot { background: #35c4b5; box-shadow: 0 0 14px rgba(53, 196, 181, 0.95); }
	.pin .lbl {
		color: #04121a; font-size: 10.5px; font-weight: 800; letter-spacing: 0.5px;
		padding: 3px 8px; border-radius: 4px; margin-bottom: 5px; white-space: nowrap;
	}
	.pinA .lbl { background: #ffb347; }
	.pinB .lbl { background: #35c4b5; }
</style>
