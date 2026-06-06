import { Suspense, useMemo, useRef, useState, type FC } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Text } from '@react-three/drei';
import * as THREE from 'three';
import { prefersReducedMotion } from '../lib/fx';
import { palette } from '../lib/theme';

// ============================================================================
// VisualTutorial — language-free, Three.js "how to play" animations.
//
// Each game gets a short (~10-12s) looping scene that demonstrates its core
// mechanic with ZERO text: real object + camera motion teaches the rule the way
// the best Nintendo tutorials do. A glowing "touch" indicator shows where to
// interact; progress dots track the steps. Under prefers-reduced-motion every
// scene freezes on its clearest "result" frame (cube solved, tubes sorted, five
// in a row) so the lesson still reads, with no motion.
//
// Heavy (three) but lazy-loaded by HowToOverlay only when a tutorial is opened,
// so it never touches the main bundle.
// ============================================================================

const H = 210; // canvas height (px); width is responsive

// ---- shared easing / timing helpers ---------------------------------------
const clamp01 = (t: number) => (t < 0 ? 0 : t > 1 ? 1 : t);
const easeInOut = (t: number) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);
function easeOutBounce(x: number): number {
  const n1 = 7.5625;
  const d1 = 2.75;
  if (x < 1 / d1) return n1 * x * x;
  if (x < 2 / d1) return n1 * (x -= 1.5 / d1) * x + 0.75;
  if (x < 2.5 / d1) return n1 * (x -= 2.25 / d1) * x + 0.9375;
  return n1 * (x -= 2.625 / d1) * x + 0.984375;
}
/** Index of the latest passed boundary in `times` for the current loop time. */
function stepFor(times: number[], u: number): number {
  let s = 0;
  for (let i = 0; i < times.length; i++) if (u >= times[i]) s = i;
  return s;
}

type SceneProps = { reduced: boolean; reportStep: (i: number) => void };

// Gentle premium lighting shared by every scene.
function Lights() {
  return (
    <>
      <ambientLight intensity={0.75} />
      <directionalLight position={[4, 6, 5]} intensity={2} />
      <pointLight position={[-5, 2, -3]} intensity={22} color={palette.accentCyan} distance={24} />
      <pointLight position={[4, -2, 4]} intensity={14} color={palette.accentPink} distance={24} />
    </>
  );
}

// A pulsing ring that says "touch / interact here" — language-free.
function touchRing(ref: THREE.Mesh | null, show: boolean, phase: number) {
  if (!ref) return;
  ref.visible = show;
  if (!show) return;
  const s = 0.18 + easeOut(phase) * 0.5;
  ref.scale.set(s, s, s);
  (ref.material as THREE.MeshBasicMaterial).opacity = (1 - phase) * 0.9;
}

// ===========================================================================
// CUBE — a 2×2 Rubik's cube is scrambled by two layer turns, then solved by
// reversing them. A glowing dot drags across each turning layer.
// ===========================================================================

const CUBE_DUR = 10;
type Move = { start: number; end: number; axis: 0 | 1 | 2; sign: 1 | -1; dir: 1 | -1 };
const CUBE_MOVES: Move[] = [
  { start: 0.9, end: 2.7, axis: 1, sign: 1, dir: 1 }, // top layer  CW
  { start: 3.0, end: 4.7, axis: 0, sign: 1, dir: 1 }, // right layer CW
  { start: 5.3, end: 7.0, axis: 0, sign: 1, dir: -1 }, // right layer CCW
  { start: 7.2, end: 8.9, axis: 1, sign: 1, dir: -1 }, // top layer  CCW  → solved
];
const CUBE_STEPS = [0, 3.0, 5.3, 8.9]; // 4 progress dots

const FACE = { red: '#e11d48', orange: '#f59e0b', white: '#f8fafc', yellow: '#facc15', green: '#22c55e', blue: '#3b82f6' };
const PLASTIC = '#0b1020';

function faceMaterials(b: THREE.Vector3): THREE.Material[] {
  const col = (c: string) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.34, metalness: 0.04 });
  const dark = () => new THREE.MeshStandardMaterial({ color: PLASTIC, roughness: 0.6 });
  // BoxGeometry material order: +X, -X, +Y, -Y, +Z, -Z
  return [
    b.x > 0 ? col(FACE.red) : dark(),
    b.x < 0 ? col(FACE.orange) : dark(),
    b.y > 0 ? col(FACE.white) : dark(),
    b.y < 0 ? col(FACE.yellow) : dark(),
    b.z > 0 ? col(FACE.green) : dark(),
    b.z < 0 ? col(FACE.blue) : dark(),
  ];
}

const axisVec = (a: number) => (a === 0 ? new THREE.Vector3(1, 0, 0) : a === 1 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(0, 0, 1));

const CubeScene: FC<SceneProps> = ({ reduced, reportStep }) => {
  const bases = useMemo(() => {
    const arr: THREE.Vector3[] = [];
    for (const x of [-0.5, 0.5]) for (const y of [-0.5, 0.5]) for (const z of [-0.5, 0.5]) arr.push(new THREE.Vector3(x, y, z));
    return arr;
  }, []);
  const mats = useMemo(() => bases.map((b) => faceMaterials(b)), [bases]);
  const work = useMemo(() => bases.map(() => ({ p: new THREE.Vector3(), q: new THREE.Quaternion() })), [bases]);
  const axes = useMemo(() => [axisVec(0), axisVec(1), axisVec(2)], []);
  const tmpQ = useMemo(() => new THREE.Quaternion(), []);
  const ps = useMemo(() => new THREE.Vector3(), []);
  const pe = useMemo(() => new THREE.Vector3(), []);

  const meshes = useRef<(THREE.Mesh | null)[]>([]);
  const group = useRef<THREE.Group>(null);
  const ring = useRef<THREE.Mesh>(null);
  const lastStep = useRef(-1);

  useFrame((state) => {
    const u = reduced ? 9.4 : state.clock.elapsedTime % CUBE_DUR;
    if (!reduced) {
      const s = stepFor(CUBE_STEPS, u);
      if (s !== lastStep.current) { lastStep.current = s; reportStep(s); }
    }

    for (let i = 0; i < work.length; i++) { work[i].p.copy(bases[i]); work[i].q.identity(); }

    let activeIdx = -1;
    let activeP = 0;
    for (const m of CUBE_MOVES) {
      if (u < m.start) break;
      const raw = (u - m.start) / (m.end - m.start);
      const done = u >= m.end;
      const angle = m.dir * (Math.PI / 2) * (done ? 1 : easeInOut(clamp01(raw)));
      tmpQ.setFromAxisAngle(axes[m.axis], angle);
      const comp = m.axis === 0 ? 'x' : m.axis === 1 ? 'y' : 'z';
      for (let i = 0; i < work.length; i++) {
        if ((work[i].p[comp as 'x' | 'y' | 'z']) * m.sign > 0.1) {
          work[i].p.applyQuaternion(tmpQ);
          work[i].q.premultiply(tmpQ);
        }
      }
      if (!done) { activeIdx = CUBE_MOVES.indexOf(m); activeP = clamp01(raw); break; }
    }

    for (let i = 0; i < work.length; i++) {
      const m = meshes.current[i];
      if (!m) continue;
      m.position.copy(work[i].p);
      m.quaternion.copy(work[i].q);
    }

    // Drag indicator across the turning layer.
    if (!reduced && activeIdx >= 0) {
      const mv = CUBE_MOVES[activeIdx];
      if (mv.axis === 1) { ps.set(-0.55, 1.04, 0.55); pe.set(0.55, 1.04, 0.55); }
      else { ps.set(1.04, 0.55, 0.55); pe.set(1.04, -0.55, 0.55); }
      if (mv.dir < 0) { const t = ps.clone(); ps.copy(pe); pe.copy(t); }
      ring.current?.position.lerpVectors(ps, pe, easeInOut(activeP));
      if (ring.current) {
        ring.current.visible = true;
        ring.current.scale.setScalar(0.42);
        (ring.current.material as THREE.MeshBasicMaterial).opacity = 0.9;
      }
    } else if (ring.current) {
      ring.current.visible = false;
    }

    // Solved celebration: a gentle breathe + sway through the loop.
    if (group.current) {
      const solved = u > CUBE_STEPS[3];
      const breathe = solved ? 1 + Math.sin((u - CUBE_STEPS[3]) * 6) * 0.03 : 1;
      group.current.scale.setScalar(breathe);
      group.current.rotation.y = reduced ? -0.5 : Math.sin(state.clock.elapsedTime * 0.4) * 0.18 - 0.35;
      group.current.rotation.x = -0.18;
    }
  });

  return (
    <group ref={group}>
      {bases.map((_, i) => (
        <mesh
          key={i}
          ref={(el) => {
            meshes.current[i] = el;
          }}
          material={mats[i]}
        >
          <boxGeometry args={[0.97, 0.97, 0.97]} />
        </mesh>
      ))}
      <mesh ref={ring} rotation={[0, 0, 0]}>
        <ringGeometry args={[0.6, 0.95, 28]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={0} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
    </group>
  );
};

// ===========================================================================
// WATER SORT — the top red of the left tube pours into the right tube so the
// reds stack together. The source tube tips; a red stream connects the mouths.
// ===========================================================================

const WATER_DUR = 10.5;
const WATER_STEPS = [0, 1.5, 3.0, 6.9]; // present · tilt · pour · sorted
const TH = 2.2; // tube inner height
const TR = 0.42; // tube radius
const SLOT = (TH - 0.12) / 3;
const slotY = (i: number, frac = 1) => -TH / 2 + 0.06 + SLOT * i + (SLOT * frac) / 2; // anchored at slot bottom

function Liquid({ color, refCb }: { color: string; refCb?: (m: THREE.Mesh | null) => void }) {
  return (
    <mesh ref={refCb}>
      <cylinderGeometry args={[TR - 0.04, TR - 0.04, SLOT, 22]} />
      <meshStandardMaterial color={color} roughness={0.25} metalness={0.1} emissive={color} emissiveIntensity={0.2} />
    </mesh>
  );
}

function TubeShell() {
  return (
    <group>
      <mesh>
        <cylinderGeometry args={[TR, TR, TH, 26, 1, true]} />
        <meshStandardMaterial color="#cbd5e1" transparent opacity={0.16} roughness={0.1} side={THREE.DoubleSide} />
      </mesh>
      <mesh position={[0, -TH / 2, 0]}>
        <cylinderGeometry args={[TR, TR, 0.06, 26]} />
        <meshStandardMaterial color="#94a3b8" transparent opacity={0.4} />
      </mesh>
    </group>
  );
}

const WaterScene: FC<SceneProps> = ({ reduced, reportStep }) => {
  const tubeA = useRef<THREE.Group>(null);
  const redTopA = useRef<THREE.Mesh | null>(null); // the pouring segment
  const redNewB = useRef<THREE.Mesh | null>(null); // the received segment
  const stream = useRef<THREE.Mesh>(null);
  const ring = useRef<THREE.Mesh>(null);
  const bGlow = useRef<THREE.Group>(null);
  const lastStep = useRef(-1);

  useFrame((state) => {
    const u = reduced ? 9.5 : state.clock.elapsedTime % WATER_DUR;
    if (!reduced) {
      const s = stepFor(WATER_STEPS, u);
      if (s !== lastStep.current) { lastStep.current = s; reportStep(s); }
    }

    const tilt = reduced ? 0 : easeInOut(clamp01((u - 1.5) / 1.5)) - easeInOut(clamp01((u - 5.4) / 1.5));
    const pour = reduced ? 1 : clamp01((u - 3.0) / 2.3);

    if (tubeA.current) {
      tubeA.current.rotation.z = -0.62 * tilt;
      tubeA.current.position.x = -1.15 + 0.7 * tilt;
      tubeA.current.position.y = 0.55 * tilt;
    }
    // Source top red shrinks; received red on B grows — anchored at slot bottoms.
    if (redTopA.current) {
      const f = reduced ? 0 : 1 - pour;
      redTopA.current.visible = f > 0.02;
      redTopA.current.scale.y = Math.max(0.001, f);
      redTopA.current.position.y = slotY(2, f);
    }
    if (redNewB.current) {
      const f = reduced ? 1 : pour;
      redNewB.current.visible = f > 0.02;
      redNewB.current.scale.y = Math.max(0.001, f);
      redNewB.current.position.y = slotY(2, f);
    }
    if (stream.current) {
      const on = !reduced && u > 3.0 && u < 5.3;
      stream.current.visible = on;
    }
    // Touch hint on the source tube before the pour.
    touchRing(ring.current, !reduced && u > 1.1 && u < 1.6, clamp01((u - 1.1) / 0.5));
    // Sorted celebration glow on B.
    if (bGlow.current) {
      const lit = reduced || u > 6.9;
      const k = reduced ? 1 : lit ? 0.5 + Math.sin(u * 5) * 0.5 : 0;
      bGlow.current.children.forEach((c) => {
        const mm = (c as THREE.Mesh).material as THREE.MeshStandardMaterial;
        if (mm) mm.emissiveIntensity = 0.2 + k * 0.6;
      });
    }
  });

  return (
    <group position={[0, 0.1, 0]}>
      {/* Source tube A (tips to pour). */}
      <group ref={tubeA} position={[-1.15, 0, 0]}>
        <TubeShell />
        <mesh position={[0, slotY(0), 0]}>
          <cylinderGeometry args={[TR - 0.04, TR - 0.04, SLOT, 22]} />
          <meshStandardMaterial color="#3b82f6" roughness={0.25} emissive="#3b82f6" emissiveIntensity={0.2} />
        </mesh>
        <mesh position={[0, slotY(1), 0]}>
          <cylinderGeometry args={[TR - 0.04, TR - 0.04, SLOT, 22]} />
          <meshStandardMaterial color="#3b82f6" roughness={0.25} emissive="#3b82f6" emissiveIntensity={0.2} />
        </mesh>
        <Liquid
          color={FACE.red}
          refCb={(m) => {
            redTopA.current = m;
          }}
        />
      </group>

      {/* Target tube B (receives the red). */}
      <group ref={bGlow} position={[1.15, 0, 0]}>
        <TubeShell />
        <mesh position={[0, slotY(0), 0]}>
          <cylinderGeometry args={[TR - 0.04, TR - 0.04, SLOT, 22]} />
          <meshStandardMaterial color={FACE.red} roughness={0.25} emissive={FACE.red} emissiveIntensity={0.2} />
        </mesh>
        <mesh position={[0, slotY(1), 0]}>
          <cylinderGeometry args={[TR - 0.04, TR - 0.04, SLOT, 22]} />
          <meshStandardMaterial color={FACE.red} roughness={0.25} emissive={FACE.red} emissiveIntensity={0.2} />
        </mesh>
        <Liquid
          color={FACE.red}
          refCb={(m) => {
            redNewB.current = m;
          }}
        />
      </group>

      {/* Pour stream. */}
      <mesh ref={stream} position={[0.2, 1.0, 0]} rotation={[0, 0, -0.7]}>
        <cylinderGeometry args={[0.05, 0.05, 1.5, 10]} />
        <meshStandardMaterial color={FACE.red} emissive={FACE.red} emissiveIntensity={0.5} />
      </mesh>

      <mesh ref={ring} position={[-1.15, TH / 2 + 0.2, 0.3]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.18, 0.32, 24]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={0} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
    </group>
  );
};

// ===========================================================================
// GOMOKU — black and white stones alternate; black lines up five in a row and a
// glowing bar sweeps through the winning line.
// ===========================================================================

const GOMOKU_DUR = 11.5;
type Stone = { x: number; z: number; black: boolean; t: number };
const STONES: Stone[] = [
  { x: -2, z: 0, black: true, t: 1.0 },
  { x: -1, z: -1, black: false, t: 2.0 },
  { x: -1, z: 0, black: true, t: 2.9 },
  { x: 1, z: 1, black: false, t: 3.9 },
  { x: 0, z: 0, black: true, t: 4.8 },
  { x: 2, z: -1, black: false, t: 5.8 },
  { x: 1, z: 0, black: true, t: 6.7 },
  { x: 2, z: 0, black: true, t: 7.9 }, // completes five in a row
];
const GOMOKU_STEPS = [1.0, 2.9, 4.8, 6.7, 8.3]; // 5 dots (the four builds + the win)
const WIN_AT = 8.3;
const DROP = 0.7;

const GomokuScene: FC<SceneProps> = ({ reduced, reportStep }) => {
  const stones = useRef<(THREE.Mesh | null)[]>([]);
  const ring = useRef<THREE.Mesh>(null);
  const winLine = useRef<THREE.Mesh>(null);
  const group = useRef<THREE.Group>(null);
  const lastStep = useRef(-1);

  const lines = useMemo(() => [-2, -1, 0, 1, 2], []);

  useFrame((state) => {
    const u = reduced ? 10.5 : state.clock.elapsedTime % GOMOKU_DUR;
    if (!reduced) {
      const s = stepFor(GOMOKU_STEPS, u);
      if (s !== lastStep.current) { lastStep.current = s; reportStep(s); }
    }

    let ringStone = -1;
    let ringPhase = 0;
    for (let i = 0; i < STONES.length; i++) {
      const m = stones.current[i];
      if (!m) continue;
      const s = STONES[i];
      if (reduced) { m.visible = true; m.position.y = 0.16; m.scale.setScalar(1); continue; }
      const dt = u - s.t;
      if (dt < 0) { m.visible = false; continue; }
      m.visible = true;
      const p = clamp01(dt / DROP);
      const e = easeOutBounce(p);
      m.position.y = 2.4 * (1 - e) + 0.16 * e;
      m.scale.setScalar(0.6 + 0.4 * easeOut(clamp01(dt / 0.25)));
      if (dt >= 0 && dt < 0.6) { ringStone = i; ringPhase = clamp01(dt / 0.6); }
    }

    if (ring.current) {
      if (ringStone >= 0) {
        ring.current.position.set(STONES[ringStone].x, 0.2, STONES[ringStone].z);
        touchRing(ring.current, true, ringPhase);
      } else ring.current.visible = false;
    }

    if (winLine.current) {
      const lit = reduced || u >= WIN_AT;
      winLine.current.visible = lit;
      if (lit) {
        const grow = reduced ? 1 : easeOut(clamp01((u - WIN_AT) / 0.7));
        winLine.current.scale.x = grow;
        const mm = winLine.current.material as THREE.MeshStandardMaterial;
        mm.emissiveIntensity = 0.6 + (reduced ? 0.5 : Math.abs(Math.sin(u * 5)) * 1.1);
      }
    }

    if (group.current) {
      group.current.rotation.y = reduced ? 0.25 : Math.sin(state.clock.elapsedTime * 0.3) * 0.16 + 0.08;
    }
  });

  return (
    <group ref={group} rotation={[0, 0.1, 0]}>
      {/* Board. */}
      <mesh position={[0, -0.02, 0]} receiveShadow>
        <boxGeometry args={[5.6, 0.16, 5.6]} />
        <meshStandardMaterial color="#d9a441" roughness={0.65} />
      </mesh>
      {/* Grid lines. */}
      {lines.map((x) => (
        <mesh key={`v${x}`} position={[x, 0.075, 0]}>
          <boxGeometry args={[0.04, 0.02, 4]} />
          <meshStandardMaterial color="#7c5a1e" />
        </mesh>
      ))}
      {lines.map((z) => (
        <mesh key={`h${z}`} position={[0, 0.075, z]}>
          <boxGeometry args={[4, 0.02, 0.04]} />
          <meshStandardMaterial color="#7c5a1e" />
        </mesh>
      ))}

      {/* Stones. */}
      {STONES.map((s, i) => (
        <mesh
          key={i}
          ref={(el) => {
            stones.current[i] = el;
          }}
          position={[s.x, 0.16, s.z]}
          visible={false}
        >
          <cylinderGeometry args={[0.42, 0.42, 0.2, 28]} />
          <meshStandardMaterial
            color={s.black ? '#1f2937' : '#f8fafc'}
            roughness={0.3}
            metalness={0.1}
          />
        </mesh>
      ))}

      {/* Winning line glow (spans x=-2..2 at z=0). */}
      <mesh ref={winLine} position={[0, 0.3, 0]} visible={false}>
        <boxGeometry args={[4.5, 0.1, 0.18]} />
        <meshStandardMaterial color={palette.accentCyan} emissive={palette.accentCyan} emissiveIntensity={0.6} transparent opacity={0.92} />
      </mesh>

      <mesh ref={ring} position={[0, 0.2, 0]} rotation={[-Math.PI / 2, 0, 0]} visible={false}>
        <ringGeometry args={[0.3, 0.5, 26]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={0} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
    </group>
  );
};

// ===========================================================================
// GridScene — a unified, data-driven engine that teaches every grid/tap/place
// based game from a compact config. A scene is just an initial set of cells
// plus a timeline of events (tap rings, color/label changes, light pulses,
// "pop" placements, "flip" reveals, directional arrows). Discrete state changes
// drive React (colors + drei <Text> labels); continuous flourishes (pop, flip,
// light pulse, ring, arrow) run in useFrame off refs. Frozen on the final frame
// under reduced-motion.
// ===========================================================================

const C = {
  ink: '#1e293b', board: '#0b1222', slot: '#334155', hole: '#241a12', mole: '#a16207',
  red: '#ef4444', green: '#22c55e', blue: '#3b82f6', yellow: '#eab308', amber: '#f59e0b',
  indigo: '#6366f1', cyan: '#22d3ee', pink: '#ec4899', white: '#f8fafc', tan: '#ede0c8', teal: '#14b8a6',
};

type CellCfg = { color: string; label?: string; labelColor?: string; lit?: boolean; hidden?: boolean; disc?: boolean };
type SetOp = Partial<CellCfg> & { i: number; fx?: 'pop' | 'flip' };
type Arrow = 'R' | 'L' | 'U' | 'D';
type GEvent = { at: number; dot?: boolean; ring?: number; arrow?: Arrow; set?: SetOp[] };
type GridCfg = {
  cols: number; rows: number; dur: number; dots: number;
  camera: [number, number, number]; fov: number;
  step?: number; tile?: number; depth?: number;
  cells: CellCfg[]; events: GEvent[];
};

const _arrowDir = new THREE.Vector3();

function GridScene({ cfg, reduced, reportStep }: { cfg: GridCfg } & SceneProps) {
  const { cols, rows, dur } = cfg;
  const step = cfg.step ?? 1;
  const tile = cfg.tile ?? 0.86;
  const depth = cfg.depth ?? 0.18;

  const positions = useMemo(
    () =>
      cfg.cells.map((_, i) => {
        const c = i % cols;
        const r = Math.floor(i / cols);
        return new THREE.Vector3((c - (cols - 1) / 2) * step, 0, (r - (rows - 1) / 2) * step);
      }),
    [cfg, cols, rows, step],
  );
  const cellFx = useMemo(() => {
    const m: Record<number, { at: number; fx: 'pop' | 'flip' }[]> = {};
    cfg.events.forEach((e) => e.set?.forEach((s) => s.fx && (m[s.i] ??= []).push({ at: e.at, fx: s.fx })));
    return m;
  }, [cfg]);
  const dotTimes = useMemo(() => cfg.events.filter((e) => e.dot).map((e) => e.at), [cfg]);

  const [stamp, setStamp] = useState(reduced ? cfg.events.length : 0);
  const lastStamp = useRef(-1);
  const lastDot = useRef(-1);
  const meshRefs = useRef<(THREE.Mesh | null)[]>([]);
  const matRefs = useRef<(THREE.MeshStandardMaterial | null)[]>([]);
  const ring = useRef<THREE.Mesh>(null);
  const arrow = useRef<THREE.Mesh>(null);
  const group = useRef<THREE.Group>(null);

  const view = useMemo(() => {
    const arr: CellCfg[] = cfg.cells.map((c) => ({ ...c }));
    for (let k = 0; k < stamp; k++) cfg.events[k].set?.forEach((s) => Object.assign(arr[s.i], s));
    return arr;
  }, [cfg, stamp]);

  useFrame((state) => {
    const u = reduced ? dur * 0.96 : state.clock.elapsedTime % dur;

    let count = 0;
    for (let k = 0; k < cfg.events.length; k++) if (u >= cfg.events[k].at) count = k + 1;
    if (count !== lastStamp.current) { lastStamp.current = count; setStamp(count); }
    if (!reduced) {
      const d = stepFor(dotTimes, u);
      if (d !== lastDot.current) { lastDot.current = d; reportStep(d); }
    }

    for (let i = 0; i < cfg.cells.length; i++) {
      const m = meshRefs.current[i];
      if (m) {
        m.visible = !view[i].hidden;
        let sc = 1;
        let syMul = 1;
        const fxs = cellFx[i];
        if (!reduced && fxs) {
          let last: { at: number; fx: 'pop' | 'flip' } | undefined;
          for (const f of fxs) if (u >= f.at) last = f;
          if (last) {
            const p = clamp01((u - last.at) / 0.36);
            if (last.fx === 'pop') sc = p < 1 ? 0.2 + easeOutBounce(p) * 0.8 : 1;
            else syMul = Math.abs(Math.cos(p * Math.PI));
          }
        }
        m.scale.set(sc, sc * syMul, sc);
      }
      const mat = matRefs.current[i];
      if (mat) mat.emissiveIntensity = view[i].lit ? 0.45 + Math.sin(u * 5) * 0.35 : 0;
    }

    // Tap ring.
    let rc = -1;
    let rp = 0;
    for (const e of cfg.events) if (e.ring != null && u >= e.at && u < e.at + 0.65) { rc = e.ring; rp = clamp01((u - e.at) / 0.65); }
    if (ring.current) {
      if (rc >= 0 && !reduced) {
        ring.current.position.set(positions[rc].x, depth + 0.06, positions[rc].z);
        touchRing(ring.current, true, rp);
      } else ring.current.visible = false;
    }

    // Directional arrow (swipe / move hint).
    let ar: Arrow | null = null;
    let ap = 0;
    for (const e of cfg.events) if (e.arrow && u >= e.at && u < e.at + 0.95) { ar = e.arrow; ap = clamp01((u - e.at) / 0.95); }
    if (arrow.current) {
      if (ar && !reduced) {
        arrow.current.visible = true;
        arrow.current.rotation.set(0, 0, 0);
        if (ar === 'R') { arrow.current.rotation.z = -Math.PI / 2; _arrowDir.set(1, 0, 0); }
        else if (ar === 'L') { arrow.current.rotation.z = Math.PI / 2; _arrowDir.set(-1, 0, 0); }
        else if (ar === 'U') { arrow.current.rotation.x = -Math.PI / 2; _arrowDir.set(0, 0, -1); }
        else { arrow.current.rotation.x = Math.PI / 2; _arrowDir.set(0, 0, 1); }
        const bob = 0.2 + Math.sin(ap * Math.PI) * 0.28;
        arrow.current.position.set(_arrowDir.x * bob, 0.55, _arrowDir.z * bob);
      } else arrow.current.visible = false;
    }

    if (group.current) group.current.rotation.y = reduced ? 0.05 : Math.sin(state.clock.elapsedTime * 0.28) * 0.1;
  });

  return (
    <group ref={group}>
      <mesh position={[0, -depth * 0.75, 0]}>
        <boxGeometry args={[cols * step + 0.3, depth * 0.7, rows * step + 0.3]} />
        <meshStandardMaterial color={C.board} roughness={0.85} />
      </mesh>
      {cfg.cells.map((c, i) => (
        <group key={i} position={[positions[i].x, 0, positions[i].z]}>
          <mesh ref={(el) => { meshRefs.current[i] = el; }}>
            {c.disc ? (
              <cylinderGeometry args={[tile * 0.5, tile * 0.5, depth, 26]} />
            ) : (
              <boxGeometry args={[tile, depth, tile]} />
            )}
            <meshStandardMaterial
              ref={(el) => { matRefs.current[i] = el as THREE.MeshStandardMaterial; }}
              color={view[i].color}
              emissive={view[i].color}
              emissiveIntensity={0}
              roughness={0.42}
              metalness={0.05}
            />
          </mesh>
          {view[i].label && (
            <Text
              position={[0, depth / 2 + 0.02, 0]}
              rotation={[-Math.PI / 2, 0, 0]}
              fontSize={tile * 0.52}
              color={view[i].labelColor ?? C.white}
              anchorX="center"
              anchorY="middle"
            >
              {view[i].label}
            </Text>
          )}
        </group>
      ))}
      <mesh ref={ring} rotation={[-Math.PI / 2, 0, 0]} visible={false}>
        <ringGeometry args={[tile * 0.42, tile * 0.62, 26]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={0} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
      <mesh ref={arrow} position={[0, 0.55, 0]} visible={false}>
        <coneGeometry args={[0.17, 0.42, 18]} />
        <meshStandardMaterial color="#ffffff" emissive="#ffffff" emissiveIntensity={0.7} />
      </mesh>
    </group>
  );
}

// ---- per-game grid configs -------------------------------------------------

const fillCells = (n: number, c: CellCfg): CellCfg[] => Array.from({ length: n }, () => ({ ...c }));
const num = (labels: string[], color = C.ink, labelColor = C.white): CellCfg[] =>
  labels.map((label) => ({ color: label ? color : C.board, ...(label ? { label, labelColor } : {}) }));

const GRID_CONFIGS: Record<string, GridCfg> = {
  // Tap the numbers 1 → 2 → 3 … in order; found cells turn teal.
  schulte: {
    cols: 3, rows: 3, dur: 8.5, dots: 4, camera: [0, 4.5, 4.6], fov: 36,
    cells: num(['3', '8', '1', '6', '5', '9', '2', '7', '4']),
    events: [
      { at: 0, dot: true },
      { at: 1.6, dot: true, ring: 2, set: [{ i: 2, color: C.teal }] },
      { at: 3.3, dot: true, ring: 6, set: [{ i: 6, color: C.teal }] },
      { at: 5.0, dot: true, ring: 0, set: [{ i: 0, color: C.teal }] },
    ],
  },
  // Tap an empty cell, then it fills with the correct number.
  sudoku: {
    cols: 3, rows: 3, dur: 8, dots: 3, camera: [0, 4.5, 4.4], fov: 36,
    cells: num(['5', '', '3', '6', '', '8', '', '1', '9']),
    events: [
      { at: 0, dot: true },
      { at: 1.7, dot: true, ring: 4, set: [{ i: 4, color: C.slot }] },
      { at: 3.5, dot: true, set: [{ i: 4, label: '4', labelColor: C.white, color: C.green, lit: true, fx: 'pop' }] },
    ],
  },
  // Type a word; tiles flip to green / gray / yellow.
  wordle: {
    cols: 5, rows: 1, dur: 8, dots: 3, camera: [0, 2.7, 4.3], fov: 34, tile: 0.82,
    cells: num(['B', 'R', 'A', 'I', 'N']),
    events: [
      { at: 0, dot: true },
      { at: 1.4, dot: true, set: [0, 1, 2, 3, 4].map((i) => ({ i, fx: 'pop' as const })) },
      { at: 2.6, dot: true, set: [{ i: 0, color: C.green, fx: 'flip' }] },
      { at: 2.9, set: [{ i: 1, color: C.slot, fx: 'flip' }] },
      { at: 3.2, set: [{ i: 2, color: C.yellow, fx: 'flip' }] },
      { at: 3.5, set: [{ i: 3, color: C.green, fx: 'flip' }] },
      { at: 3.8, set: [{ i: 4, color: C.green, fx: 'flip' }] },
    ],
  },
  // Swipe to slide & merge equal tiles.
  '2048': {
    cols: 4, rows: 1, dur: 8, dots: 3, camera: [0, 2.9, 4.5], fov: 34,
    cells: [
      { color: C.tan, label: '2', labelColor: '#776e65' },
      { color: C.tan, label: '2', labelColor: '#776e65' },
      { color: C.slot },
      { color: C.slot },
    ],
    events: [
      { at: 0, dot: true },
      { at: 1.5, dot: true, arrow: 'R' },
      { at: 2.4, dot: true, set: [
        { i: 0, color: C.slot, label: '' },
        { i: 1, color: C.slot, label: '' },
        { i: 3, color: '#f2b179', label: '4', labelColor: C.white, fx: 'pop' },
      ] },
    ],
  },
  // Slide a numbered tile into the empty gap.
  slide: {
    cols: 3, rows: 3, dur: 8, dots: 3, camera: [0, 4.5, 4.4], fov: 36,
    cells: num(['1', '2', '3', '4', '5', '6', '7', '8', '']),
    events: [
      { at: 0, dot: true },
      { at: 1.6, dot: true, ring: 7, arrow: 'R' },
      { at: 2.7, dot: true, set: [
        { i: 7, label: '', color: C.board },
        { i: 8, label: '8', labelColor: C.white, color: C.ink, fx: 'pop' },
      ] },
    ],
  },
  // Tap safe cells (numbers = nearby mines); flag the mine.
  minesweeper: {
    cols: 3, rows: 3, dur: 8.5, dots: 4, camera: [0, 4.5, 4.4], fov: 36,
    cells: fillCells(9, { color: C.slot }),
    events: [
      { at: 0, dot: true },
      { at: 1.6, dot: true, ring: 4, set: [{ i: 4, color: '#cbd5e1', label: '2', labelColor: '#1d4ed8', fx: 'pop' }] },
      { at: 3.3, dot: true, ring: 0, set: [{ i: 0, color: '#cbd5e1', label: '1', labelColor: '#15803d', fx: 'pop' }] },
      { at: 5.0, dot: true, ring: 2, set: [{ i: 2, color: C.red, label: '⚑', labelColor: C.white, fx: 'pop' }] },
    ],
  },
  // Watch the pads light up, then repeat the sequence.
  simon: {
    cols: 2, rows: 2, dur: 8.5, dots: 2, camera: [0, 3.7, 3.9], fov: 36,
    cells: [
      { color: C.green, disc: true }, { color: C.red, disc: true },
      { color: C.yellow, disc: true }, { color: C.blue, disc: true },
    ],
    events: [
      { at: 0, dot: true },
      { at: 1.0, set: [{ i: 0, lit: true }] }, { at: 1.5, set: [{ i: 0, lit: false }] },
      { at: 1.9, set: [{ i: 2, lit: true }] }, { at: 2.4, set: [{ i: 2, lit: false }] },
      { at: 2.8, set: [{ i: 3, lit: true }] }, { at: 3.3, set: [{ i: 3, lit: false }] },
      { at: 4.1, dot: true, ring: 0, set: [{ i: 0, lit: true }] }, { at: 4.6, set: [{ i: 0, lit: false }] },
      { at: 5.1, ring: 2, set: [{ i: 2, lit: true }] }, { at: 5.6, set: [{ i: 2, lit: false }] },
      { at: 6.1, ring: 3, set: [{ i: 3, lit: true }] }, { at: 6.6, set: [{ i: 3, lit: false }] },
    ],
  },
  // Memorize the flashed cells, then tap them from memory.
  memorygrid: {
    cols: 3, rows: 3, dur: 9, dots: 2, camera: [0, 4.5, 4.6], fov: 36,
    cells: fillCells(9, { color: C.ink }),
    events: [
      { at: 0, dot: true },
      { at: 1.0, set: [{ i: 0, color: C.cyan, lit: true }, { i: 4, color: C.cyan, lit: true }, { i: 8, color: C.cyan, lit: true }] },
      { at: 2.6, set: [{ i: 0, color: C.ink, lit: false }, { i: 4, color: C.ink, lit: false }, { i: 8, color: C.ink, lit: false }] },
      { at: 3.4, dot: true, ring: 0, set: [{ i: 0, color: C.green, lit: true }] },
      { at: 4.4, ring: 4, set: [{ i: 4, color: C.green, lit: true }] },
      { at: 5.4, ring: 8, set: [{ i: 8, color: C.green, lit: true }] },
    ],
  },
  // Whack the moles as they pop up.
  whack: {
    cols: 3, rows: 3, dur: 8.5, dots: 4, camera: [0, 4.3, 4.7], fov: 36,
    cells: fillCells(9, { color: C.hole, disc: true }),
    events: [
      { at: 0, dot: true },
      { at: 1.3, dot: true, set: [{ i: 4, color: C.mole, fx: 'pop' }] },
      { at: 2.0, ring: 4, set: [{ i: 4, color: C.hole }] },
      { at: 2.8, dot: true, set: [{ i: 1, color: C.mole, fx: 'pop' }] },
      { at: 3.5, ring: 1, set: [{ i: 1, color: C.hole }] },
      { at: 4.3, dot: true, set: [{ i: 7, color: C.mole, fx: 'pop' }] },
      { at: 5.0, ring: 7, set: [{ i: 7, color: C.hole }] },
    ],
  },
  // Flip two cards; matching symbols stay and glow.
  memory: {
    cols: 2, rows: 2, dur: 8.5, dots: 3, camera: [0, 3.7, 3.9], fov: 36,
    cells: fillCells(4, { color: C.indigo }),
    events: [
      { at: 0, dot: true },
      { at: 1.4, dot: true, ring: 0, set: [{ i: 0, color: C.white, label: '★', labelColor: C.amber, fx: 'flip' }] },
      { at: 3.0, dot: true, ring: 3, set: [{ i: 3, color: C.white, label: '★', labelColor: C.amber, fx: 'flip' }] },
      { at: 4.4, set: [{ i: 0, color: C.green, lit: true }, { i: 3, color: C.green, lit: true }] },
    ],
  },
  // Move a card onto the next one down in alternating color.
  solitaire: {
    cols: 3, rows: 1, dur: 8, dots: 3, camera: [0, 3.0, 4.2], fov: 34, tile: 0.9,
    cells: [
      { color: C.white, label: '7', labelColor: C.ink },
      { color: C.board },
      { color: C.white, label: '6', labelColor: C.red },
    ],
    events: [
      { at: 0, dot: true },
      { at: 1.6, dot: true, ring: 2, arrow: 'L' },
      { at: 2.8, dot: true, set: [
        { i: 2, hidden: true },
        { i: 1, color: C.white, label: '6', labelColor: C.red, fx: 'pop' },
        { i: 0, lit: true },
      ] },
    ],
  },
  // Place a row of colored pegs; glints mark the correct ones.
  mastermind: {
    cols: 4, rows: 1, dur: 8, dots: 2, camera: [0, 2.9, 4.2], fov: 34,
    cells: fillCells(4, { color: C.slot, disc: true }),
    events: [
      { at: 0, dot: true },
      { at: 1.2, set: [{ i: 0, color: C.red, fx: 'pop' }] },
      { at: 1.7, set: [{ i: 1, color: C.blue, fx: 'pop' }] },
      { at: 2.2, set: [{ i: 2, color: C.green, fx: 'pop' }] },
      { at: 2.7, set: [{ i: 3, color: C.yellow, fx: 'pop' }] },
      { at: 3.7, dot: true, set: [{ i: 0, lit: true }, { i: 2, lit: true }] },
    ],
  },
  // Jump a peg over its neighbor into the empty hole.
  pegsolitaire: {
    cols: 3, rows: 1, dur: 8, dots: 3, camera: [0, 3.0, 4.0], fov: 34, tile: 0.9,
    cells: [
      { color: C.amber, disc: true }, { color: C.amber, disc: true }, { color: C.hole, disc: true },
    ],
    events: [
      { at: 0, dot: true },
      { at: 1.6, dot: true, ring: 0, arrow: 'R' },
      { at: 2.8, dot: true, set: [
        { i: 0, color: C.hole }, { i: 1, color: C.hole }, { i: 2, color: C.amber, fx: 'pop' },
      ] },
    ],
  },
  // Tap a light to toggle its plus-shape; clear the whole board.
  lightsout: {
    cols: 3, rows: 3, dur: 8, dots: 3, camera: [0, 4.5, 4.4], fov: 36,
    cells: [
      { color: C.ink }, { color: C.amber, lit: true }, { color: C.ink },
      { color: C.amber, lit: true }, { color: C.amber, lit: true }, { color: C.amber, lit: true },
      { color: C.ink }, { color: C.amber, lit: true }, { color: C.ink },
    ],
    events: [
      { at: 0, dot: true },
      { at: 1.8, dot: true, ring: 4, set: [1, 3, 4, 5, 7].map((i) => ({ i, color: C.ink, lit: false })) },
      { at: 3.4, dot: true, set: Array.from({ length: 9 }, (_, i) => ({ i, color: C.green, lit: true })) },
    ],
  },
  // Pick a color so your corner region floods the whole board.
  flood: {
    cols: 4, rows: 4, dur: 9, dots: 3, camera: [0, 5.4, 5.2], fov: 38, tile: 0.8, step: 0.92,
    cells: [
      { color: C.pink }, { color: C.pink }, { color: C.blue }, { color: C.green },
      { color: C.pink }, { color: C.blue }, { color: C.yellow }, { color: C.green },
      { color: C.green }, { color: C.yellow }, { color: C.red }, { color: C.blue },
      { color: C.blue }, { color: C.green }, { color: C.red }, { color: C.yellow },
    ],
    events: [
      { at: 0, dot: true },
      { at: 1.8, dot: true, set: [0, 1, 2, 4, 5, 8].map((i) => ({ i, color: C.pink })) },
      { at: 3.8, dot: true, set: Array.from({ length: 16 }, (_, i) => ({ i, color: C.pink })) },
    ],
  },
  // Wait for green, then tap as fast as you can.
  reaction: {
    cols: 1, rows: 1, dur: 7, dots: 2, camera: [0, 1.2, 4.4], fov: 40, tile: 2.4, depth: 0.3,
    cells: [{ color: C.red }],
    events: [
      { at: 0, dot: true },
      { at: 1.6, set: [{ i: 0, color: '#7f1d1d' }] },
      { at: 3.2, dot: true, set: [{ i: 0, color: C.green, lit: true }] },
      { at: 3.5, ring: 0 },
    ],
  },
  // Tap the button matching the panel's FILL color.
  colorclash: {
    cols: 3, rows: 2, dur: 8, dots: 2, camera: [0, 3.6, 4.0], fov: 38,
    cells: [
      { color: C.board, hidden: true }, { color: C.green }, { color: C.board, hidden: true },
      { color: C.red, disc: true }, { color: C.green, disc: true }, { color: C.blue, disc: true },
    ],
    events: [
      { at: 0, dot: true },
      { at: 1.8, dot: true, ring: 4, set: [{ i: 4, lit: true, label: '✓', labelColor: C.white, fx: 'pop' }] },
    ],
  },
};

// ---- registry + public component ------------------------------------------

type SceneCfg = { dots: number; Scene: FC<SceneProps>; camera: [number, number, number]; fov: number };
const SCENES: Record<string, SceneCfg> = {
  cube: { dots: CUBE_STEPS.length, Scene: CubeScene, camera: [3.0, 2.7, 3.8], fov: 36 },
  watersort: { dots: WATER_STEPS.length, Scene: WaterScene, camera: [0, 0.5, 6.2], fov: 38 },
  gomoku: { dots: GOMOKU_STEPS.length, Scene: GomokuScene, camera: [0, 4.3, 4.9], fov: 38 },
};
for (const id of Object.keys(GRID_CONFIGS)) {
  const cfg = GRID_CONFIGS[id];
  SCENES[id] = {
    dots: cfg.dots,
    camera: cfg.camera,
    fov: cfg.fov,
    Scene: (p: SceneProps) => <GridScene cfg={cfg} reduced={p.reduced} reportStep={p.reportStep} />,
  };
}

export default function VisualTutorial({ gameId }: { gameId: string }) {
  const reduced = useMemo(() => prefersReducedMotion(), []);
  const cfg = SCENES[gameId];
  const [step, setStep] = useState(reduced && cfg ? cfg.dots - 1 : 0);
  if (!cfg) return null;
  const { Scene, dots, camera, fov } = cfg;

  return (
    <div aria-hidden>
      <div
        className="relative w-full overflow-hidden rounded-2xl ring-1 ring-white/10"
        style={{ height: H, background: 'radial-gradient(120% 100% at 50% 0%, #1e1b4b 0%, #0b1020 60%, #070a14 100%)' }}
      >
        <Canvas dpr={[1, 2]} gl={{ antialias: true, alpha: true }} camera={{ position: camera, fov }}>
          <Suspense fallback={null}>
            <Lights />
            <Scene reduced={reduced} reportStep={setStep} />
          </Suspense>
        </Canvas>
      </div>

      {/* Progress dots. */}
      <div className="mt-4 flex items-center justify-center gap-1.5">
        {Array.from({ length: dots }).map((_, i) => (
          <span
            key={i}
            className={`h-2 rounded-full transition-all duration-300 ${i === step ? 'w-6 bg-brand' : 'w-2 bg-slate-300/40'}`}
          />
        ))}
      </div>
    </div>
  );
}
