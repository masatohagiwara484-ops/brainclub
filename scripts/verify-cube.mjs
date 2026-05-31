// Headless verification of the cube rotate→snap logic (no WebGL needed).
// Mirrors cubeEngine.ts finish(): attach to a pivot, rotate 90°, bake back,
// then snap position (FIX #1) and orientation (FIX #2). We assert that after
// many random turns the cube remains a valid permutation of grid slots with
// valid orientations — i.e. it never "tears apart" as the old code did.

import * as THREE from 'three';

const CUBELET = 1, GAP = 0.06, STEP = CUBELET + GAP;
const AXES = { x: new THREE.Vector3(1, 0, 0), y: new THREE.Vector3(0, 1, 0), z: new THREE.Vector3(0, 0, 1) };

function snapPos(v, N) {
  const offset = (N - 1) / 2;
  const idx = Math.round(v / STEP + offset);
  return (idx - offset) * STEP;
}
function snapAxis(v) {
  const ax = Math.abs(v.x), ay = Math.abs(v.y), az = Math.abs(v.z);
  const r = new THREE.Vector3();
  if (ax >= ay && ax >= az) r.x = Math.sign(v.x) || 1;
  else if (ay >= ax && ay >= az) r.y = Math.sign(v.y) || 1;
  else r.z = Math.sign(v.z) || 1;
  return r;
}
function snapRotation(obj) {
  const m = new THREE.Matrix4().makeRotationFromQuaternion(obj.quaternion);
  const e = m.elements;
  const x = snapAxis(new THREE.Vector3(e[0], e[1], e[2]));
  const y0 = snapAxis(new THREE.Vector3(e[4], e[5], e[6]));
  const z = new THREE.Vector3().crossVectors(x, y0).normalize();
  const y = new THREE.Vector3().crossVectors(z, x).normalize();
  obj.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, z));
}
function layerIndex(mesh, axis, N) {
  const offset = (N - 1) / 2;
  const v = axis === 'x' ? mesh.position.x : axis === 'y' ? mesh.position.y : mesh.position.z;
  return Math.round(v / STEP + offset);
}

function build(N) {
  const group = new THREE.Group();
  const cubelets = [];
  const offset = (N - 1) / 2;
  for (let x = 0; x < N; x++)
    for (let y = 0; y < N; y++)
      for (let z = 0; z < N; z++) {
        if (x > 0 && x < N - 1 && y > 0 && y < N - 1 && z > 0 && z < N - 1) continue;
        const o = new THREE.Object3D();
        o.position.set((x - offset) * STEP, (y - offset) * STEP, (z - offset) * STEP);
        group.add(o);
        cubelets.push(o);
      }
  return { group, cubelets };
}

function rotate(group, cubelets, axis, layer, dir, N) {
  const affected = cubelets.filter((m) => layerIndex(m, axis, N) === layer);
  const pivot = new THREE.Group();
  group.add(pivot);
  affected.forEach((m) => pivot.attach(m));
  pivot.rotation.set(0, 0, 0);
  pivot.rotateOnAxis(AXES[axis], (dir * Math.PI) / 2);
  pivot.updateMatrixWorld(true);
  pivot.children.slice().forEach((m) => {
    group.attach(m);
    m.position.set(snapPos(m.position.x, N), snapPos(m.position.y, N), snapPos(m.position.z, N));
    snapRotation(m);
  });
  group.remove(pivot);
}

function isValidOrientation(o) {
  const m = new THREE.Matrix4().makeRotationFromQuaternion(o.quaternion);
  for (const v of m.elements) {
    const r = Math.round(v);
    if (Math.abs(v - r) > 1e-6) return false; // entries must be integers
    if (![-1, 0, 1].includes(r)) return false;
  }
  return true;
}

let failures = 0;
for (const N of [2, 3, 4, 5]) {
  const { group, cubelets } = build(N);
  const original = cubelets.map((m) => m.position.clone());
  const keyOf = (p) => `${p.x.toFixed(3)},${p.y.toFixed(3)},${p.z.toFixed(3)}`;
  const slots = new Set(original.map(keyOf));

  const axes = ['x', 'y', 'z'];
  for (let i = 0; i < 400; i++) {
    rotate(group, cubelets, axes[(Math.random() * 3) | 0], (Math.random() * N) | 0, Math.random() < 0.5 ? 1 : -1, N);
  }

  // Invariant 1: positions are still exactly the original set (a permutation).
  const seen = new Set();
  let ok = true;
  for (const m of cubelets) {
    const k = keyOf(m.position);
    if (!slots.has(k)) { ok = false; break; } // drifted off-grid (the old bug)
    if (seen.has(k)) { ok = false; break; }   // two pieces collided (the old bug)
    seen.add(k);
  }
  if (seen.size !== cubelets.length) ok = false;

  // Invariant 2: every orientation is a valid axis-aligned cube rotation.
  const orientOk = cubelets.every(isValidOrientation);

  const status = ok && orientOk ? 'PASS' : 'FAIL';
  if (!(ok && orientOk)) failures++;
  console.log(
    `N=${N}: ${status}  (pieces=${cubelets.length}, distinct-on-grid=${ok}, orientations-valid=${orientOk})`,
  );
}

console.log(failures === 0 ? '\n✅ ALL SIZES STABLE — corruption bug fixed.' : `\n❌ ${failures} size(s) failed.`);
process.exit(failures === 0 ? 0 : 1);
