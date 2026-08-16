<script>
	// Coupe de la nappe phréatique : le niveau d'eau descend avec les années.
	// Clapotis animé (~15 fps), coupé par prefers-reduced-motion.
	import { onMount } from 'svelte';
	import { app, fmtPct, reducedMotion } from '$lib/state.svelte.js';
	import { lerpSeries } from '$lib/data/archetypes.js';
	import { archOf } from '$lib/data/france.js';

	let phase = $state(0);

	// 0 % → nappe haute (y=48) ; −45 % → nappe au fond (y=110)
	const yOf = (n) => 48 + Math.min(1, Math.max(0, -n / 45)) * 62;
	function wave(x0, x1, yTop, ph) {
		let d = `M${x0},120 L${x0},${yTop.toFixed(1)}`;
		const L = 22;
		for (let x = x0; x < x1; x += L) d += ` q${L / 2},${(Math.sin(ph + x / 18) * 2.6).toFixed(1)} ${L},0`;
		return d + ` L${x1},120 Z`;
	}

	const nA = $derived(lerpSeries(archOf(app.dept).series.nappe, app.year));
	const nB = $derived(app.compare ? lerpSeries(archOf(app.compare.dept).series.nappe, app.year) : null);
	const yA = $derived(yOf(nA));
	const yB = $derived(nB === null ? null : yOf(nB));

	onMount(() => {
		if (reducedMotion()) return;
		let raf, last = 0;
		const tick = (ts) => {
			raf = requestAnimationFrame(tick);
			if (ts - last < 66 || document.hidden) return;
			last = ts;
			phase += 0.35;
		};
		raf = requestAnimationFrame(tick);
		return () => cancelAnimationFrame(raf);
	});
</script>

<div class="coupewrap">
	<div class="ct">Coupe de la nappe phréatique</div>
	<svg viewBox="0 0 300 120" preserveAspectRatio="none">
		<defs>
			<linearGradient id="soilg" x1="0" y1="0" x2="0" y2="1">
				<stop offset="0" stop-color="#3a2f1f" />
				<stop offset="1" stop-color="#1b1610" />
			</linearGradient>
		</defs>
		<rect width="300" height="120" fill="#0d1a24" />
		<rect y="34" width="300" height="86" fill="url(#soilg)" />
		<!-- décor de surface : une maison, un arbre -->
		<rect x="22" y="21" width="18" height="13" fill="#22333f" />
		<path d="M18,21 L31,11 L44,21 Z" fill="#35c4b5" />
		<rect x="262" y="26" width="3" height="8" fill="#3a2f22" />
		<circle cx="263.5" cy="21" r="7" fill="#2a9d8f" />
		<line x1="0" x2="300" y1="34" y2="34" stroke="#54432a" stroke-width="1.5" />

		{#if app.compare && yB !== null}
			<path d={wave(0, 148, yA, phase)} fill="rgba(43,138,176,.78)" />
			<path d={wave(152, 300, yB, phase + 2)} fill="rgba(53,196,181,.62)" />
			<line x1="150" x2="150" y1="34" y2="120" stroke="#0d1a24" stroke-width="3" />
			<text x="8" y={Math.max(46, yA - 6)} class="labA">{app.communeName} {fmtPct(nA)}</text>
			<text x="292" y={Math.max(46, yB - 6)} class="labB" text-anchor="end">{app.compare.name} {fmtPct(nB)}</text>
		{:else}
			<path d={wave(0, 300, yA, phase)} fill="rgba(43,138,176,.78)" />
			<text x="8" y={Math.max(46, yA - 6)} class="labA">nappe {fmtPct(nA)}</text>
		{/if}
	</svg>
</div>

<style>
	.coupewrap { margin-top: 14px; padding-top: 11px; border-top: 1px solid #1c2b36; }
	.ct {
		font-size: 10px; letter-spacing: 1.4px; color: #6f8898;
		text-transform: uppercase; margin-bottom: 7px;
	}
	svg { width: 100%; display: block; border-radius: 8px; }
	text { font-size: 11px; font-weight: 800; font-family: inherit; }
	.labA { fill: #bfe6f2; }
	.labB { fill: #9fe8dd; }
</style>
