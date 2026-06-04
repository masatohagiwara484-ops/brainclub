// 3D Rubik's Cube engine (Three.js). Framework-agnostic — a React component
// mounts it onto a <canvas> and drives it via this API.
//
// Ported from the original single-file prototype with TWO correctness fixes:
//
//  1) Position snap now accounts for the size offset, so EVEN cubes (2×2,
//     4×4) no longer tear apart. Pieces of an even cube sit at half-steps
//     (±0.53, ±1.59…); rounding `pos/STEP` alone sent them to the wrong slot
//     (Math.round(-0.5) === 0 in JS). We round in index space instead:
//        idx = round(pos/STEP + offset);  pos = (idx - offset) * STEP
//
//  2) Orientation is snapped via the ROTATION MATRIX (each basis vector to the
//     nearest signed axis, then re-orthonormalized), not by rounding Euler
//     angles independently. Independent Euler rounding is unsafe for compound
//     3D rotations and caused large cubes (5×5) to occasionally corrupt.

import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { haptics } from '../../lib/haptics';
import { makeRng } from '../../lib/daily';

const COLORS = {
  right: 0xff3b30, // +X red
  left: 0xff9500, // -X orange
  up: 0xffffff, // +Y white
  down: 0xffd60a, // -Y yellow
  front: 0x34c759, // +Z green
  back: 0x0a84ff, // -Z blue
  inside: 0x14182f,
} as const;

// BoxGeometry material order: +X, -X, +Y, -Y, +Z, -Z
const FACE_ORDER = ['right', 'left', 'up', 'down', 'front', 'back'] as const;
type Axis = 'x' | 'y' | 'z';

const CUBELET = 1;
const GAP = 0.06;
const STEP = CUBELET + GAP;

const AXES: Record<Axis, THREE.Vector3> = {
  x: new THREE.Vector3(1, 0, 0),
  y: new THREE.Vector3(0, 1, 0),
  z: new THREE.Vector3(0, 0, 1),
};

export type CubeStats = { moves: number; seconds: number; running: boolean };

export type CubeOptions = {
  onStats?: (s: CubeStats) => void;
  onSolved?: (s: CubeStats) => void;
};

type Move = { axis: Axis; layer: number; dir: number };
type RotateOpts = { animate?: boolean; record?: boolean; onDone?: () => void };

export class CubeEngine {
  private canvas: HTMLCanvasElement;
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
  private controls: OrbitControls;
  private cubeGroup = new THREE.Group();
  private cubelets: THREE.Mesh[] = [];
  private boxGeo = new THREE.BoxGeometry(CUBELET, CUBELET, CUBELET);

  private N = 3;
  private isAnimating = false;
  private history: Move[] = [];

  private moveCount = 0;
  private startTime: number | null = null;
  private timerRunning = false;
  private timerId: number | null = null;

  private raycaster = new THREE.Raycaster();
  private pointer = new THREE.Vector2();
  private drag: { mesh: THREE.Mesh; faceNormal: THREE.Vector3; startX: number; startY: number; done: boolean } | null =
    null;

  private rafId = 0;
  private opts: CubeOptions;
  private disposed = false;

  constructor(canvas: HTMLCanvasElement, opts: CubeOptions = {}) {
    this.canvas = canvas;
    this.opts = opts;

    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.12;
    this.controls.enablePan = false;
    this.controls.rotateSpeed = 0.9;

    this.scene.add(new THREE.AmbientLight(0xffffff, 0.9));
    const d1 = new THREE.DirectionalLight(0xffffff, 0.9);
    d1.position.set(5, 8, 6);
    this.scene.add(d1);
    const d2 = new THREE.DirectionalLight(0xffffff, 0.4);
    d2.position.set(-6, -3, -5);
    this.scene.add(d2);

    this.scene.add(this.cubeGroup);

    // Pointer handlers — capture phase so we intercept before OrbitControls.
    this.onPointerDown = this.onPointerDown.bind(this);
    this.onPointerMove = this.onPointerMove.bind(this);
    this.onPointerUp = this.onPointerUp.bind(this);
    canvas.addEventListener('pointerdown', this.onPointerDown, { capture: true });
    canvas.addEventListener('pointermove', this.onPointerMove);
    window.addEventListener('pointerup', this.onPointerUp);
    window.addEventListener('pointercancel', this.onPointerUp);

    this.buildCube(3);
    this.resize();
    this.loop();
  }

  // ---------- public API ----------
  get size() {
    return this.N;
  }

  setSize(n: number) {
    this.history = [];
    this.buildCube(n);
  }

  reset() {
    this.history = [];
    this.buildCube(this.N);
  }

  resetView() {
    this.fitCamera();
  }

  undo() {
    if (this.isAnimating || !this.history.length) return;
    const last = this.history.pop()!;
    this.rotateLayer(last.axis, last.layer, -last.dir, {
      record: false,
      onDone: () => {
        this.moveCount = Math.max(0, this.moveCount - 1);
        this.emitStats();
      },
    });
  }

  /** Scramble. Pass a seed for a deterministic (daily) scramble. */
  scramble(seed?: number) {
    if (this.isAnimating) return;
    const rnd = seed != null ? makeRng(seed) : Math.random;
    const moves = this.N <= 2 ? 14 : this.N * 9;
    const axes: Axis[] = ['x', 'y', 'z'];
    const queue: Move[] = [];
    let prev: Axis | null = null;
    for (let k = 0; k < moves; k++) {
      let axis: Axis;
      do {
        axis = axes[(rnd() * 3) | 0];
      } while (axis === prev && rnd() < 0.6);
      prev = axis;
      queue.push({ axis, layer: (rnd() * this.N) | 0, dir: rnd() < 0.5 ? 1 : -1 });
    }
    let i = 0;
    const next = () => {
      if (i >= queue.length) {
        this.resetStats();
        this.startTimer();
        return;
      }
      const mv = queue[i++];
      this.rotateLayer(mv.axis, mv.layer, mv.dir, {
        animate: i > queue.length - 6,
        record: false,
        onDone: next,
      });
    };
    next();
  }

  resize() {
    const w = this.canvas.clientWidth || window.innerWidth;
    const h = this.canvas.clientHeight || window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.rafId);
    this.stopTimer();
    this.canvas.removeEventListener('pointerdown', this.onPointerDown, { capture: true } as EventListenerOptions);
    this.canvas.removeEventListener('pointermove', this.onPointerMove);
    window.removeEventListener('pointerup', this.onPointerUp);
    window.removeEventListener('pointercancel', this.onPointerUp);
    this.controls.dispose();
    this.boxGeo.dispose();
    this.renderer.dispose();
  }

  // ---------- build ----------
  private clearCube() {
    for (const m of this.cubelets) {
      this.cubeGroup.remove(m);
      (m.material as THREE.Material[]).forEach((mat) => mat.dispose());
    }
    while (this.cubeGroup.children.length) this.cubeGroup.remove(this.cubeGroup.children[0]);
    this.cubelets = [];
  }

  private buildCube(n: number) {
    this.clearCube();
    this.N = n;
    const offset = (this.N - 1) / 2;

    for (let x = 0; x < n; x++) {
      for (let y = 0; y < n; y++) {
        for (let z = 0; z < n; z++) {
          const inner = x > 0 && x < n - 1 && y > 0 && y < n - 1 && z > 0 && z < n - 1;
          if (inner) continue;

          const mats = FACE_ORDER.map((face) => {
            let show = false;
            if (face === 'right' && x === n - 1) show = true;
            if (face === 'left' && x === 0) show = true;
            if (face === 'up' && y === n - 1) show = true;
            if (face === 'down' && y === 0) show = true;
            if (face === 'front' && z === n - 1) show = true;
            if (face === 'back' && z === 0) show = true;
            return new THREE.MeshStandardMaterial({
              color: show ? COLORS[face] : COLORS.inside,
              roughness: 0.45,
              metalness: 0.0,
            });
          });

          const mesh = new THREE.Mesh(this.boxGeo, mats);
          mesh.position.set((x - offset) * STEP, (y - offset) * STEP, (z - offset) * STEP);
          this.cubeGroup.add(mesh);
          this.cubelets.push(mesh);
        }
      }
    }
    this.fitCamera();
    this.resetStats();
  }

  // ---------- rotation ----------
  private layerIndex(mesh: THREE.Object3D, axis: Axis): number {
    const offset = (this.N - 1) / 2;
    const v = axis === 'x' ? mesh.position.x : axis === 'y' ? mesh.position.y : mesh.position.z;
    return Math.round(v / STEP + offset);
  }

  /** FIX #1: snap a coordinate back onto the grid using the size offset. */
  private snapPos(v: number): number {
    const offset = (this.N - 1) / 2;
    const idx = Math.round(v / STEP + offset);
    return (idx - offset) * STEP;
  }

  /** FIX #2: snap orientation to the nearest valid cube rotation via the matrix. */
  private snapRotation(obj: THREE.Object3D): void {
    const m = new THREE.Matrix4().makeRotationFromQuaternion(obj.quaternion);
    const e = m.elements; // column-major
    const x = this.snapAxis(new THREE.Vector3(e[0], e[1], e[2]));
    const y0 = this.snapAxis(new THREE.Vector3(e[4], e[5], e[6]));
    // Re-orthonormalize: z = x × y0, then y = z × x (guarantees a proper basis).
    const z = new THREE.Vector3().crossVectors(x, y0).normalize();
    const y = new THREE.Vector3().crossVectors(z, x).normalize();
    const basis = new THREE.Matrix4().makeBasis(x, y, z);
    obj.quaternion.setFromRotationMatrix(basis);
  }

  private snapAxis(v: THREE.Vector3): THREE.Vector3 {
    const ax = Math.abs(v.x);
    const ay = Math.abs(v.y);
    const az = Math.abs(v.z);
    const r = new THREE.Vector3();
    if (ax >= ay && ax >= az) r.x = Math.sign(v.x) || 1;
    else if (ay >= ax && ay >= az) r.y = Math.sign(v.y) || 1;
    else r.z = Math.sign(v.z) || 1;
    return r;
  }

  private rotateLayer(axis: Axis, layer: number, dir: number, opts: RotateOpts = {}) {
    const animate = opts.animate !== false;
    const record = opts.record !== false;
    const onDone = opts.onDone;
    if (this.isAnimating) return;

    const affected = this.cubelets.filter((m) => this.layerIndex(m, axis) === layer);
    if (!affected.length) {
      onDone?.();
      return;
    }

    const pivot = new THREE.Group();
    this.cubeGroup.add(pivot);
    affected.forEach((m) => pivot.attach(m));

    const targetAngle = (dir * Math.PI) / 2;

    if (record) {
      this.history.push({ axis, layer, dir });
      this.bumpMoves();
      haptics.tick();
    }

    const finish = () => {
      pivot.rotation.set(0, 0, 0);
      pivot.rotateOnAxis(AXES[axis], targetAngle);
      pivot.updateMatrixWorld(true);
      pivot.children.slice().forEach((m) => {
        this.cubeGroup.attach(m);
        m.position.set(this.snapPos(m.position.x), this.snapPos(m.position.y), this.snapPos(m.position.z));
        this.snapRotation(m);
      });
      this.cubeGroup.remove(pivot);
      this.isAnimating = false;
      onDone?.();
      if (record) this.checkSolved();
    };

    if (!animate) {
      finish();
      return;
    }

    this.isAnimating = true;
    const start = performance.now();
    const dur = 150;
    const tick = (now: number) => {
      if (this.disposed) return;
      const t = Math.min(1, (now - start) / dur);
      const e = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
      pivot.rotation.set(0, 0, 0);
      pivot.rotateOnAxis(AXES[axis], targetAngle * e);
      if (t < 1) requestAnimationFrame(tick);
      else finish();
    };
    requestAnimationFrame(tick);
  }

  // ---------- solved detection ----------
  private _n = new THREE.Vector3();
  private outwardColor(mesh: THREE.Mesh, worldNormal: THREE.Vector3): number | null {
    const localNormals = [
      [1, 0, 0],
      [-1, 0, 0],
      [0, 1, 0],
      [0, -1, 0],
      [0, 0, 1],
      [0, 0, -1],
    ];
    mesh.updateMatrixWorld();
    const normalMat = new THREE.Matrix3().getNormalMatrix(mesh.matrixWorld);
    let best = -2;
    let bestIdx = -1;
    localNormals.forEach((ln, i) => {
      this._n.set(ln[0], ln[1], ln[2]).applyMatrix3(normalMat).normalize();
      const d = this._n.dot(worldNormal);
      if (d > best) {
        best = d;
        bestIdx = i;
      }
    });
    if (best < 0.9) return null;
    const col = (mesh.material as THREE.MeshStandardMaterial[])[bestIdx].color.getHex();
    if (col === COLORS.inside) return null;
    return col;
  }

  private checkSolved() {
    const planes: { axis: Axis; layer: number }[] = [
      { axis: 'x', layer: this.N - 1 },
      { axis: 'x', layer: 0 },
      { axis: 'y', layer: this.N - 1 },
      { axis: 'y', layer: 0 },
      { axis: 'z', layer: this.N - 1 },
      { axis: 'z', layer: 0 },
    ];
    for (const pl of planes) {
      const colorSet = new Set<number>();
      const tiles = this.cubelets.filter((m) => this.layerIndex(m, pl.axis) === pl.layer);
      const worldNormal = new THREE.Vector3();
      worldNormal[pl.axis] = pl.layer === 0 ? -1 : 1;
      for (const m of tiles) {
        const c = this.outwardColor(m, worldNormal);
        if (c === null) return;
        colorSet.add(c);
      }
      if (colorSet.size !== 1) return;
    }
    this.onSolved();
  }

  private onSolved() {
    if (this.moveCount === 0) return;
    this.stopTimer();
    this.opts.onSolved?.(this.currentStats());
  }

  // ---------- pointer / drag-to-rotate ----------
  private ndc(ev: PointerEvent) {
    const r = this.canvas.getBoundingClientRect();
    this.pointer.set(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1);
  }

  private onPointerDown(ev: PointerEvent) {
    if (this.isAnimating) return;
    this.ndc(ev);
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const hits = this.raycaster.intersectObjects(this.cubelets, false);
    if (hits.length && hits[0].face) {
      const hit = hits[0];
      const worldNormal = hit
        .face!.normal.clone()
        .applyMatrix3(new THREE.Matrix3().getNormalMatrix(hit.object.matrixWorld))
        .round();
      this.drag = {
        mesh: hit.object as THREE.Mesh,
        faceNormal: worldNormal,
        startX: ev.clientX,
        startY: ev.clientY,
        done: false,
      };
      this.controls.enabled = false;
    } else {
      this.drag = null;
      this.controls.enabled = true;
    }
  }

  private onPointerMove(ev: PointerEvent) {
    if (!this.drag || this.drag.done || this.isAnimating) return;
    const dx = ev.clientX - this.drag.startX;
    const dy = ev.clientY - this.drag.startY;
    if (Math.hypot(dx, dy) < 14) return;

    const camRight = new THREE.Vector3().setFromMatrixColumn(this.camera.matrixWorld, 0);
    const camUp = new THREE.Vector3().setFromMatrixColumn(this.camera.matrixWorld, 1);
    const dragWorld = new THREE.Vector3().addScaledVector(camRight, dx).addScaledVector(camUp, -dy).normalize();

    const n = this.drag.faceNormal.clone().normalize();
    const tangent = dragWorld.clone().addScaledVector(n, -dragWorld.dot(n)).normalize();
    const axisVec = new THREE.Vector3().crossVectors(n, tangent);

    const ax = Math.abs(axisVec.x);
    const ay = Math.abs(axisVec.y);
    const az = Math.abs(axisVec.z);
    let axis: Axis;
    let sign: number;
    if (ax >= ay && ax >= az) {
      axis = 'x';
      sign = Math.sign(axisVec.x) || 1;
    } else if (ay >= ax && ay >= az) {
      axis = 'y';
      sign = Math.sign(axisVec.y) || 1;
    } else {
      axis = 'z';
      sign = Math.sign(axisVec.z) || 1;
    }

    const layer = this.layerIndex(this.drag.mesh, axis);
    this.drag.done = true;
    this.controls.enabled = false;
    this.rotateLayer(axis, layer, sign, {
      onDone: () => {
        this.controls.enabled = true;
      },
    });
  }

  private onPointerUp() {
    this.drag = null;
    if (!this.isAnimating) this.controls.enabled = true;
  }

  // ---------- camera ----------
  private fitCamera() {
    const d = this.N * STEP;
    this.camera.position.set(d * 1.5, d * 1.25, d * 1.9);
    this.controls.target.set(0, 0, 0);
    this.controls.minDistance = d * 1.2;
    this.controls.maxDistance = d * 5;
    this.controls.update();
  }

  // ---------- stats / timer ----------
  private currentStats(): CubeStats {
    const seconds = this.startTime != null ? Math.floor((performance.now() - this.startTime) / 1000) : 0;
    return { moves: this.moveCount, seconds, running: this.timerRunning };
  }
  private emitStats() {
    this.opts.onStats?.(this.currentStats());
  }
  private resetStats() {
    this.moveCount = 0;
    this.stopTimer();
    this.startTime = null;
    this.timerRunning = false;
    this.emitStats();
  }
  private bumpMoves() {
    if (!this.timerRunning) this.startTimer();
    this.moveCount++;
    this.emitStats();
  }
  private startTimer() {
    if (this.timerRunning) return;
    this.timerRunning = true;
    this.startTime = performance.now();
    this.timerId = window.setInterval(() => this.emitStats(), 250);
  }
  private stopTimer() {
    if (this.timerId != null) clearInterval(this.timerId);
    this.timerId = null;
    this.timerRunning = false;
  }

  // ---------- render loop ----------
  private loop = () => {
    if (this.disposed) return;
    this.rafId = requestAnimationFrame(this.loop);
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  };
}
