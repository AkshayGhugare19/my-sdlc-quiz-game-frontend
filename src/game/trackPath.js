import * as THREE from 'three';

// Shared closed-loop track-path builder + sampling/geometry helpers, used by
// both ThreeRaceScene (cars) and ThreeSubwayScene (trains/runner) so the
// world is a real, fixed, curving circuit — sweeping bends plus a tight
// chicane — that the car/runner actually travels around lap after lap,
// instead of an infinite straight lane or a fake side-to-side "sweep" of the
// whole scene. All geometry below is built ONCE (static); only the camera
// and the car/runner move through it.

// Deterministic control-point ring: N points evenly spaced in angle around a
// centre, with hand-tuned radius multipliers that vary smoothly (long,
// sweeping curves) and dip sharply in one spot (a tight chicane). A
// Catmull-Rom spline through them stays C1-continuous (no hard corners) while
// still reading as "sweeping curves + a zigzag," like a real circuit rather
// than a perfect oval or an infinite straight.
const RADIUS_MULT = [
  1.0, 1.0, 1.22, 1.35, 1.2, 0.86, 0.68, 0.95, 1.1, 1.32, 1.3, 1.0, 0.8, 0.85, 1.0, 1.02,
];

// Builds the closed track curve at a given base radius (world units).
// Returns { curve, totalLength } — totalLength is the real lap distance,
// used to convert "distance travelled" into the curve's arc-length fraction.
export function buildTrackCurve(baseRadius) {
  const n = RADIUS_MULT.length;
  const points = RADIUS_MULT.map((m, i) => {
    const a = (i / n) * Math.PI * 2;
    const r = baseRadius * m;
    return new THREE.Vector3(Math.sin(a) * r, 0, -Math.cos(a) * r);
  });
  const curve = new THREE.CatmullRomCurve3(points, true, 'catmullrom', 0.5);
  return { curve, totalLength: curve.getLength() };
}

// Point + forward tangent + rightward vector (perpendicular, in the XZ
// plane) at arc-length fraction t (any real number — wraps automatically)
// along the closed curve. `right` is defined so that, after rotating an
// object to `headingAngle(tangent)`, the object's local +X axis points along
// `right` — i.e. lane/prop offsets and the heading rotation always agree on
// which side is which.
export function sampleTrack(curve, t) {
  const tt = ((t % 1) + 1) % 1;
  const point = curve.getPointAt(tt);
  const tangent = curve.getTangentAt(tt).setY(0).normalize();
  const right = new THREE.Vector3(-tangent.z, 0, tangent.x).normalize();
  return { point, tangent, right };
}

// Y rotation that faces an object's local -Z axis (nose/front, for both the
// car and the runner models) along `tangent`.
export function headingAngle(tangent) {
  return Math.atan2(-tangent.x, -tangent.z);
}

// Builds one flat ribbon mesh (a road/kerb/sand/grass strip) following the
// curve at a fixed lateral offset from the centreline. `offset`/`width` are
// world units (offset can be a function of t for a varying-position strip).
// `y` is the ribbon's (flat) height. `uAcrossTiles` tiles the texture across
// the width; `uAlongTilesPerUnit` tiles it along the length.
export function buildRibbon({
  curve, totalLength, offset = 0, width, y = 0, segments,
  material, uAcrossTiles = 1, uAlongTilesPerUnit = 0,
}) {
  const seg = segments || Math.max(48, Math.round(totalLength / 3));
  const positions = [];
  const normals = [];
  const uvs = [];
  const indices = [];
  const halfW = width / 2;
  for (let i = 0; i <= seg; i++) {
    const t = i / seg;
    const { point, right } = sampleTrack(curve, t);
    const off = typeof offset === 'function' ? offset(t) : offset;
    const cx = point.x + right.x * off;
    const cz = point.z + right.z * off;
    positions.push(cx - right.x * halfW, y, cz - right.z * halfW, cx + right.x * halfW, y, cz + right.z * halfW);
    normals.push(0, 1, 0, 0, 1, 0);
    const v = t * totalLength * uAlongTilesPerUnit;
    uvs.push(0, v, uAcrossTiles, v);
  }
  for (let i = 0; i < seg; i++) {
    const a = i * 2, b = a + 1, c = a + 2, d = a + 3;
    indices.push(a, b, c, b, d, c);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  const mesh = new THREE.Mesh(geo, material);
  mesh.receiveShadow = true;
  return mesh;
}

// Builds one vertical wall/rail mesh (sponsor rail, platform edge, catenary
// strand) following the curve at a fixed lateral offset, extruded upward
// from y0 by `height` instead of sideways.
export function buildWall({
  curve, totalLength, offset, height, y0 = 0, segments,
  material, uAlongTilesPerUnit = 0,
}) {
  const seg = segments || Math.max(48, Math.round(totalLength / 3));
  const positions = [];
  const normals = [];
  const uvs = [];
  const indices = [];
  for (let i = 0; i <= seg; i++) {
    const t = i / seg;
    const { point, right } = sampleTrack(curve, t);
    const off = typeof offset === 'function' ? offset(t) : offset;
    const x = point.x + right.x * off;
    const z = point.z + right.z * off;
    positions.push(x, y0, z, x, y0 + height, z);
    normals.push(right.x, 0, right.z, right.x, 0, right.z);
    const v = t * totalLength * uAlongTilesPerUnit;
    uvs.push(0, v, 1, v);
  }
  for (let i = 0; i < seg; i++) {
    const a = i * 2, b = a + 1, c = a + 2, d = a + 3;
    indices.push(a, b, c, b, d, c);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  return new THREE.Mesh(geo, material);
}

// Places `count` copies (built by `make(i, t)`) evenly spaced once around the
// static loop, each positioned to the track at its own t. `make`'s returned
// object may already carry its own local X (e.g. "side * someOffset", the
// same pattern the old flat-world scenery factories used) — that's honoured
// as an extra lateral offset on top of `sideOffset`, so those factories don't
// need to change at all, just how/when they're placed. `make` may return
// null to skip a slot. Returns the placed objects. Replaces the old "pooled
// movers that scroll and recycle" approach — everything is placed once, for
// real, and the camera/car moves through the static world instead.
export function placeAlongTrack({ curve, totalLength, group, make, count, sideOffset = 0, faceTrack = true, startT = 0 }) {
  const placed = [];
  for (let i = 0; i < count; i++) {
    const t = startT + i / count;
    const { point, tangent, right } = sampleTrack(curve, t);
    const obj = make(i, t);
    if (!obj) continue;
    const extra = typeof sideOffset === 'function' ? sideOffset(i, t) : sideOffset;
    const lateral = obj.position.x + extra;
    const baseY = obj.position.y;
    obj.position.set(point.x + right.x * lateral, baseY, point.z + right.z * lateral);
    if (faceTrack) obj.rotation.y = headingAngle(tangent);
    group.add(obj);
    placed.push(obj);
  }
  return placed;
}
