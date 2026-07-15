import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';

// A rigged, animated character loaded at runtime and driven by an AnimationMixer.
// If it fails to load, the procedural cartoon runner (buildCharacter) stays as a
// graceful fallback. The loader is chosen by file extension, so this can be a
// Mixamo .fbx (single run clip) or a multi-clip .glb interchangeably.
// Active: a Mixamo (Adobe) "cartoon boy" running character (.fbx, With Skin,
// In Place). See public/models/CREDITS.txt. To change character, drop a new
// rigged .fbx/.glb here and update this URL.
const RUNNER_MODEL_URL = `${import.meta.env.BASE_URL}models/running.fbx`;

// Subway-Surfer style endless runner — a drop-in alternative to ThreeRaceScene.
// Instead of a car on a sunset circuit, a character sprints down parallel train
// tracks through a living city: skyscrapers, railway stations, food stalls,
// bridges, signal gantries and passing trains scroll toward the camera.
//
// It deliberately exposes the EXACT same imperative API the Race screen already
// drives on the car scene — constructor shape, `onLaneLayout`, and the methods
// steerTo / startRacing / applyQuestion / playFeedback / resetSigns / destroy,
// plus the 'setLane' emitter channel — so gameplay stays untouched and fully
// server-authoritative. "Answering = steering into a lane" becomes "answering =
// switching to the correct track".

// Runner outfit per avatar (mirrors the car scene's DRIVER_COLORS so each avatar
// keeps a recognisable identity across both games).
const RUNNER_COLORS = {
  alex: { top: 0xf2f4f7, pants: 0x1f2937, skin: 0xf1c9a5, hair: 0x2b2b2b, shoe: 0xef4444, pack: 0xef4444 },
  maya: { top: 0x8b5cf6, pants: 0x4c1d95, skin: 0xf1c9a5, hair: 0x3b1d5e, shoe: 0xc4b5fd, pack: 0x7c3aed },
  omar: { top: 0xf59e0b, pants: 0x78350f, skin: 0xd9a066, hair: 0x2a1a0a, shoe: 0x1f2937, pack: 0xb45309 },
  aya: { top: 0x14b8a6, pants: 0x134e4a, skin: 0xd9a066, hair: 0x1f2937, shoe: 0x0f766e, pack: 0x0d9488 },
  james: { top: 0x4f46e5, pants: 0x1e1b4b, skin: 0x8d5524, hair: 0x120c08, shoe: 0x3730a3, pack: 0x4338ca },
  ava: { top: 0xe11d48, pants: 0x881337, skin: 0xf1c9a5, hair: 0x2b2b2b, shoe: 0x9f1239, pack: 0xbe123c },
};

const LANE_W = 3.2; // world units between adjacent tracks
const TRACK_LEN = 660; // how far the tracks stretch ahead
const WORLD_SPEED = 20; // units/sec at full sprint (calmer pace)
const SPAN = 720; // recycle distance for scrolling scenery
const GRAVITY = 30; // units/sec² for the jump arc (physics-inspired hop)

// ── tiny canvas-texture helpers (same approach as the car scene) ─────────────
function canvasTexture(w, h, draw, { repeatX = 1, repeatY = 1 } = {}) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = THREE.RepeatWrapping;
  t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeatX, repeatY);
  t.anisotropy = 4;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// Fresh-morning city sky — cool blue up top melting into a warm hazy horizon.
function skyTexture() {
  return canvasTexture(4, 512, (ctx, w, h) => {
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, '#3f7fd0');
    g.addColorStop(0.45, '#7fb2e6');
    g.addColorStop(0.72, '#cfe6f5');
    g.addColorStop(0.88, '#fbe7c6');
    g.addColorStop(1, '#f7cf9a');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  });
}

// Gravel + timber-sleeper track bed. Scrolls along Z so the sleepers fly past.
// `laneFracs` = each lane centre as a 0..1 fraction across the bed width, so the
// sleepers line up exactly under the rails (and the runner) on EVERY lane — not
// just the middle one. `sleeperWFrac` = sleeper width as a fraction of the bed.
function ballastTexture(laneFracs, sleeperWFrac) {
  return canvasTexture(256, 256, (ctx, w, h) => {
    // crushed-stone ballast base
    ctx.fillStyle = '#6a6f78';
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 2400; i++) {
      const s = Math.random();
      ctx.fillStyle = s > 0.62 ? 'rgba(255,255,255,0.10)' : s > 0.3 ? 'rgba(0,0,0,0.12)' : 'rgba(120,110,95,0.14)';
      const sz = 1 + Math.random() * 2;
      ctx.fillRect(Math.random() * w, Math.random() * h, sz, sz);
    }
    // creosote timber sleepers, one row per repeat, centred under each lane
    const bw = sleeperWFrac * w;
    for (let y = 18; y < h; y += 40) {
      for (const f of laneFracs) {
        const cx = f * w;
        const grd = ctx.createLinearGradient(0, y, 0, y + 16);
        grd.addColorStop(0, '#4e3b28');
        grd.addColorStop(0.5, '#3a2c1c');
        grd.addColorStop(1, '#2c2014');
        ctx.fillStyle = grd;
        ctx.fillRect(cx - bw / 2, y, bw, 16);
        ctx.fillStyle = 'rgba(0,0,0,0.25)';
        ctx.fillRect(cx - bw / 2, y + 13, bw, 3);
      }
    }
  });
}

// Concrete station platform / pavement running alongside the tracks.
function pavementTexture() {
  return canvasTexture(256, 256, (ctx, w, h) => {
    ctx.fillStyle = '#b9bcc2';
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 900; i++) {
      ctx.fillStyle = Math.random() > 0.5 ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.06)';
      ctx.fillRect(Math.random() * w, Math.random() * h, 2, 2);
    }
    // slab expansion joints
    ctx.strokeStyle = 'rgba(0,0,0,0.16)';
    ctx.lineWidth = 3;
    for (let x = 0; x <= w; x += 64) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
    }
    for (let y = 0; y <= h; y += 64) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }
    // yellow safety line along the platform edge (top strip)
    ctx.fillStyle = '#f4c518';
    ctx.fillRect(0, 6, w, 10);
  });
}

// Skyscraper facade — grid of windows, some lit, over a tinted concrete wall.
function buildingTexture(base, glass) {
  return canvasTexture(128, 256, (ctx, w, h) => {
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, w, h);
    const cols = 4;
    const rows = 9;
    const mx = 12;
    const my = 12;
    const gw = (w - mx * (cols + 1)) / cols;
    const gh = (h - my * (rows + 1)) / rows;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const lit = Math.random();
        ctx.fillStyle =
          lit > 0.78 ? '#fff3c4' : lit > 0.5 ? glass : 'rgba(20,28,40,0.85)';
        ctx.fillRect(mx + c * (gw + mx), my + r * (gh + my), gw, gh);
        ctx.strokeStyle = 'rgba(0,0,0,0.25)';
        ctx.lineWidth = 2;
        ctx.strokeRect(mx + c * (gw + mx), my + r * (gh + my), gw, gh);
      }
    }
  });
}

// Striped festival awning for the food stalls.
function awningTexture(a, b) {
  return canvasTexture(128, 64, (ctx, w, h) => {
    const stripe = w / 6;
    for (let i = 0; i < 6; i++) {
      ctx.fillStyle = i % 2 === 0 ? a : b;
      ctx.fillRect(i * stripe, 0, stripe, h);
    }
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    ctx.fillRect(0, h - 8, w, 8);
  });
}

// Illuminated station name board.
function signTexture(label, bg = '#0b3d91') {
  return canvasTexture(512, 128, (ctx, w, h) => {
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = 'rgba(255,255,255,0.95)';
    ctx.fillRect(0, 10, w, 6);
    ctx.fillRect(0, h - 16, w, 6);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 58px Poppins, Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, w / 2, h / 2 + 4);
  });
}

// Soft sun/haze disc low on the horizon.
function sunSprite() {
  const t = canvasTexture(256, 256, (ctx, w, h) => {
    const g = ctx.createRadialGradient(w / 2, h / 2, 6, w / 2, h / 2, w / 2);
    g.addColorStop(0, 'rgba(255,250,235,1)');
    g.addColorStop(0.3, 'rgba(255,232,180,0.85)');
    g.addColorStop(1, 'rgba(255,220,150,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  });
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, depthWrite: false, transparent: true }));
  s.scale.set(120, 120, 1);
  return s;
}

function cloudSprite() {
  const t = canvasTexture(256, 128, (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    [[70, 78, 46], [130, 66, 58], [190, 80, 42], [110, 96, 40]].forEach(([x, y, r]) => {
      ctx.beginPath();
      ctx.ellipse(x, y, r, r * 0.7, 0, 0, Math.PI * 2);
      ctx.fill();
    });
  });
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, depthWrite: false, transparent: true, opacity: 0.9 }));
  return s;
}

// Full-sky cloud layer painted on a big rotating dome. Soft, overlapping puffs
// concentrated in the upper band (transparent toward the horizon), tiled
// horizontally so it wraps seamlessly as the dome slowly turns (= wind).
function cloudLayerTexture() {
  return canvasTexture(1024, 512, (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    const puff = (x, y, r, a) => {
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, `rgba(255,255,255,${a})`);
      g.addColorStop(0.55, `rgba(255,255,255,${a * 0.5})`);
      g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    };
    for (let i = 0; i < 34; i++) {
      const cx = Math.random() * w;
      const cy = h * (0.08 + Math.random() * 0.46); // upper band of the canvas
      const baseR = 44 + Math.random() * 76;
      const alpha = 0.55 + Math.random() * 0.4;
      for (let k = 0, n = 3 + ((Math.random() * 4) | 0); k < n; k++) {
        const dx = (Math.random() - 0.5) * baseR * 2.2;
        const dy = (Math.random() - 0.5) * baseR * 0.7;
        const r = baseR * (0.6 + Math.random() * 0.7);
        puff(cx + dx, cy + dy, r, alpha);
        if (cx + dx - r < 0) puff(cx + dx + w, cy + dy, r, alpha); // wrap for seamless tiling
        if (cx + dx + r > w) puff(cx + dx - w, cy + dy, r, alpha);
      }
    }
  });
}

// Player name tag that floats over the runner (mirrors the car's rear-wing plate).
function namePlateTexture(name) {
  return canvasTexture(256, 64, (ctx, w, h) => {
    ctx.fillStyle = '#0b1220';
    ctx.beginPath();
    ctx.roundRect(0, 0, w, h, 14);
    ctx.fill();
    ctx.strokeStyle = 'rgba(103,232,249,0.7)';
    ctx.lineWidth = 4;
    ctx.stroke();
    ctx.fillStyle = '#e6eefc';
    ctx.font = 'bold 34px Poppins, Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(name, w / 2, h / 2 + 1);
  });
}

// Stepped ramp for MeshToonMaterial — gives the flat, cel-shaded cartoon look
// (a few hard light bands instead of smooth shading). Shared by every part.
function toonRampTexture() {
  const c = document.createElement('canvas');
  c.width = 5;
  c.height = 1;
  const ctx = c.getContext('2d');
  ['#8f8f8f', '#b6b6b6', '#d8d8d8', '#f1f1f1', '#ffffff'].forEach((b, i) => {
    ctx.fillStyle = b;
    ctx.fillRect(i, 0, 1, 1);
  });
  const t = new THREE.CanvasTexture(c);
  t.minFilter = THREE.NearestFilter;
  t.magFilter = THREE.NearestFilter;
  t.generateMipmaps = false;
  return t;
}

// Lighten (f>1) / darken (f<1) a hex colour, clamped.
function shade(hex, f) {
  const r = (hex >> 16) & 255, g = (hex >> 8) & 255, b = hex & 255;
  const m = (v) => Math.max(0, Math.min(255, Math.round(v * f)));
  return (m(r) << 16) | (m(g) << 8) | m(b);
}

// Cartoon outline: for every mesh flagged `userData.ol`, add a slightly larger
// back-faces-only dark copy (inverted-hull) so the character reads with the
// crisp dark edge of a mobile-game character. Cheap and asset-free.
function addToonOutlines(root, color = 0x1b1d24) {
  const mat = new THREE.MeshBasicMaterial({ color, side: THREE.BackSide });
  const clones = [];
  root.traverse((o) => {
    if (o.isMesh && o.userData.ol) {
      const c = new THREE.Mesh(o.geometry, mat);
      c.position.copy(o.position);
      c.quaternion.copy(o.quaternion);
      c.scale.copy(o.scale).multiplyScalar(1.07);
      c.castShadow = c.receiveShadow = false;
      clones.push([o.parent, c]);
    }
  });
  clones.forEach(([p, c]) => p.add(c));
}

// Dispose a subtree's geometry + materials (used when replacing procedural
// scenery). NEVER call this on cloned GLB trees — they SHARE geometry/materials.
function disposeObj(o) {
  o.traverse((x) => {
    x.geometry?.dispose?.();
    const mats = Array.isArray(x.material) ? x.material : [x.material];
    mats.forEach((m) => {
      if (!m) return;
      m.map?.dispose?.();
      m.dispose?.();
    });
  });
}

// Turn a node from a loaded model into a reusable, upright prototype: bake its
// world orientation, normalise to `targetH` units tall, and centre it with its
// feet at y=0 so it can be dropped anywhere. Returns null if degenerate.
function normalizedProto(obj, targetH) {
  obj.updateWorldMatrix(true, false);
  const pos = new THREE.Vector3(), quat = new THREE.Quaternion(), scl = new THREE.Vector3();
  obj.matrixWorld.decompose(pos, quat, scl);
  const clone = obj.clone(true);
  clone.position.set(0, 0, 0);
  clone.quaternion.copy(quat);
  clone.scale.copy(scl);
  clone.traverse((m) => {
    if (m.isMesh) {
      m.castShadow = true;
      m.receiveShadow = false;
      m.frustumCulled = true;
    }
  });
  const g = new THREE.Group();
  g.add(clone);
  let box = new THREE.Box3().setFromObject(g);
  const size = new THREE.Vector3();
  box.getSize(size);
  if (size.y < 0.01) return null;
  clone.scale.multiplyScalar(targetH / size.y);
  box = new THREE.Box3().setFromObject(g);
  const c = new THREE.Vector3();
  box.getCenter(c);
  clone.position.x -= c.x;
  clone.position.z -= c.z;
  clone.position.y -= box.min.y;
  return g;
}

// ── scene ────────────────────────────────────────────────────────────────────
export default class ThreeSubwayScene {
  constructor({ container, emitter, laneCount = 3, avatarKey = 'alex', avatarName = 'ALEX', accessorySlots = [] }) {
    this.container = container;
    this.emitter = emitter;
    this.laneCount = laneCount;
    this.avatarKey = avatarKey;
    this.avatarName = (avatarName || 'ALEX').toUpperCase().slice(0, 10);
    this.accessorySlots = accessorySlots;
    this.flameScale = 1;

    // motion / gameplay state (same semantics as the car scene)
    this.locked = true; // countdown / feedback → jog instead of sprint
    this.stopped = false; // hard stop while answer feedback shows
    this.pendingBoost = false; // sprint burst after a correct answer
    this.speed = 0; // 0..1.5
    this.prevSpeed = 0;
    this.speedTarget = 0.3;
    this.currentLane = Math.floor(laneCount / 2);
    this.shake = 0;
    this.boostUntil = 0;
    this.elapsed = 0;
    this.runPhase = 0; // drives the run cycle
    this.jumpY = 0; // vertical offset from a hop
    this.jumpVel = 0;
    this.stumble = 0; // trip animation timer on a wrong answer
    this.dustOn = false;

    // rigged-model state (falls back to the procedural runner until/unless loaded)
    this.useModel = false;
    this.mixer = null;
    this.actions = {};
    this.activeAction = null;
    this.singleAction = null; // set when the model has just one clip (Mixamo run)

    this.bedW = laneCount * LANE_W + 2.4;

    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.06;
    container.appendChild(this.renderer.domElement);
    this.renderer.domElement.style.width = '100%';
    this.renderer.domElement.style.height = '100%';
    this.renderer.domElement.style.display = 'block';

    this.scene = new THREE.Scene();
    this.scene.background = skyTexture();
    this.scene.fog = new THREE.Fog(0xcfe0ef, 90, 460);

    this.camera = new THREE.PerspectiveCamera(60, 16 / 9, 0.1, 1200);
    this.baseFov = 60;

    this.buildLights();
    this.buildWorld();
    this.buildCharacter();
    this.loadRunnerModel(); // async; swaps in the rigged model when ready

    this.onSetLane = (lane) => this.steerTo(lane);
    this.emitter?.on('setLane', this.onSetLane);

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
    this.scene.add(new THREE.HemisphereLight(0xdcecff, 0x6b6152, 1.0));
    const sun = new THREE.DirectionalLight(0xfff1d4, 2.1);
    sun.position.set(38, 62, 24); // morning sun, front-right → readable faces + short shadow
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.left = -14;
    sun.shadow.camera.right = 14;
    sun.shadow.camera.top = 18;
    sun.shadow.camera.bottom = -12;
    sun.shadow.camera.near = 1;
    sun.shadow.camera.far = 160;
    sun.shadow.bias = -0.0004;
    this.scene.add(sun);
    this.scene.add(sun.target);
    this.sun = sun;

    const disc = sunSprite();
    disc.position.set(70, 40, -360);
    this.scene.add(disc);

    // gentle fill from behind the camera so the runner's back isn't a silhouette
    const fill = new THREE.DirectionalLight(0xcfe4ff, 0.55);
    fill.position.set(-6, 14, 40);
    this.scene.add(fill);
  }

  buildWorld() {
    this.movers = []; // pooled scenery that scrolls toward the camera
    this.scrollMats = []; // {tex, axis, sign, perUnit} texture-scrolled surfaces
    const halfBed = this.bedW / 2;

    const addScrollPlane = (tex, w, x, y, tilesAlong, sign = 1, axis = 'y') => {
      const geo = new THREE.PlaneGeometry(w, TRACK_LEN);
      const mat = new THREE.MeshStandardMaterial({ map: tex, roughness: 1, metalness: 0 });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.rotation.x = -Math.PI / 2;
      mesh.position.set(x, y, -TRACK_LEN / 2 + 30);
      mesh.receiveShadow = true;
      tex.repeat.set(tex.repeat.x || 1, tilesAlong);
      this.scene.add(mesh);
      this.scrollMats.push({ tex, axis, sign, perUnit: tilesAlong / TRACK_LEN });
      return mesh;
    };

    // ballast track bed with flying sleepers — sleepers centred on the real
    // lane positions (so every track lines up under its rails, not just the mid)
    const laneFracs = [];
    for (let l = 0; l < this.laneCount; l++) laneFracs.push(this.laneX(l) / this.bedW + 0.5);
    addScrollPlane(ballastTexture(laneFracs, 2.0 / this.bedW), this.bedW, 0, 0, TRACK_LEN / 8);
    // raised concrete platforms either side of the tracks
    addScrollPlane(pavementTexture(), 9, -(halfBed + 4.5), 0.18, TRACK_LEN / 12);
    addScrollPlane(pavementTexture(), 9, halfBed + 4.5, 0.18, TRACK_LEN / 12);

    // platform side walls (the drop from platform down to the track bed)
    [-1, 1].forEach((s) => {
      const wall = new THREE.Mesh(
        new THREE.BoxGeometry(0.4, 0.36, TRACK_LEN),
        new THREE.MeshStandardMaterial({ color: 0x8c9099, roughness: 0.9 }),
      );
      wall.position.set(s * halfBed, 0.0, -TRACK_LEN / 2 + 30);
      wall.receiveShadow = true;
      this.scene.add(wall);
    });

    // far city ground so the horizon isn't empty behind the buildings
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(1600, TRACK_LEN + 400),
      new THREE.MeshStandardMaterial({ color: 0x7d8a76, roughness: 1 }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.set(0, -0.25, -TRACK_LEN / 2 + 60);
    ground.receiveShadow = true;
    this.scene.add(ground);

    // continuous steel rails (uniform along Z, so they need no scrolling)
    this.buildRails();
    // overhead catenary wires running the length of the line
    this.buildCatenary();

    // distant skyline haze behind the near buildings
    const hazeMat = new THREE.MeshBasicMaterial({ color: 0x9fb2c8, fog: true });
    for (let i = 0; i < 10; i++) {
      const b = new THREE.Mesh(new THREE.BoxGeometry(40 + (i % 4) * 18, 60 + (i % 5) * 40, 12), hazeMat);
      b.position.set(-360 + i * 80, b.geometry.parameters.height / 2 - 6, -460 - (i % 3) * 40);
      this.scene.add(b);
    }

    // Full-sky cloud dome — a big inverted sphere of soft clouds that slowly
    // rotates (wind), giving continuous moving cloud cover behind the skyline.
    const domeTex = cloudLayerTexture();
    domeTex.wrapS = THREE.RepeatWrapping;
    domeTex.repeat.set(3, 1);
    const dome = new THREE.Mesh(
      new THREE.SphereGeometry(760, 48, 24),
      new THREE.MeshBasicMaterial({
        map: domeTex, transparent: true, side: THREE.BackSide,
        depthWrite: false, fog: false, opacity: 0.92,
      }),
    );
    dome.position.y = -40; // drop it so the cloud band sits above the horizon
    dome.renderOrder = -1; // behind everything else
    this.scene.add(dome);
    this.cloudDome = dome;

    // nearer drifting cloud puffs for parallax (animated in update())
    this.clouds = [];
    const CLOUD_MINX = -260, CLOUD_MAXX = 260, CLOUD_SPAN = CLOUD_MAXX - CLOUD_MINX;
    for (let i = 0; i < 6; i++) {
      const cl = cloudSprite();
      const y = 55 + (i % 4) * 24;
      const z = -230 - (i % 4) * 55;
      const sc = 70 + (i % 4) * 28;
      cl.position.set(CLOUD_MINX + Math.random() * CLOUD_SPAN, y, z);
      cl.scale.set(sc, sc * (0.42 + Math.random() * 0.12), 1);
      cl.material.opacity = 0.65 + Math.random() * 0.2;
      this.scene.add(cl);
      this.clouds.push({ sprite: cl, speed: 1.2 + Math.random() * 1.6, minX: CLOUD_MINX, maxX: CLOUD_MAXX });
    }

    // ── shared textures reused across many pooled meshes ──
    this.buildingTexes = [
      buildingTexture('#7d8ba0', '#9fb8d8'),
      buildingTexture('#9a7d72', '#d8c3a8'),
      buildingTexture('#6d7f86', '#a8d0d8'),
      buildingTexture('#88839a', '#c3b8e0'),
      buildingTexture('#8a8f7c', '#c9d0a8'),
    ];
    this.awningTexes = [awningTexture('#e11d48', '#fff5f5'), awningTexture('#0e7490', '#f0fdff'), awningTexture('#b45309', '#fff7ed')];

    // ── pooled, scrolling scenery ──
    // skyline of buildings marching down both sides
    this.spawnRow((i) => this.makeBuilding(i, -1), 9, 80, { offset: 10 });
    this.spawnRow((i) => this.makeBuilding(i, 1), 9, 80, { offset: 52 });
    // railway stations (big set piece) alternating sides
    this.spawnRow((i) => this.makeStation(i % 2 === 0 ? 1 : -1), 2, 360, { offset: 120 });
    // food stalls on the platforms
    this.spawnRow((i) => this.makeFoodStall(i % 2 === 0 ? -1 : 1), 3, 240, { offset: 80 });
    // overpass bridges the runner sprints under
    this.spawnRow(() => this.makeBridge(), 2, 360, { offset: 220 });
    // signal gantries spanning the tracks
    this.spawnRow(() => this.makeGantry(), 8, 90, { offset: 30 });
    // street lamps + trees + benches lining the platforms
    this.spawnRow(() => this.makeLamp(-1), 8, 90, { offset: 66 });
    this.spawnRow(() => this.makeLamp(1), 8, 90, { offset: 24 });
    // lusher treeline: a dense near row + a taller row set further back, both sides
    this.spawnRow(() => this.makeTree(-1), 11, 60, { offset: 18 });
    this.spawnRow(() => this.makeTree(1), 11, 60, { offset: 48 });
    this.spawnRow(() => this.makeTree(-1, true), 8, 84, { offset: 74 });
    this.spawnRow(() => this.makeTree(1, true), 8, 84, { offset: 36 });
    this.spawnRow(() => this.makeBench(-1), 4, 180, { offset: 150 });
    // trains rushing past on the outer side tracks
    this.spawnRow((i) => this.makeTrain(-1, i), 2, 300, { offset: 60 });
    this.spawnRow((i) => this.makeTrain(1, i), 2, 300, { offset: 210 });
    // signal masts with red/green aspects
    this.spawnRow(() => this.makeSignal(1), 3, 240, { offset: 130 });

    // upgrade the procedural cone-trees to the GLB forest trees, if they load
    this.treeMovers = this.movers.filter((m) => m.obj.userData.isTree);
    this.loadTrees();
  }

  // Lay `count` copies of a scenery item spaced `spacing` apart; they recycle
  // over SPAN-independent runs (span = count*spacing keeps them evenly spread).
  spawnRow(make, count, spacing, { offset = 0 } = {}) {
    const span = count * spacing;
    for (let i = 0; i < count; i++) {
      const obj = make(i);
      obj.position.z = -(offset + i * spacing) - 20;
      this.scene.add(obj);
      this.movers.push({ obj, span });
    }
  }

  buildRails() {
    const railMat = new THREE.MeshStandardMaterial({ color: 0xb7bec8, roughness: 0.35, metalness: 0.85 });
    const gauge = 1.5;
    this.rails = [];
    for (let l = 0; l < this.laneCount; l++) {
      const cx = this.laneX(l);
      [-1, 1].forEach((s) => {
        const rail = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.14, TRACK_LEN), railMat);
        rail.position.set(cx + s * (gauge / 2), 0.13, -TRACK_LEN / 2 + 30);
        this.scene.add(rail);
        this.rails.push(rail);
      });
    }
  }

  buildCatenary() {
    const wireMat = new THREE.MeshBasicMaterial({ color: 0x2a2f38, fog: true });
    [-1, 1].forEach((s) => {
      const wire = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, TRACK_LEN, 5), wireMat);
      wire.rotation.x = Math.PI / 2;
      wire.position.set(s * (this.bedW / 4), 7.4, -TRACK_LEN / 2 + 30);
      this.scene.add(wire);
    });
    const feeder = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, TRACK_LEN, 5), wireMat);
    feeder.rotation.x = Math.PI / 2;
    feeder.position.set(0, 8.1, -TRACK_LEN / 2 + 30);
    this.scene.add(feeder);
  }

  // ── scenery factories ──────────────────────────────────────────────────────
  makeBuilding(i, side) {
    const g = new THREE.Group();
    const tex = this.buildingTexes[(i + (side > 0 ? 2 : 0)) % this.buildingTexes.length];
    const w = 12 + (i % 3) * 5;
    const h = 26 + ((i * 7) % 5) * 12;
    const d = 12 + (i % 2) * 6;
    const bodyTex = tex.clone();
    bodyTex.needsUpdate = true;
    bodyTex.wrapS = bodyTex.wrapT = THREE.RepeatWrapping;
    bodyTex.repeat.set(Math.max(1, Math.round(w / 8)), Math.max(2, Math.round(h / 12)));
    const tower = new THREE.Mesh(
      new THREE.BoxGeometry(w, h, d),
      new THREE.MeshStandardMaterial({ map: bodyTex, roughness: 0.85 }),
    );
    tower.castShadow = true;
    tower.receiveShadow = true;
    // rooftop cap + water tank / AC block for silhouette variety
    const cap = new THREE.Mesh(
      new THREE.BoxGeometry(w * 0.5, 2.2, d * 0.5),
      new THREE.MeshStandardMaterial({ color: 0x4a5260, roughness: 0.8 }),
    );
    cap.position.y = h / 2 + 1.1;
    g.add(tower, cap);
    g.position.set(side * (this.bedW / 2 + 10 + w / 2 + (i % 3) * 3), h / 2, 0);
    return g;
  }

  makeStation(side) {
    const g = new THREE.Group();
    const halfBed = this.bedW / 2;
    const px = side * (halfBed + 4.5); // platform centre
    const deckMat = new THREE.MeshStandardMaterial({ color: 0xd9dce2, roughness: 0.9 });

    // raised station deck (a thicker slab over the running platform)
    const deck = new THREE.Mesh(new THREE.BoxGeometry(9, 0.5, 34), deckMat);
    deck.position.set(px, 0.32, 0);
    deck.receiveShadow = true;
    g.add(deck);

    // canopy roof on pillars
    const pillarMat = new THREE.MeshStandardMaterial({ color: 0x394150, roughness: 0.6, metalness: 0.3 });
    for (let z = -13; z <= 13; z += 6.5) {
      [px - 3, px + 3].forEach((x) => {
        const p = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.2, 5.4, 10), pillarMat);
        p.position.set(x, 2.9, z);
        p.castShadow = true;
        g.add(p);
      });
    }
    const roof = new THREE.Mesh(
      new THREE.BoxGeometry(10, 0.4, 34),
      new THREE.MeshStandardMaterial({ color: 0x2b3340, roughness: 0.6 }),
    );
    roof.position.set(px, 5.7, 0);
    roof.castShadow = true;
    g.add(roof);
    // scalloped roof valance facing the tracks
    const valance = new THREE.Mesh(
      new THREE.BoxGeometry(0.2, 0.7, 34),
      new THREE.MeshStandardMaterial({ color: 0xe2e6ec, roughness: 0.7 }),
    );
    valance.position.set(px - side * 5, 5.2, 0);
    g.add(valance);

    // hanging name board facing the runner
    const board = new THREE.Mesh(
      new THREE.PlaneGeometry(6.2, 1.55),
      new THREE.MeshStandardMaterial({
        map: signTexture(side > 0 ? 'SDLC CENTRAL' : 'QUEST JUNCTION'),
        roughness: 0.5,
        emissive: 0x0b1830,
        emissiveIntensity: 0.5,
        side: THREE.DoubleSide,
      }),
    );
    board.position.set(px - side * 4.9, 4.2, 0);
    board.rotation.y = side > 0 ? -Math.PI / 2 : Math.PI / 2;
    g.add(board);

    // a couple of benches + a clock pillar on the deck
    const clockPole = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 3.4, 8), pillarMat);
    clockPole.position.set(px, 2.0, 8);
    g.add(clockPole);
    const clock = new THREE.Mesh(
      new THREE.CylinderGeometry(0.5, 0.5, 0.16, 16),
      new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.5 }),
    );
    clock.rotation.z = Math.PI / 2;
    clock.position.set(px, 3.6, 8);
    g.add(clock);
    // a bench on the deck
    g.add(this.makeBench(side, px, -6));

    // waiting passengers (simple capsule people)
    [-8, -2, 5, 10].forEach((z, k) => {
      const person = new THREE.Group();
      const col = [0x2563eb, 0xdc2626, 0x059669, 0x7c3aed][k % 4];
      const bodyP = new THREE.Mesh(
        new THREE.CylinderGeometry(0.26, 0.32, 1.1, 10),
        new THREE.MeshStandardMaterial({ color: col, roughness: 0.9 }),
      );
      bodyP.position.y = 0.55;
      const headP = new THREE.Mesh(
        new THREE.SphereGeometry(0.2, 10, 8),
        new THREE.MeshStandardMaterial({ color: 0xe8b58a, roughness: 0.8 }),
      );
      headP.position.y = 1.3;
      person.add(bodyP, headP);
      person.position.set(px - side * 1.8, 0.55, z);
      person.castShadow = true;
      g.add(person);
    });

    return g;
  }

  makeFoodStall(side) {
    const g = new THREE.Group();
    const px = side * (this.bedW / 2 + 4.2);
    // counter
    const counter = new THREE.Mesh(
      new THREE.BoxGeometry(3.2, 1.2, 2.2),
      new THREE.MeshStandardMaterial({ color: 0xb08968, roughness: 0.85 }),
    );
    counter.position.set(px, 0.9, 0);
    counter.castShadow = true;
    g.add(counter);
    const top = new THREE.Mesh(
      new THREE.BoxGeometry(3.5, 0.12, 2.5),
      new THREE.MeshStandardMaterial({ color: 0x6b4f34, roughness: 0.7 }),
    );
    top.position.set(px, 1.55, 0);
    g.add(top);
    // striped awning
    const tex = this.awningTexes[Math.abs((px | 0)) % this.awningTexes.length];
    const awn = new THREE.Mesh(
      new THREE.BoxGeometry(3.8, 0.16, 2.9),
      new THREE.MeshStandardMaterial({ map: tex, roughness: 0.7 }),
    );
    awn.position.set(px, 3.0, 0);
    awn.rotation.x = 0.12;
    awn.castShadow = true;
    g.add(awn);
    // posts
    [[-1.6, -1.2], [1.6, -1.2], [-1.6, 1.2], [1.6, 1.2]].forEach(([dx, dz]) => {
      const post = new THREE.Mesh(
        new THREE.CylinderGeometry(0.07, 0.07, 3.0, 6),
        new THREE.MeshStandardMaterial({ color: 0x9aa3af, roughness: 0.5, metalness: 0.5 }),
      );
      post.position.set(px + dx, 1.5, dz);
      g.add(post);
    });
    // a menu / sign board on top
    const sign = new THREE.Mesh(
      new THREE.PlaneGeometry(2.4, 0.7),
      new THREE.MeshStandardMaterial({ map: signTexture('SNACKS', '#b91c1c'), side: THREE.DoubleSide }),
    );
    sign.position.set(px - side * 1.9, 2.1, 0);
    sign.rotation.y = side > 0 ? -Math.PI / 2 : Math.PI / 2;
    g.add(sign);
    // a parasol for colour
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 3.2, 6), new THREE.MeshStandardMaterial({ color: 0x6b7280 }));
    pole.position.set(px + side * 2.2, 1.6, 0.6);
    const shade = new THREE.Mesh(
      new THREE.ConeGeometry(1.4, 0.7, 12),
      new THREE.MeshStandardMaterial({ color: 0xf59e0b, roughness: 0.7 }),
    );
    shade.position.set(px + side * 2.2, 3.3, 0.6);
    g.add(pole, shade);
    return g;
  }

  makeBridge() {
    const g = new THREE.Group();
    const span = this.bedW + 20;
    const deckMat = new THREE.MeshStandardMaterial({ color: 0x555b66, roughness: 0.85 });
    // road deck across the tracks
    const deck = new THREE.Mesh(new THREE.BoxGeometry(span, 1.2, 7), deckMat);
    deck.position.set(0, 8.6, 0);
    deck.castShadow = true;
    g.add(deck);
    // parapet railings
    [-3.4, 3.4].forEach((z) => {
      const rail = new THREE.Mesh(
        new THREE.BoxGeometry(span, 1.1, 0.3),
        new THREE.MeshStandardMaterial({ color: 0x7b828e, roughness: 0.7 }),
      );
      rail.position.set(0, 9.7, z);
      g.add(rail);
    });
    // support piers on the platforms
    const pierMat = new THREE.MeshStandardMaterial({ color: 0x6b7280, roughness: 0.9 });
    [-1, 1].forEach((s) => {
      const pier = new THREE.Mesh(new THREE.BoxGeometry(2, 8, 6), pierMat);
      pier.position.set(s * (this.bedW / 2 + 5.5), 4, 0);
      pier.castShadow = true;
      g.add(pier);
      // arch under the deck
      const arch = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.4, 7.4), deckMat);
      arch.position.set(s * (this.bedW / 2 + 3), 7.7, 0);
      g.add(arch);
    });
    // "MIND THE GAP" style banner hung under the deck facing the runner
    const banner = new THREE.Mesh(
      new THREE.PlaneGeometry(this.bedW + 3, 1.1),
      new THREE.MeshStandardMaterial({ map: signTexture('MIND THE GAP', '#0e7490'), side: THREE.DoubleSide }),
    );
    banner.position.set(0, 7.4, -3.4);
    g.add(banner);
    return g;
  }

  makeGantry() {
    const g = new THREE.Group();
    const halfBed = this.bedW / 2;
    const mat = new THREE.MeshStandardMaterial({ color: 0x3a4150, roughness: 0.6, metalness: 0.35 });
    [-1, 1].forEach((s) => {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.2, 7.6, 10), mat);
      post.position.set(s * (halfBed + 1.4), 3.8, 0);
      post.castShadow = true;
      g.add(post);
    });
    const beam = new THREE.Mesh(new THREE.BoxGeometry(this.bedW + 3.4, 0.34, 0.34), mat);
    beam.position.set(0, 7.4, 0);
    g.add(beam);
    // droppers holding the contact wire
    for (let l = 0; l < this.laneCount; l++) {
      const dropper = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.9, 5), mat);
      dropper.position.set(this.laneX(l), 6.95, 0);
      g.add(dropper);
    }
    return g;
  }

  makeLamp(side) {
    const g = new THREE.Group();
    const x = side * (this.bedW / 2 + 3.4);
    const mat = new THREE.MeshStandardMaterial({ color: 0x2f3640, roughness: 0.5, metalness: 0.5 });
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.14, 5.4, 8), mat);
    pole.position.set(x, 2.7, 0);
    pole.castShadow = true;
    const arm = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.1, 0.1), mat);
    arm.position.set(x - side * 0.7, 5.3, 0);
    const lamp = new THREE.Mesh(
      new THREE.BoxGeometry(0.7, 0.2, 0.4),
      new THREE.MeshStandardMaterial({ color: 0xfff3c4, emissive: 0xffe9a8, emissiveIntensity: 0.9 }),
    );
    lamp.position.set(x - side * 1.3, 5.2, 0);
    g.add(pole, arm, lamp);
    return g;
  }

  makeTree(side, far = false) {
    const g = new THREE.Group();
    const trunk = new THREE.Mesh(
      new THREE.CylinderGeometry(0.2, 0.3, 2.0, 6),
      new THREE.MeshStandardMaterial({ color: 0x6b4a2c, roughness: 1 }),
    );
    trunk.position.y = 1.0;
    const crown = new THREE.Mesh(
      new THREE.SphereGeometry(1.7, 10, 8),
      new THREE.MeshStandardMaterial({ color: 0x3f7d3a, roughness: 1 }),
    );
    crown.scale.y = 1.15;
    crown.position.y = 3.1;
    crown.castShadow = true;
    g.add(trunk, crown);
    // `far` trees sit further back (behind the near row) for a layered treeline
    const dist = far ? 13 + Math.random() * 6 : 6.5 + Math.random() * 3;
    g.position.set(side * (this.bedW / 2 + dist), 0, 0);
    g.scale.setScalar((far ? 1.15 : 0.85) + Math.random() * 0.5);
    // tagged so loadTrees() can swap this procedural cone for a GLB tree
    g.userData.isTree = true;
    g.userData.side = side;
    g.userData.far = far;
    return g;
  }

  makeBench(side, forceX, forceZ) {
    const g = new THREE.Group();
    const x = forceX ?? side * (this.bedW / 2 + 3.2);
    const woodMat = new THREE.MeshStandardMaterial({ color: 0x8a5a2b, roughness: 0.9 });
    const seat = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.14, 0.7), woodMat);
    seat.position.set(x, 0.7, 0);
    const back = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.6, 0.12), woodMat);
    back.position.set(x, 1.05, side > 0 ? 0.3 : -0.3);
    g.add(seat, back);
    [-0.9, 0.9].forEach((dx) => {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.7, 0.6), new THREE.MeshStandardMaterial({ color: 0x3a3f47 }));
      leg.position.set(x + dx, 0.35, 0);
      g.add(leg);
    });
    if (forceZ != null) g.position.z = forceZ;
    return g;
  }

  makeSignal(side) {
    const g = new THREE.Group();
    const x = side * (this.bedW / 2 + 1.0);
    const mat = new THREE.MeshStandardMaterial({ color: 0x2b3038, roughness: 0.6, metalness: 0.4 });
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.14, 5.0, 8), mat);
    mast.position.set(x, 2.5, 0);
    mast.castShadow = true;
    const box = new THREE.Mesh(new THREE.BoxGeometry(0.5, 1.4, 0.3), new THREE.MeshStandardMaterial({ color: 0x1a1d22 }));
    box.position.set(x, 4.7, 0);
    g.add(mast, box);
    const green = new THREE.Mesh(
      new THREE.CircleGeometry(0.16, 16),
      new THREE.MeshStandardMaterial({ color: 0x22c55e, emissive: 0x16a34a, emissiveIntensity: 1.2 }),
    );
    green.position.set(x - side * 0.16, 4.35, 0);
    green.rotation.y = -side * Math.PI / 2;
    const red = new THREE.Mesh(
      new THREE.CircleGeometry(0.16, 16),
      new THREE.MeshStandardMaterial({ color: 0x7f1d1d, emissive: 0x450a0a, emissiveIntensity: 0.3 }),
    );
    red.position.set(x - side * 0.16, 5.0, 0);
    red.rotation.y = -side * Math.PI / 2;
    g.add(green, red);
    return g;
  }

  // A multi-car passing train on an outer side track.
  makeTrain(side, variant) {
    const g = new THREE.Group();
    const x = side * (this.bedW / 2 + 2.6);
    const liveries = [
      { body: 0xdc2626, band: 0xfef08a },
      { body: 0x2563eb, band: 0xbfdbfe },
      { body: 0x0e7490, band: 0xa5f3fc },
      { body: 0xf59e0b, band: 0x1f2937 },
    ];
    const liv = liveries[variant % liveries.length];
    const bodyMat = new THREE.MeshStandardMaterial({ color: liv.body, roughness: 0.4, metalness: 0.35 });
    const glassMat = new THREE.MeshStandardMaterial({ color: 0x121821, roughness: 0.2, metalness: 0.5 });
    const roofMat = new THREE.MeshStandardMaterial({ color: 0xd7dbe0, roughness: 0.6, metalness: 0.4 });
    const carLen = 20;
    const cars = 3;
    for (let c = 0; c < cars; c++) {
      const car = new THREE.Group();
      const z0 = c * (carLen + 1.2);
      const body = new THREE.Mesh(new THREE.BoxGeometry(2.6, 3.0, carLen), bodyMat);
      body.position.set(x, 2.1, z0);
      body.castShadow = true;
      car.add(body);
      const roof = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.4, carLen), roofMat);
      roof.position.set(x, 3.75, z0);
      car.add(roof);
      // colour band + window strip on the side facing the tracks
      const band = new THREE.Mesh(
        new THREE.BoxGeometry(0.06, 0.5, carLen - 1),
        new THREE.MeshStandardMaterial({ color: liv.band, roughness: 0.5 }),
      );
      band.position.set(x - side * 1.33, 2.7, z0);
      car.add(band);
      for (let k = -1; k <= 1; k++) {
        const win = new THREE.Mesh(new THREE.BoxGeometry(0.06, 1.0, 4.4), glassMat);
        win.position.set(x - side * 1.33, 2.0, z0 + k * 6);
        car.add(win);
      }
      // bogies
      [-carLen / 2 + 3, carLen / 2 - 3].forEach((dz) => {
        const bogie = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.7, 3), new THREE.MeshStandardMaterial({ color: 0x14181f }));
        bogie.position.set(x, 0.55, z0 + dz);
        car.add(bogie);
      });
      g.add(car);
    }
    // rounded cab nose on the lead car
    const nose = new THREE.Mesh(new THREE.SphereGeometry(1.35, 16, 12, 0, Math.PI * 2, 0, Math.PI / 2), bodyMat);
    nose.rotation.x = -Math.PI / 2;
    nose.scale.set(0.98, 1, 1.4);
    nose.position.set(x, 2.1, -carLen / 2 - 0.8);
    g.add(nose);
    return g;
  }

  // ── the runner (cel-shaded cartoon character) ─────────────────────────────
  // Isolated here on purpose: swapping in a rigged GLTF model later (Route B)
  // only needs to replace this method + drive its AnimationMixer from update().
  buildCharacter() {
    const col = RUNNER_COLORS[this.avatarKey] ?? RUNNER_COLORS.alex;
    this.toonRamp = toonRampTexture();
    const toon = (color, extra = {}) => new THREE.MeshToonMaterial({ color, gradientMap: this.toonRamp, ...extra });
    const basic = (color, extra = {}) => new THREE.MeshBasicMaterial({ color, ...extra });

    const skinMat = toon(col.skin);
    const topMat = toon(col.top); // hoodie
    const topDark = toon(shade(col.top, 0.8));
    const pantMat = toon(col.pants); // cargo pants
    const shoeMat = toon(col.shoe);
    const soleMat = toon(0xf2f4f7); // sneaker sole
    const gloveMat = toon(0x2b2f38);
    const packMat = toon(col.pack);
    const packDark = toon(shade(col.pack, 0.75));
    const beanieMat = toon(col.pack);
    const white = basic(0xffffff);
    const dark = basic(0x171a21);
    const hairDark = toon(col.hair);

    const mark = (m) => { m.userData.ol = true; return m; };

    const root = new THREE.Group(); // moved laterally + jumped; runs into -Z
    const body = new THREE.Group(); // bob + forward lean live here
    root.add(body);

    // ── torso / hips (rounded, cartoon proportions) ──
    const hips = mark(new THREE.Mesh(new THREE.CapsuleGeometry(0.19, 0.06, 4, 14), pantMat));
    hips.scale.set(1.25, 1, 0.85);
    hips.position.y = 1.02;
    hips.castShadow = true;
    body.add(hips);

    const torso = mark(new THREE.Mesh(new THREE.CapsuleGeometry(0.27, 0.34, 5, 16), topMat));
    torso.scale.set(1.12, 1, 0.8);
    torso.position.y = 1.42;
    torso.castShadow = true;
    body.add(torso);
    // hood bunched behind the neck + hoodie pocket + drawstrings
    const hood = mark(new THREE.Mesh(new THREE.SphereGeometry(0.2, 14, 12), topDark));
    hood.scale.set(1, 0.7, 0.9);
    hood.position.set(0, 1.74, 0.12);
    body.add(hood);
    const pocket = mark(new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.2, 0.12), topDark));
    pocket.position.set(0, 1.2, -0.24);
    body.add(pocket);
    [-0.06, 0.06].forEach((x) => {
      const str = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.22, 6), white);
      str.position.set(x, 1.6, -0.24);
      body.add(str);
    });

    // ── head group (skull + face + beanie) — rotates for lane glances ──
    const head = new THREE.Group();
    head.position.y = 2.16;
    body.add(head);
    this.head = head;

    const skull = mark(new THREE.Mesh(new THREE.SphereGeometry(0.34, 20, 18), skinMat));
    skull.scale.set(1, 1.04, 0.98);
    skull.castShadow = true;
    head.add(skull);
    [-1, 1].forEach((s) => {
      const ear = new THREE.Mesh(new THREE.SphereGeometry(0.075, 10, 8), skinMat);
      ear.scale.set(0.7, 1, 0.9);
      ear.position.set(s * 0.33, -0.05, 0);
      head.add(ear);
    });
    // face features (front is -Z)
    [-1, 1].forEach((s) => {
      const eyeW = new THREE.Mesh(new THREE.SphereGeometry(0.082, 12, 10), white);
      eyeW.scale.set(1, 1.25, 0.55);
      eyeW.position.set(s * 0.13, -0.01, -0.30);
      head.add(eyeW);
      const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.045, 10, 8), dark);
      pupil.position.set(s * 0.14, -0.02, -0.35);
      head.add(pupil);
      const hi = new THREE.Mesh(new THREE.SphereGeometry(0.015, 6, 6), white);
      hi.position.set(s * 0.16, 0.01, -0.37);
      head.add(hi);
      const brow = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.035, 0.04), hairDark);
      brow.position.set(s * 0.13, 0.10, -0.31);
      brow.rotation.z = -s * 0.12;
      head.add(brow);
    });
    const nose = new THREE.Mesh(new THREE.SphereGeometry(0.05, 10, 8), skinMat);
    nose.position.set(0, -0.12, -0.34);
    head.add(nose);
    const mouth = new THREE.Mesh(new THREE.TorusGeometry(0.075, 0.02, 8, 14, Math.PI), dark);
    mouth.position.set(0, -0.16, -0.31);
    mouth.rotation.z = Math.PI; // arc opens up → a smile
    head.add(mouth);

    // beanie (cap + folded brim + pom)
    const cap = mark(new THREE.Mesh(new THREE.SphereGeometry(0.36, 18, 14, 0, Math.PI * 2, 0, Math.PI * 0.58), beanieMat));
    cap.position.y = 0.05;
    cap.castShadow = true;
    head.add(cap);
    const brim = mark(new THREE.Mesh(new THREE.TorusGeometry(0.345, 0.07, 10, 20), toon(shade(col.pack, 0.85))));
    brim.rotation.x = Math.PI / 2;
    brim.position.y = -0.12;
    head.add(brim);
    this.pom = new THREE.Mesh(new THREE.SphereGeometry(0.07, 10, 8), toon(shade(col.pack, 1.25)));
    this.pom.position.y = 0.44;
    head.add(this.pom);

    // neck
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.12, 0.16, 10), skinMat);
    neck.position.y = 1.9;
    body.add(neck);

    // ── signature backpack + shoulder straps ──
    const pack = mark(new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.6, 0.24), packMat));
    pack.position.set(0, 1.45, 0.3);
    pack.castShadow = true;
    body.add(pack);
    const flap = mark(new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.16, 0.26), packDark));
    flap.position.set(0, 1.7, 0.31);
    body.add(flap);
    [-1, 1].forEach((s) => {
      const strap = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.66, 0.06), packDark);
      strap.position.set(s * 0.22, 1.48, -0.16);
      strap.rotation.x = -0.12;
      body.add(strap);
    });

    // ── limbs on joint pivots (capsule segments + sneaker / glove ends) ──
    const mkLimb = (px, py, up, lo, end) => {
      const pivot = new THREE.Group();
      pivot.position.set(px, py, 0);
      const uMesh = mark(new THREE.Mesh(new THREE.CapsuleGeometry(up.r, up.len - 2 * up.r, 4, 12), up.mat));
      uMesh.position.y = -up.len / 2;
      uMesh.castShadow = true;
      pivot.add(uMesh);
      const lowerPivot = new THREE.Group();
      lowerPivot.position.y = -up.len;
      const lMesh = mark(new THREE.Mesh(new THREE.CapsuleGeometry(lo.r, lo.len - 2 * lo.r, 4, 12), lo.mat));
      lMesh.position.y = -lo.len / 2;
      lMesh.castShadow = true;
      lowerPivot.add(lMesh);
      if (end) end(lowerPivot, -lo.len);
      pivot.add(lowerPivot);
      body.add(pivot);
      return { pivot, lowerPivot };
    };

    // chunky sneaker at the ankle
    const foot = (parent, yb) => {
      const g = new THREE.Group();
      g.position.set(0, yb, 0);
      const sole = mark(new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.12, 0.54), soleMat));
      sole.position.set(0, 0.02, -0.1);
      sole.castShadow = true;
      const upperShoe = mark(new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.18, 0.34), shoeMat));
      upperShoe.position.set(0, 0.16, 0.02);
      const toe = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.13, 0.16), soleMat);
      toe.position.set(0, 0.08, -0.28);
      const lace = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.05, 0.02), white);
      lace.position.set(0, 0.26, -0.02);
      g.add(sole, upperShoe, toe, lace);
      parent.add(g);
    };
    // mitten glove at the wrist
    const hand = (parent, yb) => {
      const glove = mark(new THREE.Mesh(new THREE.SphereGeometry(0.11, 12, 10), gloveMat));
      glove.scale.set(1, 1.15, 1.2);
      glove.position.y = yb - 0.02;
      glove.castShadow = true;
      parent.add(glove);
    };

    // legs (hip → knee → sneaker)
    this.legL = mkLimb(-0.17, 1.0, { r: 0.15, len: 0.52, mat: pantMat }, { r: 0.12, len: 0.5, mat: pantMat }, foot);
    this.legR = mkLimb(0.17, 1.0, { r: 0.15, len: 0.52, mat: pantMat }, { r: 0.12, len: 0.5, mat: pantMat }, foot);
    // cargo pocket on each thigh
    [-1, 1].forEach((s, i) => {
      const leg = i === 0 ? this.legL : this.legR;
      const cargo = mark(new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.16, 0.16), toon(shade(col.pants, 1.15))));
      cargo.position.set(s * 0.15, -0.28, 0);
      leg.pivot.add(cargo);
    });
    // arms (shoulder → elbow → glove), full hoodie sleeves
    this.armL = mkLimb(-0.34, 1.66, { r: 0.1, len: 0.42, mat: topMat }, { r: 0.09, len: 0.4, mat: topMat }, hand);
    this.armR = mkLimb(0.34, 1.66, { r: 0.1, len: 0.42, mat: topMat }, { r: 0.09, len: 0.4, mat: topMat }, hand);
    // splay the arms slightly outward so they clear the torso when pumping
    this.armL.pivot.rotation.z = 0.16;
    this.armR.pivot.rotation.z = -0.16;

    // give the whole character its cartoon outline
    addToonOutlines(root);

    // floating name tag (on the root, so it survives when the procedural body
    // is hidden after the rigged model loads)
    const plate = new THREE.Mesh(
      new THREE.PlaneGeometry(1.3, 0.32),
      new THREE.MeshBasicMaterial({ map: namePlateTexture(this.avatarName), transparent: true }),
    );
    plate.position.set(0, 2.95, 0.1);
    root.add(plate);
    this.namePlate = plate;

    // dust puffs (wrong answer / hard landing)
    this.dustParts = [];
    for (let i = 0; i < 7; i++) {
      const puff = new THREE.Mesh(
        new THREE.SphereGeometry(0.2, 8, 8),
        new THREE.MeshBasicMaterial({ color: 0xcbb994, transparent: true, opacity: 0 }),
      );
      puff.position.set(0, 0.2, 0.4);
      puff.userData.seed = i / 7;
      root.add(puff);
      this.dustParts.push(puff);
    }

    // sparkle burst (correct answer)
    this.sparkParts = [];
    for (let i = 0; i < 10; i++) {
      const s = new THREE.Mesh(
        new THREE.TetrahedronGeometry(0.12),
        new THREE.MeshBasicMaterial({ color: 0xffe066, transparent: true, opacity: 0 }),
      );
      s.userData.dir = new THREE.Vector3(Math.cos((i / 10) * Math.PI * 2), 0.8 + (i % 3) * 0.3, Math.sin((i / 10) * Math.PI * 2));
      root.add(s);
      this.sparkParts.push(s);
    }

    // exhaust-style speed flames reused by BOOST/EXHAUST accessories + sprint
    this.flameParts = [];
    [-0.16, 0.16].forEach((x) => {
      const flame = new THREE.Mesh(
        new THREE.ConeGeometry(0.12, 0.7, 8),
        new THREE.MeshBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0 }),
      );
      flame.rotation.x = Math.PI / 2; // points backward (+Z)
      flame.position.set(x, 0.5, 0.5);
      root.add(flame);
      this.flameParts.push(flame);
    });

    this.body = body;
    this.buildAccessories(root);

    root.position.set(this.laneX(this.currentLane), 0, 0);
    this.character = root;
    this.scene.add(root);
  }

  // Load the rigged character asynchronously. On success it replaces the
  // procedural runner's visuals and animates via an AnimationMixer; on any
  // failure the procedural runner simply stays (no visible breakage). Picks the
  // loader by extension: .fbx (Mixamo, one run clip) or .glb (multi-clip).
  loadRunnerModel() {
    const onModel = (model, animations) => {
      if (!this.running) return; // scene was destroyed mid-load
      model.traverse((o) => {
        if (o.isMesh) {
          o.castShadow = true;
          o.receiveShadow = true;
          o.frustumCulled = false; // skinned bounds change every frame
        }
      });
      // normalise: ~2.4 units tall, feet on the ground, back to the camera (runs into -Z)
      const box = new THREE.Box3().setFromObject(model);
      const size = new THREE.Vector3();
      box.getSize(size);
      model.scale.setScalar(2.4 / (size.y || 1));
      const box2 = new THREE.Box3().setFromObject(model);
      model.position.y = -box2.min.y;
      model.rotation.y = Math.PI;

      const holder = new THREE.Group();
      holder.add(model);
      this.modelHolder = holder;
      this.character.add(holder);

      this.mixer = new THREE.AnimationMixer(model);
      const clips = animations || [];
      const byName = Object.fromEntries(clips.map((c) => [c.name, c]));
      if (byName.Running && byName.Idle) {
        // multi-clip model (.glb): drive a state machine (see update)
        for (const clip of clips) {
          const act = this.mixer.clipAction(clip);
          if (clip.name === 'Jump') {
            act.setLoop(THREE.LoopOnce, 1);
            act.clampWhenFinished = true;
          }
          this.actions[clip.name] = act;
        }
        this.fadeToAction(this.locked ? 'Walking' : 'Running', 0);
      } else if (clips.length) {
        // single-clip model (Mixamo run): always play it, speed = game speed
        this.singleAction = this.mixer.clipAction(clips[0]);
        this.singleAction.play();
      }

      // swap: hide the procedural body (its outline/accessories go with it);
      // name tag, halo, dust/spark/flame particles live on the root and stay.
      this.body.visible = false;
      this.useModel = true;
    };

    const onErr = (err) => {
      // keep the procedural runner; just note why the upgrade didn't apply
      console.warn('[subway] runner model failed to load, using procedural runner:', err?.message || err);
    };

    if (/\.fbx($|\?)/i.test(RUNNER_MODEL_URL)) {
      new FBXLoader().load(RUNNER_MODEL_URL, (obj) => onModel(obj, obj.animations), undefined, onErr);
    } else {
      new GLTFLoader().load(RUNNER_MODEL_URL, (gltf) => onModel(gltf.scene, gltf.animations), undefined, onErr);
    }
  }

  // Load the GLB tree packs and upgrade the procedural cone-trees to them. Each
  // atlas node in the forest pack is a self-contained low-poly tree; the palm is
  // one whole model. If a pack fails to load, those trees just stay procedural.
  loadTrees() {
    if (!this.treeMovers?.length) return;
    const base = import.meta.env.BASE_URL;

    // forest pack → all roadside trees (13 varieties)
    new GLTFLoader().load(
      `${base}models/low_poly_forest_tree_pack.glb`,
      (gltf) => {
        if (!this.running) return;
        gltf.scene.updateWorldMatrix(true, true);
        const protos = [];
        gltf.scene.traverse((o) => {
          if (!o.isMesh && /^Background_Tree_Atlas(\.\d+)?$/.test(o.name || '')) {
            const p = normalizedProto(o, 6);
            if (p) protos.push(p);
          }
        });
        if (protos.length) this.swapTrees(this.treeMovers, protos);
      },
      undefined,
      (e) => console.warn('[subway] tree pack failed, keeping procedural trees:', e?.message || e),
    );

    // coconut palms → sprinkle onto ~1 in 4 slots for variety
    new GLTFLoader().load(
      `${base}models/coconut_palm.glb`,
      (gltf) => {
        if (!this.running) return;
        const p = normalizedProto(gltf.scene, 7.5);
        if (!p) return;
        this.swapTrees(this.treeMovers.filter((_, i) => i % 5 === 0), [p]);
      },
      undefined,
      (e) => console.warn('[subway] palm failed:', e?.message || e),
    );
  }

  // Replace each mover's current tree with a random clone of a prototype,
  // keeping its side-x + current scroll-z. Old procedural cones are disposed;
  // old GLB trees are only detached (their geometry is shared across clones).
  swapTrees(movers, protos) {
    movers.forEach((m) => {
      const proto = protos[Math.floor(Math.random() * protos.length)];
      const tree = proto.clone(true);
      tree.rotation.y = Math.random() * Math.PI * 2;
      tree.scale.multiplyScalar((0.8 + Math.random() * 0.6) * (m.obj.userData.far ? 1.35 : 1));
      const holder = new THREE.Group();
      holder.add(tree);
      holder.position.copy(m.obj.position);
      holder.userData.isTree = true;
      holder.userData.glb = true;
      holder.userData.side = m.obj.userData.side;
      this.scene.remove(m.obj);
      if (!m.obj.userData.glb) disposeObj(m.obj); // safe: only procedural cones
      this.scene.add(holder);
      m.obj = holder;
    });
  }

  // Cross-fade the mixer to a named clip (Idle / Walking / Running / Jump).
  fadeToAction(name, dur = 0.25) {
    const next = this.actions[name];
    if (!next || next === this.activeAction) return;
    next.reset().fadeIn(dur).play();
    if (this.activeAction) this.activeAction.fadeOut(dur);
    this.activeAction = next;
  }

  // Build the visual for ONE equipped garage slot on the runner. Uses the SAME
  // slot names as the car scene so equipped gear shows up in both games.
  buildAccessory(root, slot) {
    if (!slot) return;
    const neon = new THREE.MeshBasicMaterial({
      color: 0x67e8f9, transparent: true, opacity: 0.85, side: THREE.DoubleSide, depthWrite: false,
    });
    const chrome = new THREE.MeshStandardMaterial({ color: 0xd7dde6, roughness: 0.15, metalness: 0.95 });
    const gold = new THREE.MeshStandardMaterial({
      color: 0xf6c453, roughness: 0.25, metalness: 0.85, emissive: 0x8a6410, emissiveIntensity: 0.4,
    });
    const body = this.body;

    switch (slot) {
      case 'WINGS': {
        // glowing wings sweeping up from the backpack
        const shape = new THREE.Shape();
        shape.moveTo(0, 0);
        shape.quadraticCurveTo(0.8, 0.2, 1.4, 1.2);
        shape.quadraticCurveTo(0.65, 0.8, 0, 0.4);
        const geo = new THREE.ShapeGeometry(shape);
        this.wingParts = [-1, 1].map((side) => {
          const w = new THREE.Mesh(geo, neon);
          w.position.set(side * 0.25, 1.7, 0.4);
          w.scale.x = side * 0.8;
          w.scale.y = 0.8;
          w.rotation.y = side * 0.5;
          w.userData.side = side;
          body.add(w);
          return w;
        });
        break;
      }
      case 'EXHAUST': {
        // twin skate-jets at the heels
        [-0.2, 0.2].forEach((x) => {
          const jet = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.11, 0.5, 10), chrome);
          jet.position.set(x, 0.24, 0.42);
          jet.rotation.x = Math.PI / 2 - 0.2;
          root.add(jet);
        });
        this.flameParts.forEach((f, i) => f.position.set(i === 0 ? -0.2 : 0.2, 0.24, 0.62));
        this.flameScale = 1.4;
        break;
      }
      case 'BOOST': {
        // Turbo Booster → speed flames that kick in on a sprint (no board/glow
        // under the runner — it looked wrong under a running character).
        this.flameParts.forEach((f, i) => f.position.set(i === 0 ? -0.22 : 0.22, 0.35, 0.7));
        this.flameScale = 1.7;
        break;
      }
      case 'BLADE': {
        const fin = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.5, 0.5), neon);
        fin.position.set(0, 1.7, 0.5);
        body.add(fin);
        break;
      }
      case 'HELMET': {
        const helmet = new THREE.Mesh(
          new THREE.SphereGeometry(0.4, 18, 14, 0, Math.PI * 2, 0, Math.PI * 0.6),
          gold,
        );
        helmet.position.y = 2.2;
        body.add(helmet);
        const visor = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.14, 0.1), neon);
        visor.position.set(0, 2.12, -0.32);
        body.add(visor);
        break;
      }
      case 'TRAIL': {
        const trailTex = canvasTexture(64, 256, (ctx, w, h) => {
          const g = ctx.createLinearGradient(0, 0, 0, h);
          g.addColorStop(0, 'rgba(34,211,238,0.9)');
          g.addColorStop(1, 'rgba(34,211,238,0)');
          ctx.fillStyle = g;
          ctx.fillRect(0, 0, w, h);
        });
        this.trailMesh = new THREE.Mesh(
          new THREE.PlaneGeometry(1.0, 4.0),
          new THREE.MeshBasicMaterial({ map: trailTex, transparent: true, opacity: 0.3, depthWrite: false }),
        );
        this.trailMesh.rotation.x = -Math.PI / 2;
        this.trailMesh.position.set(0, 0.05, 2.4);
        root.add(this.trailMesh);
        break;
      }
      case 'BODY': {
        // neon outline strips down the outfit
        [-0.32, 0.32].forEach((x) => {
          const strip = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.8, 0.05), neon);
          strip.position.set(x, 1.42, -0.22);
          body.add(strip);
        });
        const belt = new THREE.Mesh(new THREE.BoxGeometry(0.66, 0.1, 0.42), neon);
        belt.position.set(0, 1.05, 0);
        body.add(belt);
        break;
      }
      case 'SPECIAL':
      default: {
        this.specialGem = new THREE.Mesh(new THREE.OctahedronGeometry(0.22), gold);
        this.specialGem.position.set(0, 3.35, 0.1);
        root.add(this.specialGem);
        break;
      }
    }
  }

  buildAccessories(root) {
    for (const slot of this.accessorySlots || []) this.buildAccessory(root, slot);
  }

  laneX(i) {
    const mid = (this.laneCount - 1) / 2;
    return (i - mid) * LANE_W;
  }

  resize() {
    const w = this.container.clientWidth || 1;
    const h = this.container.clientHeight || 1;
    const aspect = w / h;
    this.camera.aspect = aspect;
    this.baseFov = aspect < 0.8 ? 82 : aspect < 1.3 ? 71 : 60;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h, false);
  }

  update(dt) {
    this.elapsed += dt;

    // speed: full stop during feedback, jog in countdown, sprint burst on relaunch
    const boosting = this.elapsed < this.boostUntil;
    this.speedTarget = this.stopped ? 0 : boosting ? 1.5 : this.locked ? 0.32 : 1;
    this.speed += (this.speedTarget - this.speed) * Math.min(1, dt * (this.stopped ? 7 : 3));
    if (this.stopped && this.speed < 0.01) this.speed = 0;
    const dist = this.speed * WORLD_SPEED * dt;

    // scroll every textured surface (ballast, platforms)
    for (const s of this.scrollMats) {
      s.tex.offset[s.axis] += s.sign * dist * s.perUnit;
    }
    // scroll pooled scenery and recycle behind the camera
    for (const m of this.movers) {
      m.obj.position.z += dist;
      if (m.obj.position.z > 18) m.obj.position.z -= m.span;
    }
    // moving sky (ambient — independent of run speed): the cloud dome turns
    // slowly (wind) and the nearer puffs drift + wrap for parallax
    if (this.cloudDome) this.cloudDome.rotation.y += dt * 0.006;
    if (this.clouds) {
      for (const c of this.clouds) {
        c.sprite.position.x += c.speed * dt;
        if (c.sprite.position.x > c.maxX) c.sprite.position.x = c.minX;
      }
    }

    // ── run cycle ──
    const cadence = 8.5;
    this.runPhase += dt * cadence * (0.45 + this.speed * 1.15);
    const grounded = this.jumpY <= 0.001 && this.stumble <= 0;
    if (!this.useModel) {
      // procedural runner: legs/arms driven by the phase
      const swing = grounded ? (0.55 + this.speed * 0.6) : 0.2;
      const s = Math.sin(this.runPhase);
      const s2 = Math.sin(this.runPhase + Math.PI);
      // thighs swing opposite; arms swing opposite to their diagonal leg
      this.legL.pivot.rotation.x = s * swing;
      this.legR.pivot.rotation.x = s2 * swing;
      // knees bend on the back-swing (never hyper-extend forward)
      this.legL.lowerPivot.rotation.x = Math.max(0, s2) * 1.25;
      this.legR.lowerPivot.rotation.x = Math.max(0, s) * 1.25;
      // arms swing with bent elbows (pumping)
      this.armL.pivot.rotation.x = s2 * swing * 1.15;
      this.armR.pivot.rotation.x = s * swing * 1.15;
      this.armL.lowerPivot.rotation.x = -0.75 - Math.max(0, s) * 0.5;
      this.armR.lowerPivot.rotation.x = -0.75 - Math.max(0, s2) * 0.5;
      // beanie-pom bounce lags the stride for a bit of life
      if (this.pom) this.pom.position.set(Math.sin(this.runPhase) * 0.03, 0.44 + Math.abs(Math.sin(this.runPhase)) * 0.02, Math.cos(this.runPhase) * 0.02);
    }

    // jump physics (gravity arc)
    if (this.jumpY > 0 || this.jumpVel > 0) {
      this.jumpY += this.jumpVel * dt;
      this.jumpVel -= GRAVITY * dt;
      if (this.jumpY <= 0) {
        this.jumpY = 0;
        this.jumpVel = 0;
        this.dustOn = true; // little landing puff
        this.landDustUntil = this.elapsed + 0.3;
      }
    }
    if (this.landDustUntil && this.elapsed > this.landDustUntil) {
      this.dustOn = this.smokeHold || false;
      this.landDustUntil = 0;
    }

    // stumble (wrong answer) — trip forward then recover
    let stumbleLean = 0;
    if (this.stumble > 0) {
      this.stumble = Math.max(0, this.stumble - dt);
      stumbleLean = Math.sin((1 - this.stumble) * Math.PI) * 0.5;
    }

    if (this.useModel && this.mixer) {
      if (this.singleAction) {
        // single-clip model (Mixamo run): always play, playback speed = game speed
        // so the legs slow to a shuffle when stopped and pump on a sprint (tuned
        // to the slower WORLD_SPEED so the feet don't slide on the ground)
        this.singleAction.timeScale = this.stopped ? 0.15 : 0.45 + this.speed * 0.65;
        this.mixer.update(dt);
      } else {
        // multi-clip model (.glb): pick a clip by state and cross-fade
        const clip = this.stopped ? (this.pendingBoost ? 'Jump' : 'Idle') : this.locked ? 'Walking' : 'Running';
        this.fadeToAction(clip);
        this.mixer.update(dt * (clip === 'Running' ? 0.7 + this.speed : 1));
      }
      // subtle forward lean — the clip provides the stride + bob itself
      if (this.modelHolder) {
        this.modelHolder.rotation.x = THREE.MathUtils.clamp(-(0.02 + this.speed * 0.06) + stumbleLean, -0.6, 0.6);
      }
    } else {
      // procedural runner: vertical bob (two per stride) + airborne leg tuck + lean
      const bob = grounded ? Math.abs(Math.sin(this.runPhase)) * 0.06 * (0.5 + this.speed) : 0;
      this.body.position.y = bob;
      if (!grounded && this.jumpY > 0) {
        // tuck the legs while airborne
        this.legL.lowerPivot.rotation.x = 1.1;
        this.legR.lowerPivot.rotation.x = 1.1;
        this.legL.pivot.rotation.x = -0.3;
        this.legR.pivot.rotation.x = -0.3;
      }
      // forward lean scales with speed; stumble adds a big trip lean
      this.body.rotation.x = -(0.06 + this.speed * 0.12) + stumbleLean;
    }

    // steer toward the target lane with a lateral lean (body roll)
    const targetX = this.laneX(this.currentLane);
    const dx = targetX - this.character.position.x;
    this.character.position.x += dx * Math.min(1, dt * 9);
    this.character.rotation.z = THREE.MathUtils.clamp(-dx * 0.22, -0.4, 0.4);
    this.character.rotation.y = THREE.MathUtils.clamp(dx * 0.12, -0.25, 0.25);
    this.character.position.y = this.jumpY;

    // head glance toward the lane being entered (procedural head only)
    if (!this.useModel && this.head) this.head.rotation.y = THREE.MathUtils.clamp(-dx * 0.12, -0.4, 0.4);

    // ── effects ──
    // sprint flames (boost / accessories)
    const flameOn = boosting || this.flamesOn;
    this.flameParts.forEach((f, i) => {
      f.material.opacity += ((flameOn ? 0.85 : 0) - f.material.opacity) * Math.min(1, dt * 10);
      const fl = flameOn ? 0.8 + Math.abs(Math.sin(this.elapsed * 30 + i * 2)) * 0.6 : 0.6;
      f.scale.set(this.flameScale, fl * this.flameScale, this.flameScale);
    });

    // dust puffs
    this.dustParts.forEach((p) => {
      if (!this.dustOn) {
        p.material.opacity += (0 - p.material.opacity) * Math.min(1, dt * 6);
        return;
      }
      const t = (this.elapsed * 1.1 + p.userData.seed) % 1;
      p.position.set(Math.sin((p.userData.seed + t) * 12) * 0.4, 0.15 + t * 0.9, 0.3 + t * 1.4);
      p.scale.setScalar(0.5 + t * 1.6);
      p.material.opacity = 0.5 * (1 - t);
    });

    // sparkles rising on a correct answer
    if (this.sparkUntil && this.elapsed < this.sparkUntil) {
      const life = 1 - (this.sparkUntil - this.elapsed) / 0.9;
      this.sparkParts.forEach((sp) => {
        sp.material.opacity = 1 - life;
        sp.position.set(sp.userData.dir.x * life * 1.3, 1.4 + sp.userData.dir.y * life * 1.7, sp.userData.dir.z * life * 1.3);
        sp.rotation.x += dt * 6;
        sp.rotation.y += dt * 5;
      });
    } else {
      this.sparkParts.forEach((sp) => (sp.material.opacity = 0));
    }

    // accessory idle animations
    if (this.wingParts) {
      const flap = 0.18 * Math.sin(this.elapsed * 9);
      this.wingParts.forEach((w) => (w.rotation.z = w.userData.side * (0.2 + flap)));
    }
    if (this.trailMesh) this.trailMesh.material.opacity = 0.06 + this.speed * 0.32;
    if (this.specialGem) {
      this.specialGem.rotation.y += dt * 2.5;
      this.specialGem.position.y = 3.35 + Math.sin(this.elapsed * 3) * 0.08;
    }
    if (this.hoverBoard) this.hoverBoard.position.y = 0.12 + Math.sin(this.elapsed * 6) * 0.03;
    if (this.namePlate) this.namePlate.position.y = 2.95 + Math.sin(this.elapsed * 2) * 0.03;

    // ── camera: third-person chase with shake + speed FOV ──
    this.shake = Math.max(0, this.shake - dt * 2.2);
    const shx = (Math.random() - 0.5) * this.shake * 0.5;
    const shy = (Math.random() - 0.5) * this.shake * 0.35;
    const camX = this.character.position.x * 0.55;
    this.camera.position.set(camX, 4.5 + this.jumpY * 0.25, 7.7);
    this.camera.lookAt(this.character.position.x * 0.8, 1.4 + this.jumpY * 0.4, -26);
    const fovTarget = this.baseFov + this.speed * 6;
    this.camera.fov += (fovTarget - this.camera.fov) * Math.min(1, dt * 4);
    this.camera.updateProjectionMatrix();

    // project each lane at the runner's row (pre-shake) so the HTML answer
    // bubbles pin exactly over their track — identical contract to the car scene
    if (this.onLaneLayout) {
      const v = new THREE.Vector3();
      const xs = [];
      for (let i = 0; i < this.laneCount; i++) {
        v.set(this.laneX(i), 0.2, 0).project(this.camera);
        xs.push((v.x + 1) / 2);
      }
      if (!this.lastLaneXs || xs.some((x, i) => Math.abs(x - this.lastLaneXs[i]) > 0.003)) {
        this.lastLaneXs = xs;
        this.onLaneLayout(xs);
      }
    }

    // shake is render-only, applied after the projection so bubbles don't jitter
    this.camera.position.x += shx;
    this.camera.position.y += shy;

    this.renderer.render(this.scene, this.camera);
  }

  // ── imperative API (identical contract to ThreeRaceScene) ──────────────────
  steerTo(lane) {
    const next = THREE.MathUtils.clamp(lane, 0, this.laneCount - 1);
    // a crisp side-hop when the player actually changes track (grounded only)
    if (next !== this.currentLane && this.jumpY <= 0.001 && this.stumble <= 0) {
      this.jumpVel = 4.2;
    }
    this.currentLane = next;
  }

  startRacing() {
    this.locked = false;
    this.stopped = false;
    this.flamesOn = false;
  }

  applyQuestion() {
    this.locked = false;
    this.stopped = false;
    this.flamesOn = false;
    this.dustOn = false;
    this.smokeHold = false;
    // relaunch with a sprint + leap after a correct answer
    if (this.pendingBoost) {
      this.pendingBoost = false;
      this.boostUntil = this.elapsed + 1.2;
      if (this.jumpY <= 0.001) this.jumpVel = 7.5;
    }
    this.currentLane = Math.floor(this.laneCount / 2);
  }

  // Feedback window (~2s in Race.jsx): stop and celebrate or stumble, then
  // applyQuestion() relaunches — with a sprint burst if the answer was correct.
  playFeedback({ isCorrect }) {
    this.locked = true;
    this.stopped = true;
    this.pendingBoost = isCorrect;
    if (isCorrect) {
      this.shake = 0.3;
      this.sparkUntil = this.elapsed + 0.9;
      if (this.jumpY <= 0.001) this.jumpVel = 8.5; // victory hop
    } else {
      this.stumble = 0.7;
      this.dustOn = true;
      this.smokeHold = true; // keep the dust up through the feedback pause
      this.shake = 0.8;
    }
  }

  resetSigns() {
    this.flamesOn = false;
    this.dustOn = false;
    this.smokeHold = false;
  }

  destroy() {
    this.running = false;
    cancelAnimationFrame(this.raf);
    this.ro?.disconnect();
    this.emitter?.off?.('setLane', this.onSetLane);
    this.mixer?.stopAllAction();
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
