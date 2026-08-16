<script>
	// Globe 3D three.js (texture canvas redessinée par année) + repli 2D orthographique
	// pour les machines sans WebGL. Rotation auto pilotée par app.autoRotate (bouton pause).
	import { onMount } from 'svelte';
	import * as d3 from 'd3';
	import * as THREE from 'three';
	import { app, geo, selectedCountry, reducedMotion } from '$lib/state.svelte.js';
	import { worldStress, countryAt } from '$lib/data/world.js';
	import { stressColor } from '$lib/data/france.js';

	let host; // conteneur du rendu
	let pinEl, pinBEl;
	let redraw = () => {}; // redessine la texture / le canvas pour l'année courante

	let { oncountrypick } = $props();

	function hasWebGL() {
		try {
			const c = document.createElement('canvas');
			return !!(window.WebGLRenderingContext && (c.getContext('webgl2') || c.getContext('webgl')));
		} catch {
			return false;
		}
	}

	/* ---------- version three.js ---------- */
	function initThree() {
		let renderer;
		try {
			renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
		} catch {
			return null;
		}
		if (!renderer || !renderer.getContext()) return null;

		const TEX_W = 2048, TEX_H = 1024;
		const texCanvas = document.createElement('canvas');
		texCanvas.width = TEX_W;
		texCanvas.height = TEX_H;
		const texCtx = texCanvas.getContext('2d');
		const texProj = d3.geoEquirectangular().translate([TEX_W / 2, TEX_H / 2]).scale(TEX_W / (2 * Math.PI));
		const texPath = d3.geoPath(texProj, texCtx);

		function drawTexture(y) {
			texCtx.fillStyle = '#0a2233'; // océans
			texCtx.fillRect(0, 0, TEX_W, TEX_H);
			for (const f of geo.WORLD.features) {
				texCtx.beginPath();
				texPath(f);
				texCtx.fillStyle = stressColor(worldStress(f, y));
				texCtx.fill();
				texCtx.lineWidth = 0.7;
				texCtx.strokeStyle = 'rgba(5,20,30,.75)';
				texCtx.stroke();
			}
			const sel = selectedCountry();
			if (sel) {
				texCtx.beginPath();
				texPath(sel);
				texCtx.lineWidth = 3.5;
				texCtx.strokeStyle = '#ffb347';
				texCtx.stroke();
			}
		}

		renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
		renderer.setSize(innerWidth, innerHeight);
		host.appendChild(renderer.domElement);

		const scene = new THREE.Scene();
		const camera = new THREE.PerspectiveCamera(38, innerWidth / innerHeight, 0.1, 100);
		camera.position.set(0, 0, 3.15);

		const group = new THREE.Group();
		scene.add(group);

		drawTexture(app.year);
		const tex = new THREE.CanvasTexture(texCanvas);
		tex.colorSpace = THREE.SRGBColorSpace;
		tex.anisotropy = 4;

		const earth = new THREE.Mesh(
			new THREE.SphereGeometry(1, 96, 96),
			new THREE.MeshPhongMaterial({ map: tex, shininess: 4, specular: new THREE.Color(0x113344) })
		);
		group.add(earth);

		// halo d'atmosphère
		const atmo = new THREE.Mesh(
			new THREE.SphereGeometry(1.16, 64, 64),
			new THREE.ShaderMaterial({
				transparent: true,
				side: THREE.BackSide,
				blending: THREE.AdditiveBlending,
				depthWrite: false,
				uniforms: { uColor: { value: new THREE.Color(0x35c4b5) } },
				vertexShader: `varying vec3 vN; void main(){ vN = normalize(normalMatrix * normal);
					gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
				fragmentShader: `varying vec3 vN; uniform vec3 uColor;
					void main(){ float i = pow(0.72 - dot(vN, vec3(0.0,0.0,1.0)), 2.4);
					gl_FragColor = vec4(uColor, 1.0) * i; }`
			})
		);
		scene.add(atmo);

		scene.add(new THREE.AmbientLight(0xffffff, 0.85));
		const sun = new THREE.DirectionalLight(0xfff0dd, 1.15);
		sun.position.set(3, 1.5, 2.5);
		scene.add(sun);

		// rotation : auto + drag — un relâchement à moins de 6 px = un clic (sélection de pays)
		let rotY = -0.35, rotX = 0.18, dragging = false, lastX = 0, lastY = 0, idle = 0;
		let downX = 0, downY = 0;
		const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
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
			rotY += (e.clientX - lastX) * 0.0055;
			rotX += (e.clientY - lastY) * 0.004;
			rotX = Math.max(-1.2, Math.min(1.2, rotX));
			lastX = e.clientX;
			lastY = e.clientY;
			idle = 0;
		});
		const stopDrag = () => {
			dragging = false;
			host.classList.remove('grabbing');
		};
		host.addEventListener('pointerup', (e) => {
			stopDrag();
			if (Math.hypot(e.clientX - downX, e.clientY - downY) >= 6) return;
			ndc.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
			ray.setFromCamera(ndc, camera);
			const hit = ray.intersectObject(earth)[0];
			if (!hit) { oncountrypick?.(null); return; }
			const p = earth.worldToLocal(hit.point.clone()); // repère de la sphère non tournée
			const r = p.length();
			const lat = 90 - (Math.acos(p.y / r) * 180) / Math.PI;
			let lon = (Math.atan2(p.z, -p.x) * 180) / Math.PI - 180;
			lon = ((lon + 540) % 360) - 180;
			oncountrypick?.(countryAt(geo.WORLD, [lon, lat]));
		});
		host.addEventListener('pointercancel', stopDrag);
		host.addEventListener('wheel', (e) => {
			e.preventDefault();
			camera.position.z = Math.max(1.9, Math.min(5, camera.position.z + e.deltaY * 0.0016));
		}, { passive: false });

		function lonLatToVec3(lon, lat, r) {
			const theta = ((90 - lat) * Math.PI) / 180;
			const phi = ((lon + 180) * Math.PI) / 180;
			return new THREE.Vector3(
				-r * Math.cos(phi) * Math.sin(theta),
				r * Math.cos(theta),
				r * Math.sin(phi) * Math.sin(theta)
			);
		}
		const tmp = new THREE.Vector3();
		function screenPlace(el, lonlat) {
			if (!el) return;
			if (!lonlat) { el.style.opacity = 0; return; }
			const p = lonLatToVec3(lonlat[0], lonlat[1], 1.015);
			tmp.copy(p).applyEuler(group.rotation);
			const visible = tmp.z > -0.05;
			tmp.project(camera);
			el.style.left = (tmp.x * 0.5 + 0.5) * innerWidth + 'px';
			el.style.top = (-tmp.y * 0.5 + 0.5) * innerHeight + 'px';
			el.style.opacity = visible ? 1 : 0;
		}

		let disposed = false;
		function frame() {
			if (disposed) return;
			requestAnimationFrame(frame);
			if (app.view !== 'world') { renderer.render(scene, camera); return; }
			if (!dragging && app.autoRotate) { idle++; if (idle > 60) rotY += 0.0016; }
			group.rotation.y = rotY;
			group.rotation.x = rotX;
			screenPlace(pinEl, app.lonlat);
			screenPlace(pinBEl, app.compare ? app.compare.lonlat : null);
			renderer.render(scene, camera);
		}
		frame();

		const onResize = () => {
			camera.aspect = innerWidth / innerHeight;
			camera.updateProjectionMatrix();
			renderer.setSize(innerWidth, innerHeight);
		};
		addEventListener('resize', onResize);

		return {
			redraw(y) { drawTexture(y); tex.needsUpdate = true; },
			dispose() {
				disposed = true;
				removeEventListener('resize', onResize);
				renderer.dispose();
			}
		};
	}

	/* ---------- repli 2D orthographique (machines sans WebGL) ---------- */
	function initFallback() {
		const c = document.createElement('canvas');
		host.appendChild(c);
		const ctx = c.getContext('2d');
		let rot = -10, tilt = -12, dragging = false, lastX = 0, lastY = 0, idle = 0;
		let dirty = true, lastFrame = 0, disposed = false;
		const proj = d3.geoOrthographic().clipAngle(90);
		const path = d3.geoPath(proj, ctx);

		// couleurs recalculées seulement quand l'année change, pas à chaque frame
		let colors = [], colorYear = null;
		function ensureColors(y) {
			if (colorYear === y) return;
			colorYear = y;
			colors = geo.WORLD.features.map((f) => stressColor(worldStress(f, y)));
		}

		function size() {
			c.width = innerWidth;
			c.height = innerHeight;
			proj.translate([innerWidth / 2, innerHeight / 2]).scale(Math.min(innerWidth, innerHeight) * 0.34);
			dirty = true;
		}
		size();
		addEventListener('resize', size);

		let downX = 0, downY = 0;
		host.addEventListener('pointerdown', (e) => {
			dragging = true;
			lastX = downX = e.clientX;
			lastY = downY = e.clientY;
			idle = 0;
			host.classList.add('grabbing');
		});
		addEventListener('pointermove', (e) => {
			if (!dragging) return;
			rot += (e.clientX - lastX) * 0.32;
			tilt = Math.max(-60, Math.min(60, tilt + (e.clientY - lastY) * 0.22));
			lastX = e.clientX;
			lastY = e.clientY;
			idle = 0;
			dirty = true;
		});
		addEventListener('pointerup', () => { dragging = false; host.classList.remove('grabbing'); });
		host.addEventListener('pointerup', (e) => {
			if (Math.hypot(e.clientX - downX, e.clientY - downY) >= 6) return;
			const ll = proj.invert([e.clientX, e.clientY]);
			// invert peut répondre hors sphère : on reprojette pour valider le point
			const back = ll && proj(ll);
			if (!back || Math.hypot(back[0] - e.clientX, back[1] - e.clientY) > 2) { oncountrypick?.(null); return; }
			oncountrypick?.(countryAt(geo.WORLD, ll));
			dirty = true;
		});

		function frame(ts) {
			if (disposed) return;
			requestAnimationFrame(frame);
			if (app.view !== 'world') return;
			if (ts - lastFrame < 33) return; // plafond ~30 fps
			lastFrame = ts;
			if (!dragging && app.autoRotate) { idle++; if (idle > 45) { rot += 0.22; dirty = true; } }
			if (!dirty) return;
			dirty = false;

			ensureColors(app.year);
			proj.rotate([rot, tilt]);
			ctx.clearRect(0, 0, innerWidth, innerHeight);
			ctx.beginPath(); path({ type: 'Sphere' }); ctx.fillStyle = '#0a2233'; ctx.fill();
			ctx.lineWidth = 0.5;
			ctx.strokeStyle = 'rgba(5,20,30,.7)';
			for (let i = 0; i < geo.WORLD.features.length; i++) {
				ctx.beginPath();
				path(geo.WORLD.features[i]);
				ctx.fillStyle = colors[i];
				ctx.fill();
				ctx.stroke();
			}
			const sel = selectedCountry();
			if (sel) {
				ctx.beginPath(); path(sel);
				ctx.lineWidth = 2.5; ctx.strokeStyle = '#ffb347'; ctx.stroke();
			}
			ctx.beginPath(); path({ type: 'Sphere' });
			ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(53,196,181,.55)'; ctx.stroke();

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

		return {
			redraw() { dirty = true; },
			dispose() { disposed = true; removeEventListener('resize', size); }
		};
	}

	onMount(() => {
		if (reducedMotion()) app.autoRotate = false;
		const globe = hasWebGL() ? initThree() || initFallback() : initFallback();
		redraw = globe.redraw;
		return () => globe.dispose();
	});

	// l'année ou le pays sélectionné changent → texture à refaire
	$effect(() => {
		void app.year;
		void app.countryId;
		redraw(app.year);
	});
</script>

<div id="globe" bind:this={host} class:hidden={app.view !== 'world'}></div>

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
	#globe :global(.grabbing), #globe:global(.grabbing) { cursor: grabbing; }

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
