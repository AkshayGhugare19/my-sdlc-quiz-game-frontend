import * as THREE from 'three';

// Shared car mesh builder — extracted from ThreeRaceScene.js so the live race
// scene AND the pre-race 3D car-preview scene (ThreeCarPreviewScene.js) render
// the exact same car from one place. Pure geometry/materials, no scene/physics
// state — callers own placement, animation and disposal.

// Car paint per avatar (keeps each avatar's identity like the old kart colors).
export const CAR_PAINT = {
  alex: 0xf2f4f7, // white, GT-style
  maya: 0x8b5cf6,
  omar: 0xf59e0b,
  aya: 0x14b8a6,
  james: 0x4f46e5,
  ava: 0xe11d48,
};

// Driver colours per avatar — same palette the old Phaser kart used.
export const DRIVER_COLORS = {
  alex: { helmet: 0x1f2937, suit: 0x111827, skin: 0xf1c9a5 },
  maya: { helmet: 0x7e22ce, suit: 0x4c1d95, skin: 0xf1c9a5 },
  omar: { helmet: 0xb45309, suit: 0x78350f, skin: 0xd9a066 },
  aya: { helmet: 0x0f766e, suit: 0x134e4a, skin: 0xd9a066 },
  james: { helmet: 0x3730a3, suit: 0x1e1b4b, skin: 0x8d5524 },
  ava: { helmet: 0x9f1239, suit: 0x881337, skin: 0xf1c9a5 },
};

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

// Builds the open-wheel racing car (same geometry the live race scene always
// used) at the origin, with every equipped accessory slot layered on. Returns
// the car group plus the individual parts callers animate (wheels spin,
// flame/smoke opacity, wing flutter, trail fade, gem spin, tail-light glow).
export function buildCar({ avatarKey = 'alex', avatarName = 'ALEX', accessorySlots = [] } = {}) {
  const paint = CAR_PAINT[avatarKey] ?? CAR_PAINT.alex;
  const driver = DRIVER_COLORS[avatarKey] ?? DRIVER_COLORS.alex;
  const car = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({ color: paint, roughness: 0.25, metalness: 0.55 });
  const darkMat = new THREE.MeshStandardMaterial({ color: 0x14181f, roughness: 0.55, metalness: 0.3 });

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
  };

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
  parts.tailLight = tail;

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
    new THREE.MeshBasicMaterial({ map: namePlateTexture((avatarName || 'ALEX').toUpperCase().slice(0, 10)), transparent: true }),
  );
  namePlate.position.set(0, 1.5, 1.66);
  car.add(namePlate);

  // exposed wheels (bigger at the rear, open-wheel style) + axles
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
    parts.wheels.push(wheel);
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
  [-0.22, 0.22].forEach((x) => {
    const flame = new THREE.Mesh(
      new THREE.ConeGeometry(0.14, 0.9, 8),
      new THREE.MeshBasicMaterial({ color: 0xffa62b, transparent: true, opacity: 0 }),
    );
    flame.rotation.x = -Math.PI / 2;
    flame.position.set(x, 0.5, 2.25);
    car.add(flame);
    parts.flameParts.push(flame);
  });

  // smoke puffs (wrong answers)
  for (let i = 0; i < 6; i++) {
    const puff = new THREE.Mesh(
      new THREE.SphereGeometry(0.22, 8, 8),
      new THREE.MeshBasicMaterial({ color: 0x8b949e, transparent: true, opacity: 0 }),
    );
    puff.position.set(0, 0.6, 1.9);
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
