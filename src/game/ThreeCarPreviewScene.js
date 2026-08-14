import * as THREE from 'three';
import { buildCar, canvasTexture } from './carBuilder';

// NFS-style showroom turntable for the pre-race car preview (CarPreview.jsx).
// Reuses the exact same car mesh as the live race (carBuilder.js) but drops it
// into a dark studio setting instead of the circuit — no road, no lanes, no
// game logic. Auto-rotates, supports drag-to-spin, and does a slow camera
// dolly-in on mount. Exposes a `destroy()` matching ThreeRaceScene's contract
// so ThreeGame.jsx can mount either scene interchangeably.

function floorTexture() {
  return canvasTexture(512, 512, (ctx, w, h) => {
    const g = ctx.createRadialGradient(w / 2, h / 2, 20, w / 2, h / 2, w / 2);
    g.addColorStop(0, 'rgba(34,211,238,0.28)');
    g.addColorStop(0.45, 'rgba(15,27,51,0.85)');
    g.addColorStop(1, 'rgba(4,6,12,1)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    // faint concentric rings — showroom podium
    ctx.strokeStyle = 'rgba(103,232,249,0.22)';
    ctx.lineWidth = 2;
    for (let r = 40; r < w / 2; r += 46) {
      ctx.beginPath();
      ctx.arc(w / 2, h / 2, r, 0, Math.PI * 2);
      ctx.stroke();
    }
  });
}

export default class ThreeCarPreviewScene {
  constructor({ container, avatarKey = 'alex', avatarName = 'ALEX', accessorySlots = [] }) {
    this.container = container;
    this.dragging = false;
    this.manualSpin = 0; // extra rotation from a pointer drag, added atop autorotate
    this.autoSpin = true;

    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.1;
    container.appendChild(this.renderer.domElement);
    this.renderer.domElement.style.width = '100%';
    this.renderer.domElement.style.height = '100%';
    this.renderer.domElement.style.display = 'block';
    this.renderer.domElement.style.cursor = 'grab';

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x05070d);
    this.scene.fog = new THREE.Fog(0x05070d, 14, 30);

    this.camera = new THREE.PerspectiveCamera(42, 16 / 9, 0.1, 100);
    this.camStartDist = 11.5;
    this.camEndDist = 6.6;
    this.camDollyT = 0;

    this.buildLights();
    this.buildFloor();

    const parts = buildCar({ avatarKey, avatarName, accessorySlots });
    this.car = parts.car;
    this.car.position.set(0, 0, 0);
    // a light idle flicker on the exhaust so the showroom car doesn't feel dead
    this.flameParts = parts.flameParts;
    this.tailLight = parts.tailLight;
    this.wingParts = parts.wingParts;
    this.specialGem = parts.specialGem;
    this.scene.add(this.car);

    this.pivot = new THREE.Group();
    this.pivot.add(this.car);
    this.scene.add(this.pivot);

    this.bindPointer();

    this.resize();
    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(container);

    this.clock = new THREE.Clock();
    this.running = true;
    const loop = () => {
      if (!this.running) return;
      this.raf = requestAnimationFrame(loop);
      this.update(Math.min(this.clock.getDelta(), 0.05));
    };
    loop();
  }

  buildLights() {
    this.scene.add(new THREE.HemisphereLight(0x2a3a55, 0x0a0a10, 0.55));

    const key = new THREE.SpotLight(0xffffff, 220, 30, Math.PI / 6, 0.4, 1.2);
    key.position.set(4.5, 8, 5);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    this.scene.add(key);
    this.scene.add(key.target);

    const rimCyan = new THREE.PointLight(0x22d3ee, 26, 18);
    rimCyan.position.set(-4.5, 2.2, -3.5);
    this.scene.add(rimCyan);

    const rimMagenta = new THREE.PointLight(0xe11d48, 18, 16);
    rimMagenta.position.set(3.5, 1.6, -4.5);
    this.scene.add(rimMagenta);

    const fill = new THREE.DirectionalLight(0x8fb2ff, 0.35);
    fill.position.set(-3, 4, 6);
    this.scene.add(fill);
  }

  buildFloor() {
    const floor = new THREE.Mesh(
      new THREE.CircleGeometry(9, 48),
      new THREE.MeshStandardMaterial({ map: floorTexture(), roughness: 0.35, metalness: 0.4 }),
    );
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    this.scene.add(floor);
  }

  bindPointer() {
    const el = this.renderer.domElement;
    let lastX = 0;
    const onDown = (e) => {
      this.dragging = true;
      this.autoSpin = false;
      lastX = (e.touches ? e.touches[0].clientX : e.clientX);
      el.style.cursor = 'grabbing';
    };
    const onMove = (e) => {
      if (!this.dragging) return;
      const x = (e.touches ? e.touches[0].clientX : e.clientX);
      this.manualSpin += (x - lastX) * 0.012;
      lastX = x;
    };
    const onUp = () => {
      this.dragging = false;
      el.style.cursor = 'grab';
    };
    el.addEventListener('pointerdown', onDown);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    this._unbindPointer = () => {
      el.removeEventListener('pointerdown', onDown);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
  }

  resize() {
    const w = this.container.clientWidth || 1;
    const h = this.container.clientHeight || 1;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h, false);
  }

  update(dt) {
    // slow turntable, gently paused while the player is dragging
    if (this.autoSpin) this.pivot.rotation.y += dt * 0.28;
    this.pivot.rotation.y += this.manualSpin;
    this.manualSpin *= Math.max(0, 1 - dt * 8); // friction back to zero

    // camera dolly-in over the first ~1.6s — a front-3/4 hero angle (the car's
    // nose is at -Z) so the showroom reveal shows the car, not the rear wing
    // name-plate the in-race chase camera favors.
    this.camDollyT = Math.min(1, this.camDollyT + dt / 1.6);
    const ease = 1 - Math.pow(1 - this.camDollyT, 3);
    const dist = this.camStartDist + (this.camEndDist - this.camStartDist) * ease;
    this.camera.position.set(dist * 0.62, 2.0, -dist * 0.72);
    this.camera.lookAt(0, 0.6, 0);

    // idle flicker so the showroom car still feels alive
    this._t = (this._t || 0) + dt;
    this.flameParts?.forEach((f) => {
      f.material.opacity += (0 - f.material.opacity) * Math.min(1, dt * 6);
    });
    if (this.tailLight) this.tailLight.material.emissiveIntensity = 1.6 + Math.sin(this._t * 2) * 0.2;
    if (this.wingParts) this.wingParts.forEach((w) => (w.rotation.z = w.userData.side * (0.15 + 0.08 * Math.sin(this._t * 1.4))));
    if (this.specialGem) this.specialGem.rotation.y += dt * 1.6;

    this.renderer.render(this.scene, this.camera);
  }

  // No-op imperative-contract members so this scene can sit in ThreeGame.jsx's
  // SCENES map alongside ThreeRaceScene/ThreeSubwayScene without special-casing
  // the bridge component. The preview screen never calls these.
  startRacing() {}
  applyQuestion() {}
  playFeedback() {}
  resetSigns() {}

  destroy() {
    this.running = false;
    cancelAnimationFrame(this.raf);
    this.ro?.disconnect();
    this._unbindPointer?.();
    this.scene.traverse((o) => {
      o.geometry?.dispose?.();
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      mats.forEach((m) => {
        if (!m) return;
        m.map?.dispose?.();
        m.dispose?.();
      });
    });
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}
