import * as THREE from 'three';

// Real-3D replacement for the old Phaser pseudo-3D road (RaceScene.js).
// Renders a sunset circuit — asphalt, kerbs, sponsor rails, overhead gantries,
// grandstands — with a third-person sports car that steers between lanes.
// It exposes the exact same imperative API the Race screen already uses
// (startRacing / applyQuestion / playFeedback / resetSigns + 'setLane' on the
// emitter), so all game logic stays untouched and server-authoritative.

// Car paint per avatar (keeps each avatar's identity like the old kart colors).
const CAR_PAINT = {
  alex: 0xf2f4f7, // white, GT-style
  maya: 0x8b5cf6,
  omar: 0xf59e0b,
  aya: 0x14b8a6,
  james: 0x4f46e5,
  ava: 0xe11d48,
};

// Driver colours per avatar — same palette the old Phaser kart used.
const DRIVER_COLORS = {
  alex: { helmet: 0x1f2937, suit: 0x111827, skin: 0xf1c9a5 },
  maya: { helmet: 0x7e22ce, suit: 0x4c1d95, skin: 0xf1c9a5 },
  omar: { helmet: 0xb45309, suit: 0x78350f, skin: 0xd9a066 },
  aya: { helmet: 0x0f766e, suit: 0x134e4a, skin: 0xd9a066 },
  james: { helmet: 0x3730a3, suit: 0x1e1b4b, skin: 0x8d5524 },
  ava: { helmet: 0x9f1239, suit: 0x881337, skin: 0xf1c9a5 },
};

const LANE_W = 4.4; // world units per lane
const ROAD_LEN = 620; // how far the track stretches ahead
const WORLD_SPEED = 30; // units/sec at full speed

// ── tiny canvas-texture helpers ──────────────────────────────────────────────
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

function namePlateTexture(name) {
  return canvasTexture(256, 64, (ctx, w, h) => {
    ctx.fillStyle = '#0b1220';
    ctx.beginPath();
    ctx.roundRect(0, 0, w, h, 12);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = 4;
    ctx.stroke();
    ctx.fillStyle = '#e6eefc';
    ctx.font = 'bold 36px Poppins, Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(name, w / 2, h / 2 + 1);
  });
}

// ── scene ────────────────────────────────────────────────────────────────────
export default class ThreeRaceScene {
  constructor({ container, emitter, laneCount = 3, avatarKey = 'alex', avatarName = 'ALEX', accessorySlot = null }) {
    this.container = container;
    this.emitter = emitter;
    this.laneCount = laneCount;
    this.avatarKey = avatarKey;
    this.avatarName = (avatarName || 'ALEX').toUpperCase().slice(0, 10);
    this.accessorySlot = accessorySlot; // equipped garage accessory → visual on the car
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

    this.roadW = laneCount * LANE_W + 1.6;

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
    const sun = new THREE.DirectionalLight(0xffe2b0, 2.0);
    sun.position.set(-30, 55, -70); // high sun = short, tidy car shadow
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    sun.shadow.camera.left = -16;
    sun.shadow.camera.right = 16;
    sun.shadow.camera.top = 20;
    sun.shadow.camera.bottom = -20;
    sun.shadow.camera.far = 200;
    this.scene.add(sun);
    this.scene.add(sun.target);

    const disc = sunSprite();
    disc.position.set(-55, 26, -380);
    this.scene.add(disc);

    // soft fill from behind the camera so the car isn't backlit into silhouette
    const fill = new THREE.DirectionalLight(0xdceaff, 0.7);
    fill.position.set(4, 12, 40);
    this.scene.add(fill);
  }

  buildWorld() {
    const halfRoad = this.roadW / 2;
    this.movers = []; // pooled objects that scroll toward the camera
    this.scrollMats = []; // {tex, axis, sign, perUnit} texture-scrolled surfaces

    const addScrollPlane = (tex, w, len, x, y, tilesAlong, sign = 1, axis = 'y') => {
      const geo = new THREE.PlaneGeometry(w, len);
      const mat = new THREE.MeshStandardMaterial({ map: tex, roughness: 1, metalness: 0 });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.rotation.x = -Math.PI / 2;
      mesh.position.set(x, y, -ROAD_LEN / 2 + 30);
      mesh.receiveShadow = true;
      tex.repeat.set(1, tilesAlong);
      this.scene.add(mesh);
      this.scrollMats.push({ tex, axis, sign, perUnit: tilesAlong / ROAD_LEN });
      return mesh;
    };

    // road + kerbs + sand + grass
    addScrollPlane(roadTexture(this.laneCount), this.roadW, ROAD_LEN, 0, 0, ROAD_LEN / 20);
    addScrollPlane(kerbTexture(), 0.8, ROAD_LEN, -(halfRoad + 0.4), 0.01, ROAD_LEN / 4);
    addScrollPlane(kerbTexture(), 0.8, ROAD_LEN, halfRoad + 0.4, 0.01, ROAD_LEN / 4);
    addScrollPlane(sandTexture(), 5, ROAD_LEN, -(halfRoad + 3.3), -0.01, ROAD_LEN / 10);
    addScrollPlane(sandTexture(), 5, ROAD_LEN, halfRoad + 3.3, -0.01, ROAD_LEN / 10);
    const grass = new THREE.Mesh(
      new THREE.PlaneGeometry(700, ROAD_LEN + 200),
      new THREE.MeshStandardMaterial({ map: grassTexture(), roughness: 1 }),
    );
    grass.rotation.x = -Math.PI / 2;
    grass.position.set(0, -0.03, -ROAD_LEN / 2 + 60);
    grass.material.map.repeat.set(60, 70);
    grass.receiveShadow = true;
    this.scene.add(grass);

    // sponsor rails on both sides (texture-scrolled so they fly past)
    const railTex = railTexture();
    const railTexR = railTexture();
    const mkRail = (x, rotY, tex, sign) => {
      const m = new THREE.Mesh(
        new THREE.PlaneGeometry(ROAD_LEN, 1.1),
        new THREE.MeshStandardMaterial({ map: tex, roughness: 0.8, side: THREE.DoubleSide }),
      );
      m.position.set(x, 0.55, -ROAD_LEN / 2 + 30);
      m.rotation.y = rotY;
      tex.repeat.set(ROAD_LEN / 26, 1);
      this.scene.add(m);
      this.scrollMats.push({ tex, axis: 'x', sign, perUnit: (ROAD_LEN / 26) / ROAD_LEN });
    };
    // rotY -90°: local +u points toward +z (camera) → offset decreases; +90°: opposite.
    mkRail(halfRoad + 5.9, -Math.PI / 2, railTex, -1);
    mkRail(-(halfRoad + 5.9), Math.PI / 2, railTexR, 1);

    // distant hills
    const hillMat = new THREE.MeshBasicMaterial({ color: 0x9db38a, fog: true });
    for (let i = 0; i < 7; i++) {
      const hill = new THREE.Mesh(new THREE.SphereGeometry(60 + (i % 3) * 30, 16, 12), hillMat);
      hill.scale.y = 0.22;
      hill.position.set(-260 + i * 90, -4, -430 - (i % 2) * 60);
      this.scene.add(hill);
    }

    // ── pooled scenery that scrolls past ──
    const gantryTex = gantryTexture();
    for (let i = 0; i < 3; i++) this.addMover(this.makeGantry(gantryTex), i * 210);
    for (let i = 0; i < 6; i++) {
      this.addMover(this.makeGrandstand(), i * 105 + 40, { side: 1 });
      this.addMover(this.makeTree(), i * 105 + 15, { side: -1 });
      this.addMover(this.makeTree(), i * 105 + 70, { side: -1, far: true });
      this.addMover(this.makeLightPole(), i * 105 + 60, { side: 1 });
    }
  }

  addMover(obj, offset, { side } = {}) {
    obj.position.z = -offset - 30;
    this.scene.add(obj);
    this.movers.push({ obj, span: 630, side });
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

  makeGrandstand() {
    const g = new THREE.Group();
    const halfRoad = this.roadW / 2;
    const colors = [0x8f2f3b, 0x2f4f8f, 0x8a713a];
    for (let r = 0; r < 3; r++) {
      const row = new THREE.Mesh(
        new THREE.BoxGeometry(26, 1.5, 3),
        new THREE.MeshStandardMaterial({ color: colors[r % colors.length], roughness: 0.9 }),
      );
      row.position.set(halfRoad + 13 + r * 2.4, 0.75 + r * 1.5, 0);
      row.castShadow = true;
      g.add(row);
    }
    const roof = new THREE.Mesh(
      new THREE.BoxGeometry(26, 0.3, 9),
      new THREE.MeshStandardMaterial({ color: 0xd8dde5, roughness: 0.6 }),
    );
    roof.position.set(halfRoad + 15.5, 6.2, 0);
    g.add(roof);
    return g;
  }

  makeTree() {
    const g = new THREE.Group();
    const halfRoad = this.roadW / 2;
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
    const dist = halfRoad + 10 + Math.random() * 14;
    g.position.x = -dist;
    g.scale.setScalar(0.8 + Math.random() * 0.7);
    return g;
  }

  makeLightPole() {
    const g = new THREE.Group();
    const halfRoad = this.roadW / 2;
    const mat = new THREE.MeshStandardMaterial({ color: 0xb9c2ce, roughness: 0.5, metalness: 0.6 });
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 7, 8), mat);
    pole.position.set(halfRoad + 6.8, 3.5, 0);
    const arm = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.14, 0.14), mat);
    arm.position.set(halfRoad + 5.7, 6.9, 0);
    const lamp = new THREE.Mesh(
      new THREE.BoxGeometry(0.9, 0.18, 0.4),
      new THREE.MeshStandardMaterial({ color: 0xfff2cc, emissive: 0xffedb8, emissiveIntensity: 0.7 }),
    );
    lamp.position.set(halfRoad + 4.7, 6.8, 0);
    g.add(pole, arm, lamp);
    return g;
  }

  buildCar() {
    const paint = CAR_PAINT[this.avatarKey] ?? CAR_PAINT.alex;
    const driver = DRIVER_COLORS[this.avatarKey] ?? DRIVER_COLORS.alex;
    const car = new THREE.Group();
    const bodyMat = new THREE.MeshStandardMaterial({ color: paint, roughness: 0.25, metalness: 0.55 });
    const darkMat = new THREE.MeshStandardMaterial({ color: 0x14181f, roughness: 0.55, metalness: 0.3 });

    // ── open-wheel racing car (rear view is what the player sees) ──
    // central tub
    const tub = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.42, 3.4), bodyMat);
    tub.position.set(0, 0.48, -0.2);
    tub.castShadow = true;
    car.add(tub);

    // tapered nose cone + front wing
    const nose = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.26, 1.3), bodyMat);
    nose.position.set(0, 0.46, -2.2);
    nose.rotation.x = 0.05;
    nose.castShadow = true;
    car.add(nose);
    const frontWing = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.07, 0.55), darkMat);
    frontWing.position.set(0, 0.26, -2.7);
    car.add(frontWing);
    [-1.02, 1.02].forEach((x) => {
      const ep = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.2, 0.55), bodyMat);
      ep.position.set(x, 0.34, -2.7);
      car.add(ep);
    });

    // sidepods
    [-0.78, 0.78].forEach((x) => {
      const pod = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.36, 1.7), bodyMat);
      pod.position.set(x, 0.44, 0.3);
      pod.castShadow = true;
      car.add(pod);
      const intake = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.24, 0.08), darkMat);
      intake.position.set(x, 0.46, -0.54);
      car.add(intake);
    });

    // cockpit rim + engine cover behind the driver
    const rim = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.14, 1.3), darkMat);
    rim.position.set(0, 0.74, -0.35);
    car.add(rim);
    const cover = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.5, 1.3), bodyMat);
    cover.position.set(0, 0.78, 0.95);
    cover.rotation.x = -0.1;
    cover.castShadow = true;
    car.add(cover);
    const airbox = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.24, 0.4), darkMat);
    airbox.position.set(0, 1.12, 0.62);
    car.add(airbox);

    // ── the driver — visible in the open cockpit (avatar suit + helmet) ──
    const suitMat = new THREE.MeshStandardMaterial({ color: driver.suit, roughness: 0.8 });
    const shoulders = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.34, 0.5), suitMat);
    shoulders.position.set(0, 0.92, -0.28);
    shoulders.castShadow = true;
    car.add(shoulders);
    const neck = new THREE.Mesh(
      new THREE.CylinderGeometry(0.09, 0.11, 0.12, 8),
      new THREE.MeshStandardMaterial({ color: driver.skin, roughness: 0.7 }),
    );
    neck.position.set(0, 1.12, -0.28);
    car.add(neck);
    const helmet = new THREE.Mesh(
      new THREE.SphereGeometry(0.21, 16, 14),
      new THREE.MeshStandardMaterial({ color: driver.helmet, roughness: 0.2, metalness: 0.35 }),
    );
    helmet.position.set(0, 1.3, -0.28);
    helmet.castShadow = true;
    car.add(helmet);
    const stripe = new THREE.Mesh(
      new THREE.BoxGeometry(0.05, 0.02, 0.4),
      new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.3 }),
    );
    stripe.position.set(0, 1.5, -0.28);
    car.add(stripe);

    // rear diffuser + tail light
    const diffuser = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.24, 0.3), darkMat);
    diffuser.position.set(0, 0.4, 1.62);
    car.add(diffuser);
    const tail = new THREE.Mesh(
      new THREE.BoxGeometry(0.5, 0.09, 0.06),
      new THREE.MeshStandardMaterial({ color: 0x550b0b, emissive: 0xff2222, emissiveIntensity: 1.4 }),
    );
    tail.position.set(0, 0.56, 1.78);
    car.add(tail);
    this.tailLight = tail;

    // ── big rear wing carrying the player's name, facing the camera ──
    [-0.5, 0.5].forEach((x) => {
      const strut = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.55, 0.2), darkMat);
      strut.position.set(x, 1.06, 1.55);
      car.add(strut);
    });
    const wing = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.5, 0.1), bodyMat);
    wing.position.set(0, 1.5, 1.6);
    wing.castShadow = true;
    car.add(wing);
    [-0.98, 0.98].forEach((x) => {
      const ep = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.62, 0.42), darkMat);
      ep.position.set(x, 1.5, 1.55);
      car.add(ep);
    });
    const namePlate = new THREE.Mesh(
      new THREE.PlaneGeometry(1.7, 0.42),
      new THREE.MeshBasicMaterial({ map: namePlateTexture(this.avatarName), transparent: true }),
    );
    namePlate.position.set(0, 1.5, 1.66);
    car.add(namePlate);

    // exposed wheels (bigger at the rear, open-wheel style) + axles
    this.wheels = [];
    const tyreMat = new THREE.MeshStandardMaterial({ color: 0x0c0e12, roughness: 0.95 });
    const rimMat = new THREE.MeshStandardMaterial({ color: 0x9aa3af, roughness: 0.3, metalness: 0.8 });
    [[-0.98, -1.55, 0.38], [0.98, -1.55, 0.38], [-0.98, 1.25, 0.46], [0.98, 1.25, 0.46]].forEach(([x, z, r]) => {
      const wheel = new THREE.Group();
      const tyre = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 0.4, 20), tyreMat);
      tyre.rotation.z = Math.PI / 2;
      tyre.castShadow = true;
      const hub = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.55, r * 0.55, 0.42, 12), rimMat);
      hub.rotation.z = Math.PI / 2;
      wheel.add(tyre, hub);
      wheel.position.set(x, r, z);
      car.add(wheel);
      this.wheels.push(wheel);
      const axle = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.08, 0.08), darkMat);
      axle.position.set(x * 0.62, r, z);
      car.add(axle);
    });

    // cyan under-glow (nod to the old kart's neon)
    const glow = new THREE.Mesh(
      new THREE.PlaneGeometry(2.4, 4.6),
      new THREE.MeshBasicMaterial({ color: 0x22d3ee, transparent: true, opacity: 0.16, depthWrite: false }),
    );
    glow.rotation.x = -Math.PI / 2;
    glow.position.y = 0.03;
    car.add(glow);

    // exhaust flames (correct answers / boost)
    this.flameParts = [];
    [-0.22, 0.22].forEach((x) => {
      const flame = new THREE.Mesh(
        new THREE.ConeGeometry(0.14, 0.9, 8),
        new THREE.MeshBasicMaterial({ color: 0xffa62b, transparent: true, opacity: 0 }),
      );
      flame.rotation.x = -Math.PI / 2;
      flame.position.set(x, 0.5, 2.25);
      car.add(flame);
      this.flameParts.push(flame);
    });

    // smoke puffs (wrong answers)
    this.smokeParts = [];
    for (let i = 0; i < 6; i++) {
      const puff = new THREE.Mesh(
        new THREE.SphereGeometry(0.22, 8, 8),
        new THREE.MeshBasicMaterial({ color: 0x8b949e, transparent: true, opacity: 0 }),
      );
      puff.position.set(0, 0.6, 1.9);
      puff.userData.seed = i / 6;
      car.add(puff);
      this.smokeParts.push(puff);
    }

    this.buildAccessory(car);

    car.position.set(this.laneX(this.currentLane), 0, 0);
    this.car = car;
    this.scene.add(car);
  }

  // Visual for the accessory equipped in the garage — one build per slot type.
  buildAccessory(car) {
    const slot = this.accessorySlot;
    if (!slot) return;
    const neon = new THREE.MeshBasicMaterial({
      color: 0x67e8f9, transparent: true, opacity: 0.8, side: THREE.DoubleSide, depthWrite: false,
    });
    const chrome = new THREE.MeshStandardMaterial({ color: 0xd7dde6, roughness: 0.15, metalness: 0.95 });
    const gold = new THREE.MeshStandardMaterial({
      color: 0xf6c453, roughness: 0.25, metalness: 0.85, emissive: 0x8a6410, emissiveIntensity: 0.4,
    });

    switch (slot) {
      case 'WINGS': {
        // neon wings sweeping up behind the driver (like the reference art)
        const shape = new THREE.Shape();
        shape.moveTo(0, 0);
        shape.quadraticCurveTo(0.9, 0.15, 1.6, 1.2);
        shape.quadraticCurveTo(0.75, 0.85, 0, 0.4);
        const geo = new THREE.ShapeGeometry(shape);
        this.wingParts = [-1, 1].map((side) => {
          const w = new THREE.Mesh(geo, neon);
          w.position.set(side * 0.35, 1.0, 0.1);
          w.scale.x = side; // mirror the second wing
          w.rotation.y = side * 0.55; // sweep outward and back
          w.userData.side = side;
          car.add(w);
          return w;
        });
        break;
      }
      case 'EXHAUST': {
        [-0.3, 0.3].forEach((x) => {
          const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.13, 0.85, 12), chrome);
          pipe.position.set(x, 0.68, 2.0);
          pipe.rotation.x = Math.PI / 2 - 0.25; // tilted up and out the back
          car.add(pipe);
        });
        this.flameParts.forEach((f, i) => f.position.set(i === 0 ? -0.3 : 0.3, 0.78, 2.5));
        this.flameScale = 1.5;
        break;
      }
      case 'BOOST': {
        // turbo booster rocket on the engine cover
        const body = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.95, 14), chrome);
        body.position.set(0, 1.0, 1.35);
        body.rotation.x = Math.PI / 2;
        car.add(body);
        const nozzle = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.16, 0.3, 14), gold);
        nozzle.position.set(0, 1.0, 1.95);
        nozzle.rotation.x = -Math.PI / 2;
        car.add(nozzle);
        this.flameParts.forEach((f, i) => f.position.set(i === 0 ? -0.08 : 0.08, 1.0, 2.35));
        this.flameScale = 1.9;
        break;
      }
      case 'BLADE': {
        const paintMat = car.children[0].material;
        const fin = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.6, 1.1), paintMat);
        fin.position.set(0, 1.25, 0.9);
        fin.rotation.x = 0.18;
        car.add(fin);
        const edge = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.05, 1.1), neon);
        edge.position.set(0, 1.56, 0.86);
        edge.rotation.x = 0.18;
        car.add(edge);
        break;
      }
      case 'HELMET': {
        const ring = new THREE.Mesh(new THREE.TorusGeometry(0.27, 0.045, 10, 24), gold);
        ring.position.set(0, 1.3, -0.28);
        ring.rotation.x = Math.PI / 2;
        car.add(ring);
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
          new THREE.PlaneGeometry(1.4, 4.5),
          new THREE.MeshBasicMaterial({ map: trailTex, transparent: true, opacity: 0.3, depthWrite: false }),
        );
        this.trailMesh.rotation.x = -Math.PI / 2;
        this.trailMesh.rotation.z = Math.PI; // fade away from the car
        this.trailMesh.position.set(0, 0.05, 4.3);
        car.add(this.trailMesh);
        break;
      }
      case 'BODY': {
        // neon body kit — glowing side skirts + front canards
        [-1.06, 1.06].forEach((x) => {
          const skirt = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.1, 2.6), neon);
          skirt.position.set(x, 0.24, -0.1);
          car.add(skirt);
          const canard = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.05, 0.4), neon);
          canard.position.set(x * 0.8, 0.5, -2.35);
          car.add(canard);
        });
        break;
      }
      case 'SPECIAL':
      default: {
        // golden gem hovering over the rear wing
        this.specialGem = new THREE.Mesh(new THREE.OctahedronGeometry(0.22), gold);
        this.specialGem.position.set(0, 2.15, 1.6);
        car.add(this.specialGem);
        break;
      }
    }
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
    this.elapsed += dt;

    // speed: full stop during answer feedback, crawl in countdown, boost on relaunch
    const boosting = this.elapsed < this.boostUntil;
    this.speedTarget = this.stopped ? 0 : boosting ? 1.45 : this.locked ? 0.3 : 1;
    // brake hard into a stop, ease back up when racing resumes
    this.speed += (this.speedTarget - this.speed) * Math.min(1, dt * (this.stopped ? 7 : 3));
    if (this.stopped && this.speed < 0.01) this.speed = 0;
    const dist = this.speed * WORLD_SPEED * dt;

    // brake dive / launch squat from acceleration
    const accel = (this.speed - this.prevSpeed) / Math.max(dt, 1e-4);
    this.prevSpeed = this.speed;
    this.car.rotation.x = THREE.MathUtils.clamp(accel * 0.045, -0.09, 0.06);

    // scroll every textured surface
    for (const s of this.scrollMats) {
      s.tex.offset[s.axis] += s.sign * dist * s.perUnit;
    }
    // scroll pooled scenery
    for (const m of this.movers) {
      m.obj.position.z += dist;
      if (m.obj.position.z > 14) m.obj.position.z -= m.span;
    }

    // wheels
    const wheelRot = (dist / 0.42);
    this.wheels.forEach((w) => (w.rotation.x += wheelRot));

    // steer toward target lane with body roll + yaw
    const targetX = this.laneX(this.currentLane);
    const dx = targetX - this.car.position.x;
    this.car.position.x += dx * Math.min(1, dt * 7);
    this.car.rotation.y = THREE.MathUtils.clamp(-dx * 0.14, -0.3, 0.3);
    this.car.rotation.z = THREE.MathUtils.clamp(dx * 0.05, -0.12, 0.12);
    // subtle bounce
    this.car.position.y = Math.sin(this.elapsed * 22) * 0.012 * this.speed;

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

    // camera: chase with lag, FOV widens with speed, shake decays
    this.shake = Math.max(0, this.shake - dt * 2.2);
    const shx = (Math.random() - 0.5) * this.shake * 0.5;
    const shy = (Math.random() - 0.5) * this.shake * 0.35;
    // mid-high chase camera: the whole car (medium size) sits in the strip
    // BELOW the answer bubbles — helmet at the bubble tails, wheels just above
    // the bottom edge — so it is never hidden behind the cards
    const camX = this.car.position.x * 0.6;
    this.camera.position.set(camX, 5.2, 8.6);
    this.camera.lookAt(this.car.position.x * 0.85, 0.3, -26);
    const fovTarget = this.baseFov + this.speed * 6;
    this.camera.fov += (fovTarget - this.camera.fov) * Math.min(1, dt * 4);
    this.camera.updateProjectionMatrix();

    // project each lane at the car's row — where the lanes are widest apart on
    // screen — (pre-shake, so the overlay cards pinned to the lanes don't
    // jitter) and report it; the Race screen anchors each bubble over its lane
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

    // camera shake is applied after the projection, render-only
    this.camera.position.x += shx;
    this.camera.position.y += shy;

    this.renderer.render(this.scene, this.camera);
  }

  // ── imperative API (same contract as the old Phaser scene) ────────────────
  steerTo(lane) {
    this.currentLane = THREE.MathUtils.clamp(lane, 0, this.laneCount - 1);
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
