<script>
	// Timeline 1975 → 2075 : curseur, lecture automatique (~10 ans/s),
	// repères biographiques sur deux lignes (le trait pointe toujours l'année exacte),
	// toasts sur les années remarquables.
	import { app, Y0, Y1, SPAN, THIS_YEAR } from '$lib/state.svelte.js';
	import { EVENTS } from '$lib/data/archetypes.js';

	let playing = $state(false);
	let interval = null;

	function stopPlay() {
		if (interval) clearInterval(interval);
		interval = null;
		playing = false;
	}
	function togglePlay() {
		if (playing) return stopPlay();
		if (app.year >= Y1) app.year = Y0;
		playing = true;
		interval = setInterval(() => {
			app.year += 1;
			if (app.year >= Y1) stopPlay();
		}, 95);
	}

	// toast des années remarquables
	let toastTimer = null;
	$effect(() => {
		const ev = EVENTS[app.year];
		if (!ev) return;
		app.toast = ev.label;
		clearTimeout(toastTimer);
		toastTimer = setTimeout(() => (app.toast = null), 2200);
	});

	// Repères : bornes + ancres biographiques. Si une ancre sort de la fenêtre,
	// la borne porte l'âge à cette date. Deux lignes en cas de chevauchement.
	const marks = $derived.by(() => {
		const b = app.birth;
		const items = [];
		const ageAtY0 = Y0 - b, ageAtY1 = Y1 - b;
		items.push({
			y: Y0,
			t: ageAtY0 >= 0 ? `${Y0} · tu avais ${ageAtY0} ans` : `${Y0}`,
			cls: ageAtY0 >= 0 ? 'me' : ''
		});
		const anchor = (age) => {
			const y = b + age;
			if (y <= Y0 || y >= Y1) return null; // la borne s'en charge
			return { y, t: `${y < THIS_YEAR ? 'tu avais' : 'toi à'} ${age} ans · ${y}`, cls: 'me' };
		};
		const m10 = anchor(10);
		if (m10) items.push(m10);
		items.push({ y: THIS_YEAR, t: "aujourd'hui", cls: 'now' });
		const m75 = anchor(75);
		if (m75) items.push(m75);
		items.push({
			y: Y1,
			t: ageAtY1 <= 110 ? `${Y1} · tu aurais ${ageAtY1} ans` : `${Y1}`,
			cls: ageAtY1 <= 110 ? 'me' : ''
		});

		// chevauchement : on ne déplace jamais un repère, on bascule le libellé en ligne 2
		items.sort((x, z) => x.y - z.y);
		const trackPx = 800;
		let lastRight = -1e9, lastRow = 1;
		return items.map((it, i) => {
			const p = ((it.y - Y0) / SPAN) * 100;
			const xPx = (p / 100) * trackPx;
			const widthPx = it.t.length * 5.4;
			const isFirst = i === 0, isLast = i === items.length - 1;
			const left = isFirst ? xPx : isLast ? xPx - widthPx : xPx - widthPx / 2;
			const row = left < lastRight + 8 ? (lastRow === 0 ? 1 : 0) : 0;
			if (row === 0) lastRight = left + widthPx;
			lastRow = row;
			return { ...it, p, row, isFirst, isLast };
		});
	});
</script>

<div class="timebar">
	<button class="play" onclick={togglePlay} aria-label={playing ? 'Pause' : 'Lecture'}>
		{playing ? '❚❚' : '▶'}
	</button>
	<div class="sliderwrap">
		<div class="yearline">
			<span class="yearBig">{app.year}{#if app.year === THIS_YEAR}<small>aujourd'hui</small>{/if}</span>
		</div>
		<input
			type="range"
			min={Y0}
			max={Y1}
			step="1"
			value={app.year}
			oninput={(e) => { stopPlay(); app.year = +e.currentTarget.value; }}
		/>
		<div class="marks">
			{#each marks as m}
				<div
					class="mark {m.cls} row{m.row}"
					class:first={m.isFirst}
					class:last={m.isLast}
					style="left:{m.p}%"
				>
					<i></i>{m.t}
				</div>
			{/each}
		</div>
	</div>
</div>

<style>
	.timebar {
		position: fixed; left: 50%; transform: translateX(-50%); bottom: 22px;
		width: min(900px, 94vw); z-index: 5;
		background: rgba(11, 20, 28, 0.94); border: 1px solid #1e2f3b; border-radius: 16px;
		padding: 13px 24px 50px; display: flex; gap: 18px; align-items: center;
		backdrop-filter: blur(8px); box-shadow: 0 14px 44px rgba(0, 0, 0, 0.6);
	}
	.play {
		width: 46px; height: 46px; min-width: 46px; border-radius: 50%;
		background: #35c4b5; color: #04121a; border: none; font-size: 17px; font-weight: 900;
		cursor: pointer; font-family: inherit;
	}
	.play:hover { filter: brightness(1.12); }
	.sliderwrap { flex: 1; position: relative; }
	.yearline { text-align: center; margin-bottom: 3px; }
	.yearBig {
		font-size: 28px; font-weight: 900; color: #ffb347;
		font-variant-numeric: tabular-nums; letter-spacing: -0.5px;
	}
	.yearBig small { font-size: 12px; font-weight: 600; color: #6f8898; letter-spacing: 0; margin-left: 7px; }
	input[type='range'] {
		width: 100%; -webkit-appearance: none; appearance: none; height: 8px; border-radius: 4px; outline: none;
		background: linear-gradient(90deg, #2a9d8f, #7fae72 25%, #e9c46a 55%, #dd8442 78%, #c1642a);
	}
	input[type='range']::-webkit-slider-thumb {
		-webkit-appearance: none; width: 24px; height: 24px; border-radius: 50%; background: #fff;
		border: 6px solid #ffb347; box-shadow: 0 0 15px rgba(255, 179, 71, 0.85); cursor: grab;
	}
	input[type='range']::-moz-range-thumb {
		width: 24px; height: 24px; border-radius: 50%; background: #fff; border: 6px solid #ffb347; cursor: grab;
	}
	.marks { position: absolute; left: 0; right: 0; top: calc(100% + 7px); height: 40px; }
	.mark {
		position: absolute; transform: translateX(-50%); font-size: 10.5px; color: #6f8898;
		white-space: nowrap; text-align: center;
	}
	.mark i { display: block; width: 1px; background: #3d5464; margin: 0 auto 3px; }
	.mark.row0 i { height: 5px; }
	.mark.row1 { top: 17px; }
	.mark.row1 i { height: 22px; margin-top: -17px; }
	.mark.first { transform: translateX(0); text-align: left; }
	.mark.first i { margin-left: 0; }
	.mark.last { transform: translateX(-100%); text-align: right; }
	.mark.last i { margin-right: 0; }
	.mark.me { color: #35c4b5; font-weight: 700; }
	.mark.me i { background: #35c4b5; }
	.mark.now { color: #e8eef2; font-weight: 700; }
	.mark.now i { background: #8fa6b4; }
</style>
