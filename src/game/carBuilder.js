import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

// Shared car mesh builder — extracted from ThreeRaceScene.js so the live race
// scene AND the pre-race 3D car-preview scene (ThreeCarPreviewScene.js) render
// the exact same car from one place. Pure geometry/materials, no scene/physics
// state — callers own placement, animation and disposal.
//
// Real car models (optional): drop a .glb at public/models/car-<designId>.glb
// (e.g. car-apex.glb) for that one design, or public/models/car.glb to cover
// every design, and it's picked up automatically — same "async load, graceful
// fallback to the procedural version" pattern the runner/trees already use in
// ThreeSubwayScene.js. It's a FULL REPLACEMENT, not a combination — it hides
// the entire procedural car (body, wheels + axles, driver figure), so it
// should include its own wheels. The tail light + name plate stay on top of
// it either way, in the same car-local coordinates, so garage-accessory and
// answer-feedback effects (flames/smoke/wing) keep working regardless of
// which body is in use. See public/models/CREDITS.txt.
//
// 👉 If a real model ever looks like it's driving backward (or sideways),
// change this. Source tools don't agree on which axis is "forward" (Blender
// exports ≈ +Y, others vary), so an as-authored model is a coin flip on
// facing the right way once dropped into our -Z-is-forward convention. Try
// 0 first, then Math.PI, then ±Math.PI/2 — those four cover every case.
const REAL_MODEL_YAW = Math.PI;
const modelCache = {};
function loadRealCarModel(carDesignId) {
  const key = carDesignId || 'default';
  if (!modelCache[key]) {
    const base = import.meta.env.BASE_URL;
    modelCache[key] = new Promise((resolve) => {
      const tryLoad = (url, fallbackUrl) => {
        new GLTFLoader().load(
          url,
          (gltf) => resolve(gltf.scene),
          undefined,
          () => (fallbackUrl ? tryLoad(fallbackUrl, null) : resolve(null)),
        );
      };
      tryLoad(`${base}models/car-${key}.glb`, `${base}models/car.glb`);
    });
  }
  return modelCache[key];
}

// Swaps a loaded real model in as a full REPLACEMENT for the procedural car —
// not a combination of the two. Fires and forgets — buildCar() calls this
// without awaiting it, exactly like loadRunnerModel()/loadTrees() do, so the
// procedural car renders instantly and the real one (if any) pops in a
// moment later, hiding every procedural part passed in `hideParts` (body
// shell, wheels+axles, driver figure — see buildCar()) so nothing procedural
// is left showing through/alongside it (no double wheels, no floating
// driver). If no model is found at either URL, everything in `hideParts`
// stays visible and the procedural car is simply what's used.
function loadRealCarBody(car, cfg, chLen, hideParts) {
  loadRealCarModel(cfg.id).then((scene) => {
    if (!scene) return; // no file at either URL — procedural car stays, unchanged
    const model = scene.clone(true);
    model.traverse((o) => {
      if (o.isMesh) {
        o.castShadow = true;
        o.receiveShadow = true;
      }
    });
    // Correct the model's forward axis to match ours (local -Z = front — see
    // headingAngle() in trackPath.js) BEFORE any bounding-box math below, so
    // the box is computed on the final orientation. Every DCC tool/exporter
    // picks its own "forward" (Blender ≈ +Y, others vary), so an as-exported
    // model is basically a coin flip on facing the right way; REAL_MODEL_YAW
    // is the fix. Applied before scaling/centering so it's correct for any
    // of the four practical values, not just 180°.
    model.rotation.y = REAL_MODEL_YAW;
    // normalise: fit its length (Z) to the procedural chassis length, centre
    // it, and drop it so its lowest point sits on the ground (y=0)
    const box = new THREE.Box3().setFromObject(model);
    const size = new THREE.Vector3();
    box.getSize(size);
    if (size.z > 0.01) model.scale.multiplyScalar(chLen / size.z);
    const box2 = new THREE.Box3().setFromObject(model);
    const center = new THREE.Vector3();
    box2.getCenter(center);
    model.position.x -= center.x;
    model.position.z -= center.z;
    model.position.y -= box2.min.y;
    hideParts.forEach((m) => { if (m) m.visible = false; }); // keep them around (cheap, no rebuild needed if this ever needs reverting), just hidden
    car.add(model);
  });
}

// Driver colours per avatar — same palette the old Phaser kart used. The car's
// own paint/brand identity now comes from CAR_DESIGNS (the player's chosen
// car), independent of avatar — the avatar only styles the driver figure.
export const DRIVER_COLORS = {
  alex: { helmet: 0x1f2937, suit: 0x111827, skin: 0xf1c9a5 },
  maya: { helmet: 0x7e22ce, suit: 0x4c1d95, skin: 0xf1c9a5 },
  omar: { helmet: 0xb45309, suit: 0x78350f, skin: 0xd9a066 },
  aya: { helmet: 0x0f766e, suit: 0x134e4a, skin: 0xd9a066 },
  james: { helmet: 0x3730a3, suit: 0x1e1b4b, skin: 0x8d5524 },
  ava: { helmet: 0x9f1239, suit: 0x881337, skin: 0xf1c9a5 },
};

// Selectable car designs — five distinct "manufacturer" silhouettes (sport
// coupe / muscle car / EV / off-roader / vintage roadster), each with its own
// proportions, paint + accent colours, and a couple of signature add-ons, so
// picking a car actually changes its shape and identity, not just its paint.
export const CAR_DESIGNS = [
  {
    id: 'apex', name: 'Apex GT', brand: 'Velocity Motors', tagline: 'Sleek sport coupe',
    paint: 0xdc2626, accent: 0xf8fafc, dark: 0x14181f,
    width: 1, hoodDrop: 0.07, rideHeight: 0, wheelR: 0.3,
    spoiler: true, hoodScoop: false, roofRack: false, chrome: false, glow: false,
  },
  {
    id: 'titan', name: 'Titan Muscle', brand: 'Ironclad', tagline: 'Wide-body muscle car',
    paint: 0x14181f, accent: 0xf59e0b, dark: 0x1a1d24,
    width: 1.16, hoodDrop: 0.02, rideHeight: 0, wheelR: 0.35,
    spoiler: false, hoodScoop: true, roofRack: false, chrome: false, glow: false,
  },
  {
    id: 'nimbus', name: 'Nimbus EV', brand: 'Nimbus Motors', tagline: 'Aerodynamic electric',
    paint: 0xf8fafc, accent: 0x22d3ee, dark: 0x0f172a,
    width: 0.96, hoodDrop: 0.11, rideHeight: 0, wheelR: 0.28,
    spoiler: true, hoodScoop: false, roofRack: false, chrome: false, glow: true,
  },
  {
    id: 'ranger', name: 'Ranger Raptor', brand: 'Trailblazer', tagline: 'Rugged off-roader',
    paint: 0x15803d, accent: 0xd6c8a3, dark: 0x22281f,
    width: 1.08, hoodDrop: -0.04, rideHeight: 0.22, wheelR: 0.42,
    spoiler: false, hoodScoop: false, roofRack: true, chrome: false, glow: false,
  },
  {
    id: 'classic', name: 'Heritage Roadster', brand: 'Heritage Co.', tagline: 'Vintage-styled classic',
    paint: 0x7c2d12, accent: 0xf5e6c8, dark: 0x2a1810,
    width: 0.94, hoodDrop: 0.02, rideHeight: 0, wheelR: 0.27,
    spoiler: false, hoodScoop: false, roofRack: false, chrome: true, glow: false,
  },
];
export const DEFAULT_CAR_DESIGN = CAR_DESIGNS[0].id;

// ── tiny canvas-texture helper (shared with ThreeRaceScene's world textures) ─
export function canvasTexture(w, h, draw, { repeatX = 1, repeatY = 1 } = {}) {
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

// Builds one design's enclosed body — hood, cabin surround, rear deck,
// bumpers, skirts, fender flares, and its signature add-ons (scoop / roof
// rack / spoiler-mount point) — around the SAME cockpit/driver/wheel/effect
// layout every design shares, so avatars, garage accessories, and the
// in-race flame/smoke/boost feedback all keep working unmodified regardless
// of which car is equipped.
function buildBody(car, cfg, parts) {
  const bodyStartIdx = car.children.length; // everything added below, minus tail/name plate, is "the body shell" a real model can replace
  const bodyMat = new THREE.MeshStandardMaterial({ color: cfg.paint, roughness: 0.25, metalness: 0.55 });
  const accentMat = new THREE.MeshStandardMaterial({ color: cfg.accent, roughness: 0.35, metalness: 0.3 });
  const darkMat = new THREE.MeshStandardMaterial({ color: cfg.dark, roughness: 0.55, metalness: 0.3 });
  const chromeMat = new THREE.MeshStandardMaterial({ color: 0xd7dde6, roughness: 0.15, metalness: 0.95 });
  const glassMat = new THREE.MeshStandardMaterial({ color: 0x1a2230, roughness: 0.1, metalness: 0.4, transparent: true, opacity: 0.32 });
  const trimMat = cfg.chrome ? chromeMat : darkMat;
  const y0 = 0.28 + cfg.rideHeight; // ground clearance
  const w = cfg.width;
  const chH = 0.46 - cfg.hoodDrop * 0.3; // main body (cabin+trunk) height
  const chZ = -0.15; // whole-car centre, front (-Z) to rear (+Z)
  const chLen = 3.7;
  const chTop = y0 + chH; // top-of-body line the cabin/trunk silhouette reads off
  const frontZ = chZ - chLen / 2;
  const rearZ = chZ + chLen / 2;

  // ── nose wedge: the hood sits distinctly LOWER and NARROWER than the
  // cabin/trunk body, flush against it with no gap — so the silhouette
  // itself unambiguously reads "pointed/low nose vs tall flat trunk" from
  // any angle, instead of relying on small details (headlight colour) alone
  // to tell front from back.
  const noseLen = 1.0;
  const noseH = chH * 0.6;
  const noseBackZ = frontZ + noseLen;
  const mainLen = rearZ - noseBackZ;
  const chassis = new THREE.Mesh(new THREE.BoxGeometry(w, chH, mainLen), bodyMat);
  chassis.position.set(0, y0 + chH / 2, (noseBackZ + rearZ) / 2);
  chassis.castShadow = true;
  car.add(chassis);
  const nose = new THREE.Mesh(new THREE.BoxGeometry(w * 0.82, noseH, noseLen), bodyMat);
  nose.position.set(0, y0 + noseH / 2, (frontZ + noseBackZ) / 2);
  nose.castShadow = true;
  car.add(nose);

  // cockpit wall — a low rim around the open driver's bay, sitting on the
  // main body roughly at its front (hood wedge ahead of it, trunk behind it)
  const rim = new THREE.Mesh(new THREE.BoxGeometry(w * 0.72, 0.18, 1.3), darkMat);
  rim.position.set(0, chTop + 0.09, -0.35);
  car.add(rim);
  const rimTop = chTop + 0.18;

  // windshield, raked back right where the hood meets the cabin (open-top —
  // the driver stays visible rising above the cockpit wall, same as before)
  const windshield = new THREE.Mesh(new THREE.BoxGeometry(w * 0.62, 0.5, 0.06), glassMat);
  windshield.position.set(0, y0 + noseH + 0.2, noseBackZ + 0.02);
  windshield.rotation.x = 0.42;
  car.add(windshield);

  if (cfg.hoodScoop) {
    const scoop = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.1, 0.5), darkMat);
    scoop.position.set(0, y0 + noseH + 0.05, (frontZ + noseBackZ) / 2);
    car.add(scoop);
  }

  // front bumper, grille + a wide light bar (unmistakably "a car's face" —
  // big and bright, not a detail you have to look for) mounted on the nose
  const frontBumper = new THREE.Mesh(new THREE.BoxGeometry(w * 0.86, noseH * 0.55, 0.24), trimMat);
  frontBumper.position.set(0, y0 + noseH * 0.3, frontZ + 0.02);
  car.add(frontBumper);
  const grille = new THREE.Mesh(new THREE.BoxGeometry(w * 0.5, noseH * 0.45, 0.05), darkMat);
  grille.position.set(0, y0 + noseH * 0.5, frontZ - 0.02);
  car.add(grille);
  const headlights = [-1, 1].map((s) => {
    const light = new THREE.Mesh(
      new THREE.BoxGeometry(w * 0.24, noseH * 0.4, 0.07),
      new THREE.MeshStandardMaterial({ color: 0xfff8e0, emissive: 0xfff2b8, emissiveIntensity: 1.1 }),
    );
    light.position.set(s * w * 0.35, y0 + noseH * 0.62, frontZ - 0.02);
    car.add(light);
    return light;
  });

  // rear windshield, sloping the OPPOSITE way from the front one (down toward
  // the trunk) so the cabin reads as a proper enclosed greenhouse with a
  // front AND a back window — not just a hood on one end and a flat deck.
  const rearWindshield = new THREE.Mesh(new THREE.BoxGeometry(w * 0.6, 0.4, 0.06), glassMat);
  rearWindshield.position.set(0, chTop - 0.02, 0.32);
  rearWindshield.rotation.x = -0.38;
  car.add(rearWindshield);

  // rear bumper + a full-width light BAR (not a small dot — big, bright, and
  // unmistakably "the back of a car" even at a glance/distance) + a pair of
  // exhaust tips — the same universal cues real cars use, so which end is
  // the rear never has to rely on reading the name plate to tell.
  const rearBumper = new THREE.Mesh(new THREE.BoxGeometry(w * 1.0, chH * 0.5, 0.26), trimMat);
  rearBumper.position.set(0, y0 + chH * 0.28, rearZ + 0.1);
  car.add(rearBumper);
  const tail = new THREE.Mesh(
    new THREE.BoxGeometry(w * 0.8, 0.1, 0.05),
    new THREE.MeshStandardMaterial({ color: 0x550b0b, emissive: 0xff2222, emissiveIntensity: 1.6 }),
  );
  tail.position.set(0, y0 + chH * 0.62, rearZ + 0.12);
  car.add(tail);
  [-1, 1].forEach((s) => {
    const exhaust = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 0.2, 10), chromeMat);
    exhaust.rotation.x = Math.PI / 2;
    exhaust.position.set(s * w * 0.3, y0 + chH * 0.12, rearZ + 0.2);
    car.add(exhaust);
  });
  parts.tailLight = tail;

  // side skirts (accent stripe) along the full length
  [-1, 1].forEach((s) => {
    const skirt = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.1, chLen - 0.3), accentMat);
    skirt.position.set(s * w * 0.52, y0 + 0.05, chZ);
    car.add(skirt);
  });

  // roof rack + mounted spare wheel (off-roader) — mounted over the cockpit
  if (cfg.roofRack) {
    [-1, 1].forEach((s) => {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 1.5), darkMat);
      rail.position.set(s * w * 0.3, rimTop + 0.5, -0.35);
      car.add(rail);
    });
    const spareTyre = new THREE.Mesh(
      new THREE.TorusGeometry(0.3, 0.1, 8, 20),
      new THREE.MeshStandardMaterial({ color: 0x0c0e12, roughness: 0.9 }),
    );
    spareTyre.position.set(0, y0 + chH * 0.65, rearZ + 0.16);
    car.add(spareTyre);
  }

  // rear wing carrying the player's name plate, if this design has one —
  // otherwise the plate mounts flat on the trunk so it's always shown
  if (cfg.spoiler) {
    [-0.5, 0.5].forEach((x) => {
      const strut = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.42, 0.18), darkMat);
      strut.position.set(x, chTop + 0.21, rearZ - 0.28);
      car.add(strut);
    });
    const wing = new THREE.Mesh(new THREE.BoxGeometry(w * 1.7, 0.4, 0.1), bodyMat);
    wing.position.set(0, chTop + 0.56, rearZ - 0.24);
    wing.castShadow = true;
    car.add(wing);
    [-w * 0.88, w * 0.88].forEach((x) => {
      const ep = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.48, 0.34), darkMat);
      ep.position.set(x, chTop + 0.56, rearZ - 0.28);
      car.add(ep);
    });
    parts.namePlateY = chTop + 0.56;
  } else {
    parts.namePlateY = y0 + chH * 0.6;
  }
  const namePlate = new THREE.Mesh(
    new THREE.PlaneGeometry(1.7, 0.42),
    new THREE.MeshBasicMaterial({ map: parts.namePlateTexture, transparent: true }),
  );
  namePlate.position.set(0, parts.namePlateY, rearZ + 0.14);
  car.add(namePlate);

  // everything just added except the tail light + name plate (both stay
  // visible even with a real model swapped in) is the replaceable body shell
  const bodyMeshes = car.children.slice(bodyStartIdx).filter((o) => o !== tail && o !== namePlate);

  return { bodyMat, accentMat, darkMat, chromeMat, y0, chTop, chLen, frontZ, rearZ, bodyMeshes, headlights };
}

// Builds a car (one of CAR_DESIGNS) at the origin, with the chosen avatar's
// driver figure and every equipped accessory slot layered on. Returns the
// car group plus the individual parts callers animate (wheels spin,
// flame/smoke opacity, wing flutter, trail fade, gem spin, tail-light glow).
export function buildCar({ avatarKey = 'alex', avatarName = 'ALEX', accessorySlots = [], carDesignId = DEFAULT_CAR_DESIGN } = {}) {
  const cfg = CAR_DESIGNS.find((d) => d.id === carDesignId) ?? CAR_DESIGNS[0];
  const driver = DRIVER_COLORS[avatarKey] ?? DRIVER_COLORS.alex;
  const car = new THREE.Group();

  const parts = {
    car,
    wheels: [],
    flameParts: [],
    smokeParts: [],
    flameScale: 1,
    tailLight: null,
    wingParts: null,
    trailMesh: null,
    specialGem: null,
    namePlateTexture: namePlateTexture((avatarName || 'ALEX').toUpperCase().slice(0, 10)),
  };

  const { bodyMat, darkMat, y0, chLen, bodyMeshes, windshield, headlights } = buildBody(car, cfg, parts);
  parts.windshield = windshield; // hidden in cockpit view so it doesn't tint out the driver's own view
  parts.headlights = headlights; // toggled on/off via the HUD's headlight button
  parts.eyePoint = { y: y0 + 1.05, z: -0.28 }; // cockpit-camera eye position, car-local (driver head height)

  // ── the driver — visible in the open cockpit (avatar suit + helmet) ──
  const suitMat = new THREE.MeshStandardMaterial({ color: driver.suit, roughness: 0.8 });
  const shoulders = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.34, 0.5), suitMat);
  shoulders.position.set(0, y0 + 0.64, -0.28);
  shoulders.castShadow = true;
  car.add(shoulders);
  const neck = new THREE.Mesh(
    new THREE.CylinderGeometry(0.09, 0.11, 0.12, 8),
    new THREE.MeshStandardMaterial({ color: driver.skin, roughness: 0.7 }),
  );
  neck.position.set(0, y0 + 0.84, -0.28);
  car.add(neck);
  const helmet = new THREE.Mesh(
    new THREE.SphereGeometry(0.21, 16, 14),
    new THREE.MeshStandardMaterial({ color: driver.helmet, roughness: 0.2, metalness: 0.35 }),
  );
  helmet.position.set(0, y0 + 1.02, -0.28);
  helmet.castShadow = true;
  car.add(helmet);
  const stripe = new THREE.Mesh(
    new THREE.BoxGeometry(0.05, 0.02, 0.4),
    new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.3 }),
  );
  stripe.position.set(0, y0 + 1.22, -0.28);
  car.add(stripe);
  parts.driverParts = [shoulders, neck, helmet, stripe]; // hidden in cockpit view — the camera IS the driver now

  // wheels (sized per design) + axles
  const r = cfg.wheelR;
  const tyreMat = new THREE.MeshStandardMaterial({ color: 0x0c0e12, roughness: 0.95 });
  const rimMat = new THREE.MeshStandardMaterial({ color: 0x9aa3af, roughness: 0.3, metalness: 0.8 });
  const hw = cfg.width * 0.48; // track width stays just inside the body edge, not poking past it
  const axles = [];
  [[-hw, -1.35], [hw, -1.35], [-hw, 1.05], [hw, 1.05]].forEach(([x, z]) => {
    const wheel = new THREE.Group();
    const tyre = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 0.4, 20), tyreMat);
    tyre.rotation.z = Math.PI / 2;
    tyre.castShadow = true;
    wheel.add(tyre);
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.55, r * 0.55, 0.42, 12), rimMat);
    hub.rotation.z = Math.PI / 2;
    wheel.add(hub);
    if (cfg.chrome) {
      // whitewall ring — a classic-car signature
      const whitewall = new THREE.Mesh(
        new THREE.TorusGeometry(r * 0.82, 0.035, 8, 20),
        new THREE.MeshStandardMaterial({ color: 0xf5f0e6, roughness: 0.6 }),
      );
      whitewall.rotation.y = Math.PI / 2;
      wheel.add(whitewall);
    }
    wheel.position.set(x, r, z);
    car.add(wheel);
    parts.wheels.push(wheel);
    const axle = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.08, 0.08), darkMat);
    axle.position.set(x * 0.62, r, z);
    car.add(axle);
    axles.push(axle);
  });

  // Real model (if any) is a full replacement, not a combination — swap it in
  // once/if it loads, hiding the ENTIRE procedural car (body shell, wheels +
  // axles, driver figure) so nothing procedural doubles up alongside it (no
  // duplicate wheels, no driver floating on a roof that isn't there). Tail
  // light + name plate stay visible either way — see loadRealCarBody().
  loadRealCarBody(car, cfg, chLen, [...bodyMeshes, ...parts.wheels, ...axles, ...parts.driverParts]);

  // under-glow, tinted to the design's own accent colour
  const glow = new THREE.Mesh(
    new THREE.PlaneGeometry(2.4, 4.6),
    new THREE.MeshBasicMaterial({ color: cfg.accent, transparent: true, opacity: cfg.glow ? 0.28 : 0.14, depthWrite: false }),
  );
  glow.rotation.x = -Math.PI / 2;
  glow.position.y = 0.03;
  car.add(glow);

  // exhaust flames (correct answers / boost)
  [-0.22, 0.22].forEach((x) => {
    const flame = new THREE.Mesh(
      new THREE.ConeGeometry(0.14, 0.9, 8),
      new THREE.MeshBasicMaterial({ color: 0xffa62b, transparent: true, opacity: 0 }),
    );
    flame.rotation.x = -Math.PI / 2;
    flame.position.set(x, y0 + 0.22, 2.25);
    car.add(flame);
    parts.flameParts.push(flame);
  });

  // smoke puffs (wrong answers)
  for (let i = 0; i < 6; i++) {
    const puff = new THREE.Mesh(
      new THREE.SphereGeometry(0.22, 8, 8),
      new THREE.MeshBasicMaterial({ color: 0x8b949e, transparent: true, opacity: 0 }),
    );
    puff.position.set(0, y0 + 0.32, 1.9);
    puff.userData.seed = i / 6;
    car.add(puff);
    parts.smokeParts.push(puff);
  }

  for (const slot of accessorySlots || []) buildAccessory(car, slot, parts);

  return parts;
}

// Build the visual for ONE equipped garage slot (BOOST / WINGS / HELMET …),
// mutating `parts` the same way the car's own fields used to be mutated.
function buildAccessory(car, slot, parts) {
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
      parts.wingParts = [-1, 1].map((side) => {
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
      parts.flameParts.forEach((f, i) => f.position.set(i === 0 ? -0.3 : 0.3, 0.78, 2.5));
      parts.flameScale = 1.5;
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
      parts.flameParts.forEach((f, i) => f.position.set(i === 0 ? -0.08 : 0.08, 1.0, 2.35));
      parts.flameScale = 1.9;
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
      parts.trailMesh = new THREE.Mesh(
        new THREE.PlaneGeometry(1.4, 4.5),
        new THREE.MeshBasicMaterial({ map: trailTex, transparent: true, opacity: 0.3, depthWrite: false }),
      );
      parts.trailMesh.rotation.x = -Math.PI / 2;
      parts.trailMesh.rotation.z = Math.PI; // fade away from the car
      parts.trailMesh.position.set(0, 0.05, 4.3);
      car.add(parts.trailMesh);
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
      parts.specialGem = new THREE.Mesh(new THREE.OctahedronGeometry(0.22), gold);
      parts.specialGem.position.set(0, 2.15, 1.6);
      car.add(parts.specialGem);
      break;
    }
  }
}
