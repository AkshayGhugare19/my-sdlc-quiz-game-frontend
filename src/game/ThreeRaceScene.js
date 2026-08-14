import * as THREE from 'three';
import { buildCar as buildCarMesh, canvasTexture } from './carBuilder';
import { buildTrackCurve, sampleTrack, headingAngle, buildRibbon, buildWall, placeAlongTrack } from './trackPath';

// Real-3D replacement for the old Phaser pseudo-3D road (RaceScene.js).
// Renders a sunset circuit — asphalt, kerbs, sponsor rails, overhead gantries,
// grandstands — with a third-person sports car that steers between lanes.
// It exposes the exact same imperative API the Race screen already uses
// (startRacing / applyQuestion / playFeedback / resetSigns + 'setLane' on the
// emitter), so all game logic stays untouched and server-authoritative.
// The car mesh itself (paint/driver palettes, geometry, accessories) lives in
// carBuilder.js, shared with the pre-race ThreeCarPreviewScene.
//
// The track is a real, fixed, closed-loop circuit (trackPath.js) — sweeping
// curves plus a chicane — built once; the car actually travels around it
// (looping lap after lap), rather than the world scrolling past a stationary
// car. See update() for how position/heading/camera are derived from the
// curve each frame.

const LANE_W = 4.4; // world units per lane
const WORLD_SPEED = 30; // units/sec at full speed
const TRACK_RADIUS = 150; // base radius of the circuit (see trackPath.js)
const CAM_BEHIND = 9; // world units the chase camera trails behind the car, along the track
const CAM_AHEAD = 24; // world units ahead the camera looks, along the track

function skyTexture() {
  return canvasTexture(4, 512, (ctx, w, h) => {
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, '#6ea8dd');
    g.addColorStop(0.55, '#bcd9ee');
    g.addColorStop(0.8, '#f2ddbd');
    g.addColorStop(1, '#f6cf9e');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  });
}

// One road tile (≈20 world units long) — asphalt grain, edge lines, lane dashes.
function roadTexture(laneCount) {
  return canvasTexture(512, 512, (ctx, w, h) => {
    ctx.fillStyle = '#5a5f6a';
    ctx.fillRect(0, 0, w, h);
    // asphalt speckle
    for (let i = 0; i < 2600; i++) {
      const s = Math.random();
      ctx.fillStyle = s > 0.5 ? 'rgba(255,255,255,0.045)' : 'rgba(0,0,0,0.07)';
      ctx.fillRect(Math.random() * w, Math.random() * h, 2, 2);
    }
    // tyre wear darkening per lane centre
    for (let l = 0; l < laneCount; l++) {
      const cx = ((l + 0.5) / laneCount) * w;
      const grad = ctx.createLinearGradient(cx - 40, 0, cx + 40, 0);
      grad.addColorStop(0, 'rgba(0,0,0,0)');
      grad.addColorStop(0.5, 'rgba(0,0,0,0.14)');
      grad.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = grad;
      ctx.fillRect(cx - 40, 0, 80, h);
    }
    // solid white edge lines
    ctx.fillStyle = '#f2f5f8';
    ctx.fillRect(6, 0, 10, h);
    ctx.fillRect(w - 16, 0, 10, h);
    // dashed lane separators
    for (let l = 1; l < laneCount; l++) {
      const x = (l / laneCount) * w;
      for (let y = 0; y < h; y += 128) ctx.fillRect(x - 4, y, 8, 64);
    }
  });
}

// Red/white kerb stripes.
function kerbTexture() {
  return canvasTexture(64, 256, (ctx, w, h) => {
    for (let y = 0; y < h; y += 64) {
      ctx.fillStyle = '#d33131';
      ctx.fillRect(0, y, w, 32);
      ctx.fillStyle = '#f3f4f6';
      ctx.fillRect(0, y + 32, w, 32);
    }
  });
}

// Sponsor rail — colourful banner blocks with playful labels.
function railTexture() {
  const ADS = [
    ['#0e7490', 'SDLC QUEST'],
    ['#b91c1c', 'RAD'],
    ['#1d4ed8', 'GO-SPRINT'],
    ['#a16207', 'BREMSBAR'],
    ['#15803d', 'DEVOPS GP'],
    ['#7e22ce', 'AGILE 500'],
  ];
  return canvasTexture(1024, 64, (ctx, w, h) => {
    const seg = w / ADS.length;
    ADS.forEach(([color, label], i) => {
      ctx.fillStyle = color;
      ctx.fillRect(i * seg, 0, seg, h);
      ctx.fillStyle = 'rgba(255,255,255,0.92)';
      ctx.font = 'bold 26px Poppins, Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(label, i * seg + seg / 2, h / 2);
    });
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.fillRect(0, h - 6, w, 6);
  });
}

// Overhead gantry banner (checkers + title).
function gantryTexture() {
  return canvasTexture(1024, 128, (ctx, w, h) => {
    ctx.fillStyle = '#101827';
    ctx.fillRect(0, 0, w, h);
    for (let x = 0; x < w; x += 32) {
      for (let y = 0; y < h; y += 32) {
        if (((x + y) / 32) % 2 === 0) {
          ctx.fillStyle = 'rgba(255,255,255,0.16)';
          ctx.fillRect(x, y, 32, 32);
        }
      }
    }
    ctx.fillStyle = '#fbbf24';
    ctx.fillRect(0, 0, w, 10);
    ctx.fillRect(0, h - 10, w, 10);
    ctx.font = 'black 64px Poppins, Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#ffffff';
    ctx.fillText('ANSWER BY RACING', w / 2, h / 2 + 2);
  });
}

// Roadside "CHECKPOINT" plate for the parking-bay sign — purely decorative
// scenery, not synced to the actual parking timing.
function checkpointSignTexture() {
  return canvasTexture(256, 320, (ctx, w, h) => {
    ctx.fillStyle = '#0f1b33';
    ctx.beginPath();
    ctx.roundRect(6, 6, w - 12, h - 12, 18);
    ctx.fill();
    ctx.strokeStyle = '#facc15';
    ctx.lineWidth = 6;
    ctx.stroke();
    ctx.fillStyle = '#facc15';
    ctx.font = 'black 120px Poppins, Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('P', w / 2, h * 0.38);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 30px Poppins, Arial';
    ctx.fillText('CHECKPOINT', w / 2, h * 0.72);
    ctx.font = 'bold 22px Poppins, Arial';
    ctx.fillStyle = '#67e8f9';
    ctx.fillText('ANSWER AHEAD', w / 2, h * 0.86);
  });
}

function grassTexture() {
  return canvasTexture(256, 256, (ctx, w, h) => {
    ctx.fillStyle = '#4e8f43';
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 1400; i++) {
      ctx.fillStyle = Math.random() > 0.5 ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.08)';
      ctx.fillRect(Math.random() * w, Math.random() * h, 2, 3);
    }
  });
}

function sandTexture() {
  return canvasTexture(256, 256, (ctx, w, h) => {
    ctx.fillStyle = '#d9bd8f';
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 1600; i++) {
      ctx.fillStyle = Math.random() > 0.5 ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.05)';
      ctx.fillRect(Math.random() * w, Math.random() * h, 2, 2);
    }
  });
}

function sunSprite() {
  const t = canvasTexture(256, 256, (ctx, w, h) => {
    const g = ctx.createRadialGradient(w / 2, h / 2, 8, w / 2, h / 2, w / 2);
    g.addColorStop(0, 'rgba(255,246,220,1)');
    g.addColorStop(0.25, 'rgba(255,225,160,0.9)');
    g.addColorStop(1, 'rgba(255,210,130,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  });
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, depthWrite: false, transparent: true }));
  s.scale.set(90, 90, 1);
  return s;
}

// ── scene ────────────────────────────────────────────────────────────────────
export default class ThreeRaceScene {
  constructor({ container, emitter, laneCount = 3, avatarKey = 'alex', avatarName = 'ALEX', accessorySlots = [], carDesignId }) {
    this.container = container;
    this.emitter = emitter;
    this.laneCount = laneCount;
    this.avatarKey = avatarKey;
    this.avatarName = (avatarName || 'ALEX').toUpperCase().slice(0, 10);
    this.accessorySlots = accessorySlots; // every equipped garage slot → its own visual on the car
    this.carDesignId = carDesignId; // which car design (see carBuilder.js CAR_DESIGNS) — undefined = default
    this.flameScale = 1; // EXHAUST/BOOST accessories enlarge the flames

    this.locked = true; // countdown / feedback pauses full speed
    this.stopped = false; // full brake-stop while answer feedback shows
    this.pendingBoost = false; // relaunch with a boost after a correct answer
    this.speed = 0; // 0..1.45 (boost)
    this.prevSpeed = 0;
    this.speedTarget = 0.3;
    this.currentLane = Math.floor(laneCount / 2);
    this.shake = 0;
    this.boostUntil = 0;
    this.elapsed = 0;
    this.smokeOn = false;
    this.flamesOn = false;
    this.parked = false; // true while stopped on the road at a checkpoint, answering
    this.manualThrottle = 1; // player-controlled cruise level while driving (↑/↓ keys)
    this.throttleInput = 0; // -1 (↓ held) / 0 / 1 (↑ held) — see setThrottleInput()
    this.viewMode = 'chase'; // 'chase' (outside, default) | 'cockpit' (inside) — see setViewMode()
    this.paused = false;
    this._telemetryAccum = 0;

    this.roadW = laneCount * LANE_W + 1.6;
    this.parkX = this.roadW / 2 + 2.6; // roadside checkpoint sign lane, right shoulder (decorative only)

    // The real, fixed, closed-loop circuit — see trackPath.js. distTraveled is
    // the car's arc-length position along it (keeps counting up; sampleTrack
    // wraps it into a lap fraction), lateralOffset is how far across the
    // track (steering) it currently sits.
    const { curve, totalLength } = buildTrackCurve(TRACK_RADIUS);
    this.curve = curve;
    this.totalLength = totalLength;
    this.distTraveled = 0;
    this.lateralOffset = this.laneX(this.currentLane);
    this.camPos = new THREE.Vector3();
    this.camLookAt = new THREE.Vector3();

    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    container.appendChild(this.renderer.domElement);
    this.renderer.domElement.style.width = '100%';
    this.renderer.domElement.style.height = '100%';
    this.renderer.domElement.style.display = 'block';

    this.scene = new THREE.Scene();
    this.scene.background = skyTexture();
    this.scene.fog = new THREE.Fog(0xf0d3a8, 70, 420);

    this.camera = new THREE.PerspectiveCamera(60, 16 / 9, 0.1, 900);
    this.baseFov = 60;

    this.buildLights();
    this.buildWorld();
    this.buildCar();

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
    this.scene.add(new THREE.HemisphereLight(0xcfe4ff, 0x6d5f45, 0.95));
    // The sun (and its shadow frustum) and its sky-disc sprite are pure
    // atmosphere, not tied to the track's shape — since the car now really
    // travels the full loop (not just a few lanes near the origin), both are
    // re-centred on the car every frame in update() so the shadow always
    // lands under it and the sun stays in a consistent spot in the sky.
    const sun = new THREE.DirectionalLight(0xffe2b0, 2.0);
    sun.position.set(-30, 55, -70);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    sun.shadow.camera.left = -16;
    sun.shadow.camera.right = 16;
    sun.shadow.camera.top = 20;
    sun.shadow.camera.bottom = -20;
    sun.shadow.camera.far = 200;
    this.scene.add(sun);
    this.scene.add(sun.target);
    this.sun = sun;

    this.sunDisc = sunSprite();
    this.sunDisc.position.set(-55, 26, -380);
    this.scene.add(this.sunDisc);

    // soft fill from behind the camera so the car isn't backlit into silhouette
    const fill = new THREE.DirectionalLight(0xdceaff, 0.7);
    fill.position.set(4, 12, 40);
    this.scene.add(fill);
  }

  buildWorld() {
    const halfRoad = this.roadW / 2;
    const { curve, totalLength } = this;
    this.trackGroup = new THREE.Group(); // everything tied to the circuit's own shape
    this.scene.add(this.trackGroup);

    // road + kerbs + sand + grass — ribbons that actually follow the curve
    this.trackGroup.add(buildRibbon({
      curve, totalLength, width: this.roadW,
      material: new THREE.MeshStandardMaterial({ map: roadTexture(this.laneCount), roughness: 1, metalness: 0 }),
      uAlongTilesPerUnit: 1 / 20,
    }));
    [-1, 1].forEach((s) => this.trackGroup.add(buildRibbon({
      curve, totalLength, width: 0.8, y: 0.01, offset: s * (halfRoad + 0.4),
      material: new THREE.MeshStandardMaterial({ map: kerbTexture(), roughness: 1 }),
      uAlongTilesPerUnit: 1 / 4,
    })));
    [-1, 1].forEach((s) => this.trackGroup.add(buildRibbon({
      curve, totalLength, width: 5, y: -0.01, offset: s * (halfRoad + 3.3),
      material: new THREE.MeshStandardMaterial({ map: sandTexture(), roughness: 1 }),
      uAlongTilesPerUnit: 1 / 10,
    })));
    this.trackGroup.add(buildRibbon({
      curve, totalLength, width: 240, y: -0.03,
      material: new THREE.MeshStandardMaterial({ map: grassTexture(), roughness: 1 }),
      uAcrossTiles: 20, uAlongTilesPerUnit: 1 / 12,
    }));

    // sponsor rails on both sides, following the curve
    [-1, 1].forEach((s) => this.trackGroup.add(buildWall({
      curve, totalLength, height: 1.1, y0: 0, offset: s * (halfRoad + 5.9),
      material: new THREE.MeshStandardMaterial({ map: railTexture(), roughness: 0.8, side: THREE.DoubleSide }),
      uAlongTilesPerUnit: 1 / 26,
    })));

    // distant hills — a full static ring around the whole circuit (not tied
    // to the car), so there's always a backdrop no matter which way the
    // track is currently curving; they fade out via fog at the far edge.
    const hillMat = new THREE.MeshBasicMaterial({ color: 0x9db38a, fog: true });
    const HILL_COUNT = 20;
    const HILL_RING_R = TRACK_RADIUS + 260;
    for (let i = 0; i < HILL_COUNT; i++) {
      const a = (i / HILL_COUNT) * Math.PI * 2;
      const hill = new THREE.Mesh(new THREE.SphereGeometry(70 + (i % 3) * 34, 16, 12), hillMat);
      hill.scale.y = 0.22;
      hill.position.set(Math.sin(a) * HILL_RING_R, -4, -Math.cos(a) * HILL_RING_R);
      this.scene.add(hill);
    }

    // ── scenery placed once, statically, around the fixed loop ──
    const gantryTex = gantryTexture();
    placeAlongTrack({
      curve, totalLength, group: this.trackGroup, count: Math.max(3, Math.round(totalLength / 165)),
      make: () => this.makeGantry(gantryTex),
    });
    const checkpointTex = checkpointSignTexture();
    placeAlongTrack({
      curve, totalLength, group: this.trackGroup, count: Math.max(4, Math.round(totalLength / 150)),
      make: () => this.makeCheckpointSign(checkpointTex), sideOffset: this.parkX, startT: 0.03,
    });
    placeAlongTrack({
      curve, totalLength, group: this.trackGroup, count: Math.max(4, Math.round(totalLength / 180)),
      make: () => this.makeGrandstand(), sideOffset: halfRoad + 13, startT: 0.06,
    });
    placeAlongTrack({
      curve, totalLength, group: this.trackGroup, count: Math.round(totalLength / 35),
      make: () => this.makeTree(0.8 + Math.random() * 0.7), sideOffset: -(halfRoad + 10),
    });
    placeAlongTrack({
      curve, totalLength, group: this.trackGroup, count: Math.round(totalLength / 42),
      make: () => this.makeTree(1.1 + Math.random() * 0.6), sideOffset: -(halfRoad + 20), startT: 0.02,
    });
    placeAlongTrack({
      curve, totalLength, group: this.trackGroup, count: Math.round(totalLength / 90),
      make: () => this.makeLightPole(), sideOffset: halfRoad + 6.8, startT: 0.01,
    });
  }

  makeGantry(tex) {
    const g = new THREE.Group();
    const halfRoad = this.roadW / 2;
    const towerMat = new THREE.MeshStandardMaterial({ color: 0x2a3446, roughness: 0.6 });
    [-1, 1].forEach((s) => {
      const tower = new THREE.Mesh(new THREE.BoxGeometry(0.7, 7.5, 0.7), towerMat);
      tower.position.set(s * (halfRoad + 1.8), 3.75, 0);
      tower.castShadow = true;
      g.add(tower);
    });
    const banner = new THREE.Mesh(
      new THREE.PlaneGeometry(this.roadW + 4.2, 1.9),
      new THREE.MeshStandardMaterial({ map: tex, roughness: 0.7, side: THREE.DoubleSide }),
    );
    banner.position.set(0, 6.4, 0);
    g.add(banner);
    return g;
  }

  // Roadside checkpoint sign — a visual cue that a checkpoint is coming up,
  // not a synced trigger (the car itself stops on the road, in-lane; it
  // never actually pulls in next to the sign).
  makeCheckpointSign(tex) {
    const g = new THREE.Group();
    const poleMat = new THREE.MeshStandardMaterial({ color: 0x2a3446, roughness: 0.6 });
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 3.4, 10), poleMat);
    pole.position.set(0, 1.7, 0);
    pole.castShadow = true;
    g.add(pole);
    const plate = new THREE.Mesh(
      new THREE.PlaneGeometry(1.7, 2.1),
      new THREE.MeshStandardMaterial({ map: tex, roughness: 0.7, side: THREE.DoubleSide }),
    );
    plate.position.set(0, 3.3, 0);
    g.add(plate);
    return g;
  }

  makeGrandstand() {
    const g = new THREE.Group();
    const colors = [0x8f2f3b, 0x2f4f8f, 0x8a713a];
    for (let r = 0; r < 3; r++) {
      const row = new THREE.Mesh(
        new THREE.BoxGeometry(26, 1.5, 3),
        new THREE.MeshStandardMaterial({ color: colors[r % colors.length], roughness: 0.9 }),
      );
      row.position.set(r * 2.4, 0.75 + r * 1.5, 0);
      row.castShadow = true;
      g.add(row);
    }
    const roof = new THREE.Mesh(
      new THREE.BoxGeometry(26, 0.3, 9),
      new THREE.MeshStandardMaterial({ color: 0xd8dde5, roughness: 0.6 }),
    );
    roof.position.set(2.5, 6.2, 0);
    g.add(roof);
    return g;
  }

  makeTree(scale) {
    const g = new THREE.Group();
    const trunk = new THREE.Mesh(
      new THREE.CylinderGeometry(0.25, 0.35, 2.4, 6),
      new THREE.MeshStandardMaterial({ color: 0x6b4a2c, roughness: 1 }),
    );
    trunk.position.y = 1.2;
    const crown = new THREE.Mesh(
      new THREE.ConeGeometry(2.2, 4.6, 8),
      new THREE.MeshStandardMaterial({ color: 0x2f6b34, roughness: 1 }),
    );
    crown.position.y = 4.4;
    crown.castShadow = true;
    g.add(trunk, crown);
    g.scale.setScalar(scale);
    return g;
  }

  makeLightPole() {
    const g = new THREE.Group();
    const halfRoad = this.roadW / 2;
    const mat = new THREE.MeshStandardMaterial({ color: 0xb9c2ce, roughness: 0.5, metalness: 0.6 });
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 7, 8), mat);
    pole.position.set(0, 3.5, 0);
    const arm = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.14, 0.14), mat);
    arm.position.set(-1.1, 6.9, 0);
    const lamp = new THREE.Mesh(
      new THREE.BoxGeometry(0.9, 0.18, 0.4),
      new THREE.MeshStandardMaterial({ color: 0xfff2cc, emissive: 0xffedb8, emissiveIntensity: 0.7 }),
    );
    lamp.position.set(-2.1, 6.8, 0);
    g.add(pole, arm, lamp);
    void halfRoad;
    return g;
  }

  // Car mesh geometry/materials live in carBuilder.js (shared with the pre-race
  // ThreeCarPreviewScene); this wrapper places it on the track and keeps the
  // per-part references this scene animates (wheels, flames, smoke, etc.).
  buildCar() {
    const parts = buildCarMesh({
      avatarKey: this.avatarKey,
      avatarName: this.avatarName,
      accessorySlots: this.accessorySlots,
      carDesignId: this.carDesignId,
    });
    this.wheels = parts.wheels;
    this.flameParts = parts.flameParts;
    this.smokeParts = parts.smokeParts;
    this.flameScale = parts.flameScale;
    this.tailLight = parts.tailLight;
    this.wingParts = parts.wingParts;
    this.trailMesh = parts.trailMesh;
    this.specialGem = parts.specialGem;
    this.driverParts = parts.driverParts; // hidden in cockpit view — the camera IS the driver
    this.windshield = parts.windshield;
    this.eyePoint = parts.eyePoint; // car-local {y,z} — where the cockpit camera sits
    this.headlights = parts.headlights;
    this.headlightsOn = false;

    const { point, tangent, right } = sampleTrack(this.curve, 0);
    parts.car.position.set(point.x + right.x * this.lateralOffset, 0, point.z + right.z * this.lateralOffset);
    parts.car.rotation.y = headingAngle(tangent);
    this.car = parts.car;
    this.scene.add(this.car);

    this.buildCockpitProps();
  }

  // A steering wheel + dashboard rim, parented to the camera itself so it
  // always sits in the same spot on screen — the classic cheap way to fake an
  // interior view without building a real cockpit model. Only shown in
  // 'cockpit' viewMode (see setViewMode()/toggleView()).
  buildCockpitProps() {
    const g = new THREE.Group();
    const trimMat = new THREE.MeshStandardMaterial({ color: 0x1b1f27, roughness: 0.6, metalness: 0.3 });
    const wheelMat = new THREE.MeshStandardMaterial({ color: 0x14171d, roughness: 0.5, metalness: 0.4 });
    const dash = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.22, 0.5), trimMat);
    dash.position.set(0, -0.42, -0.85);
    g.add(dash);
    const wheel = new THREE.Mesh(new THREE.TorusGeometry(0.24, 0.035, 10, 24), wheelMat);
    wheel.position.set(0, -0.32, -0.62);
    wheel.rotation.x = Math.PI / 2.35;
    g.add(wheel);
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.05, 12), wheelMat);
    hub.position.copy(wheel.position);
    hub.rotation.x = wheel.rotation.x;
    g.add(hub);
    g.visible = false;
    this.camera.add(g);
    this.scene.add(this.camera); // camera must be in the scene graph for its children to render
    this.cockpitProps = g;
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
    // widen the view on narrow/portrait screens so the road + car stay framed
    this.baseFov = aspect < 0.8 ? 80 : aspect < 1.3 ? 70 : 60;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h, false);
  }

  update(dt) {
    if (this.paused) {
      this.renderer.render(this.scene, this.camera);
      return;
    }
    this.elapsed += dt;

    // speed: full stop during answer feedback or while stopped at a checkpoint
    // (right on the road, in-lane — no pull-off), crawl in countdown, boost on
    // relaunch, otherwise the player's own ↑/↓ throttle while free-driving
    const boosting = this.elapsed < this.boostUntil;
    const braking = this.stopped || this.parked;
    if (!braking && !this.locked) {
      this.manualThrottle = THREE.MathUtils.clamp(this.manualThrottle + this.throttleInput * dt * 0.8, 0.2, 1.6);
    }
    this.speedTarget = braking ? 0 : boosting ? 1.45 : this.locked ? 0.3 : this.manualThrottle;
    // brake hard into a stop, ease back up when racing resumes
    this.speed += (this.speedTarget - this.speed) * Math.min(1, dt * (braking ? 7 : 3));
    if (braking && this.speed < 0.01) this.speed = 0;
    const dist = this.speed * WORLD_SPEED * dt;

    // advance along the fixed circuit (sampleTrack wraps this into a lap
    // fraction automatically, so the car just keeps lapping)
    this.distTraveled += dist;
    const { point, tangent, right } = sampleTrack(this.curve, this.distTraveled / this.totalLength);
    const heading = headingAngle(tangent);

    // brake dive / launch squat from acceleration
    const accel = (this.speed - this.prevSpeed) / Math.max(dt, 1e-4);
    this.prevSpeed = this.speed;

    // wheels
    const wheelRot = (dist / 0.42);
    this.wheels.forEach((w) => (w.rotation.x += wheelRot));

    // steer across the track (lateral offset from centreline) toward the
    // current lane, with body roll + yaw layered on top of the track's own
    // heading — same lane-steering whether driving or stopped at a
    // checkpoint, so the car brakes to a stop ON the road (in whichever lane
    // it's in) instead of pulling off it; the player then steers across
    // lanes to pick an answer while stationary.
    const targetLateral = this.laneX(this.currentLane);
    const dLat = targetLateral - this.lateralOffset;
    this.lateralOffset += dLat * Math.min(1, dt * 7);

    this.car.position.set(point.x + right.x * this.lateralOffset, 0, point.z + right.z * this.lateralOffset);
    this.car.rotation.x = THREE.MathUtils.clamp(accel * 0.045, -0.09, 0.06);
    this.car.rotation.y = heading + THREE.MathUtils.clamp(-dLat * 0.14, -0.3, 0.3);
    this.car.rotation.z = THREE.MathUtils.clamp(dLat * 0.05, -0.12, 0.12);
    // subtle bounce
    this.car.position.y = Math.sin(this.elapsed * 22) * 0.012 * this.speed;

    // keep the sun (+ its shadow frustum) and sky disc centred on wherever
    // the car currently is on the loop — pure atmosphere, not tied to the
    // track's actual shape, but the shadow frustum is a fixed-size box that
    // has to stay near the car to catch its shadow at all.
    this.sun.position.set(this.car.position.x - 30, 55, this.car.position.z - 70);
    this.sun.target.position.copy(this.car.position);
    this.sunDisc.position.set(this.car.position.x - 55, 26, this.car.position.z - 380);

    // flames flicker
    const flameOn = this.flamesOn || boosting;
    this.flameParts.forEach((f, i) => {
      f.material.opacity += ((flameOn ? 0.9 : 0) - f.material.opacity) * Math.min(1, dt * 10);
      const s = flameOn ? 0.8 + Math.abs(Math.sin(this.elapsed * 30 + i * 2)) * 0.6 : 0.6;
      f.scale.set(this.flameScale, s * this.flameScale, this.flameScale);
    });

    // accessory animations
    if (this.wingParts) {
      const flap = 0.14 * Math.sin(this.elapsed * 7);
      this.wingParts.forEach((w) => (w.rotation.z = w.userData.side * (0.15 + flap)));
    }
    if (this.trailMesh) this.trailMesh.material.opacity = 0.06 + this.speed * 0.32;
    if (this.specialGem) this.specialGem.rotation.y += dt * 2.5;
    this.tailLight.material.emissiveIntensity = this.locked ? 2.6 : 1.2;

    // smoke drift
    this.smokeParts.forEach((p) => {
      if (!this.smokeOn) {
        p.material.opacity += (0 - p.material.opacity) * Math.min(1, dt * 6);
        return;
      }
      const t = (this.elapsed * 0.9 + p.userData.seed) % 1;
      p.position.set(
        Math.sin((p.userData.seed + t) * 12) * 0.3,
        0.5 + t * 1.3,
        1.9 + t * 1.6,
      );
      const sc = 0.6 + t * 1.8;
      p.scale.setScalar(sc);
      p.material.opacity = 0.55 * (1 - t);
    });

    // camera: either the usual chase cam (sampled slightly behind/ahead of
    // the car along THE CURVE, not a fixed world-space offset, so it stays on
    // the road through bends instead of cutting across the infield) or, in
    // 'cockpit' viewMode, rigidly glued to the driver's eye point — see
    // setViewMode()/toggleView(). FOV widens with speed, shake decays; the
    // chase cam's position/look-at ease toward their targets so bends don't
    // whip the view around.
    this.shake = Math.max(0, this.shake - dt * 2.2);
    const shx = (Math.random() - 0.5) * this.shake * 0.5;
    const shy = (Math.random() - 0.5) * this.shake * 0.35;

    if (this.viewMode === 'cockpit') {
      const eye = new THREE.Vector3(0, this.eyePoint.y, this.eyePoint.z).applyQuaternion(this.car.quaternion).add(this.car.position);
      this.camera.position.copy(eye);
      this.camera.quaternion.copy(this.car.quaternion);
      this._camInit = false; // re-init the chase cam cleanly if the player switches back
    } else {
      const lateralBias = this.lateralOffset * 0.6;
      const behind = sampleTrack(this.curve, (this.distTraveled - CAM_BEHIND) / this.totalLength);
      const ahead = sampleTrack(this.curve, (this.distTraveled + CAM_AHEAD) / this.totalLength);
      const camTarget = new THREE.Vector3(
        behind.point.x + behind.right.x * lateralBias,
        5.2,
        behind.point.z + behind.right.z * lateralBias,
      );
      const lookTarget = new THREE.Vector3(
        ahead.point.x + ahead.right.x * lateralBias * 0.85,
        0.3,
        ahead.point.z + ahead.right.z * lateralBias * 0.85,
      );
      if (this._camInit) {
        this.camPos.lerp(camTarget, Math.min(1, dt * 5));
        this.camLookAt.lerp(lookTarget, Math.min(1, dt * 5));
      } else {
        this.camPos.copy(camTarget);
        this.camLookAt.copy(lookTarget);
        this._camInit = true;
      }
      this.camera.position.copy(this.camPos);
      this.camera.lookAt(this.camLookAt);
    }
    const fovTarget = this.baseFov + this.speed * (this.viewMode === 'cockpit' ? 3 : 6);
    this.camera.fov += (fovTarget - this.camera.fov) * Math.min(1, dt * 4);
    this.camera.updateProjectionMatrix();

    // project each lane (at the car's own point on the track) to screen —
    // (pre-shake, so the overlay cards pinned to the lanes don't jitter) and
    // report it; the Race screen anchors each bubble over its lane
    if (this.onLaneLayout) {
      const v = new THREE.Vector3();
      const xs = [];
      for (let i = 0; i < this.laneCount; i++) {
        const lx = point.x + right.x * this.laneX(i);
        const lz = point.z + right.z * this.laneX(i);
        v.set(lx, 0.2, lz).project(this.camera);
        xs.push((v.x + 1) / 2);
      }
      if (!this.lastLaneXs || xs.some((x, i) => Math.abs(x - this.lastLaneXs[i]) > 0.003)) {
        this.lastLaneXs = xs;
        this.onLaneLayout(xs);
      }
    }

    // camera shake is applied after the projection, render-only
    this.camera.position.x += shx;
    this.camera.position.y += shy;

    // live telemetry for the HUD (speedometer + distance readout) — real
    // numbers off the same speed/distance the scene itself drives with, just
    // throttled to ~8Hz so it doesn't force a React re-render every frame
    this._telemetryAccum += dt;
    if (this.onTelemetry && this._telemetryAccum >= 0.12) {
      this._telemetryAccum = 0;
      this.onTelemetry({
        speedKmh: Math.round(this.speed * WORLD_SPEED * 3.6),
        distanceM: Math.round(this.distTraveled),
      });
    }

    this.renderer.render(this.scene, this.camera);
  }

  // ── imperative API (same contract as the old Phaser scene) ────────────────
  steerTo(lane) {
    this.currentLane = THREE.MathUtils.clamp(lane, 0, this.laneCount - 1);
  }

  // Inside/outside camera toggle. 'cockpit' hides the driver figure + tints
  // down the windshield (the camera IS the driver's eyes now) and shows the
  // steering-wheel/dash props built in buildCockpitProps(); 'chase' is the
  // usual third-person view. Race.jsx drives this from a HUD button.
  setViewMode(mode) {
    this.viewMode = mode === 'cockpit' ? 'cockpit' : 'chase';
    const inCockpit = this.viewMode === 'cockpit';
    this.driverParts?.forEach((p) => (p.visible = !inCockpit));
    if (this.windshield) this.windshield.visible = !inCockpit;
    if (this.cockpitProps) this.cockpitProps.visible = inCockpit;
  }

  toggleView() {
    this.setViewMode(this.viewMode === 'cockpit' ? 'chase' : 'cockpit');
  }

  // Headlight on/off toggle — HUD flavor button, purely visual (brightens the
  // headlight emissive; the fixed sunset lighting means this reads as more of
  // a "high beam" accent than a real day/night change).
  toggleHeadlights() {
    this.headlightsOn = !this.headlightsOn;
    this.headlights?.forEach((h) => (h.material.emissiveIntensity = this.headlightsOn ? 2.4 : 0.9));
    return this.headlightsOn;
  }

  // True pause — freezes the whole sim (still renders the current frame), for
  // the HUD's pause button.
  setPaused(paused) {
    this.paused = paused;
  }

  startRacing() {
    this.locked = false;
    this.stopped = false;
    this.flamesOn = false;
    this.manualThrottle = 1;
  }

  // ↑/↓ throttle control while free-driving (ignored while braking/locked —
  // see update()). dir: 1 = accelerate, -1 = brake/slow, 0 = coast.
  setThrottleInput(dir) {
    this.throttleInput = THREE.MathUtils.clamp(dir, -1, 1);
  }

  applyQuestion() {
    this.locked = false;
    this.stopped = false;
    this.flamesOn = false;
    this.smokeOn = false;
    // relaunch with a flame boost after a correct answer
    if (this.pendingBoost) {
      this.pendingBoost = false;
      this.boostUntil = this.elapsed + 1.2;
    }
    this.currentLane = Math.floor(this.laneCount / 2);
  }

  // Brake to a full stop while the feedback overlay shows (~2s in Race.jsx),
  // then applyQuestion() relaunches — with a boost if the answer was correct.
  playFeedback({ isCorrect }) {
    this.locked = true;
    this.stopped = true;
    this.pendingBoost = isCorrect;
    if (isCorrect) {
      this.shake = 0.3;
    } else {
      this.smokeOn = true;
      this.shake = 0.8;
    }
  }

  // Checkpoint stop. The car brakes to a full stop ON THE ROAD, in whatever
  // lane it's in — it never leaves the racing line — so the player can then
  // steer across lanes (same chooseLane/commit as always) to pick an answer
  // while stationary. The question overlay only shows once it's actually
  // stopped. (ThreeSubwayScene implements the same pair for Subway Surfer.)
  enterCheckpoint() {
    this.parked = true;
    this.locked = true;
    this.flamesOn = false;
    this.smokeOn = false;
  }

  // Resumes driving toward the next checkpoint, re-centering to the middle
  // lane first (same relaunch as applyQuestion()) and resetting the ↑/↓
  // throttle back to a normal cruise.
  exitCheckpoint() {
    this.parked = false;
    this.locked = false;
    this.currentLane = Math.floor(this.laneCount / 2);
    this.manualThrottle = 1;
  }

  resetSigns() {
    this.flamesOn = false;
    this.smokeOn = false;
  }

  destroy() {
    this.running = false;
    cancelAnimationFrame(this.raf);
    this.ro?.disconnect();
    this.emitter?.off?.('setLane', this.onSetLane);
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
