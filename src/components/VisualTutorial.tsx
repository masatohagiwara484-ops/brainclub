import { Suspense, useMemo, useRef, useState, type FC } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
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

// ---- registry + public component ------------------------------------------

type SceneCfg = { dots: number; Scene: FC<SceneProps>; camera: [number, number, number]; fov: number };
const SCENES: Record<string, SceneCfg> = {
  cube: { dots: CUBE_STEPS.length, Scene: CubeScene, camera: [3.0, 2.7, 3.8], fov: 36 },
  watersort: { dots: WATER_STEPS.length, Scene: WaterScene, camera: [0, 0.5, 6.2], fov: 38 },
  gomoku: { dots: GOMOKU_STEPS.length, Scene: GomokuScene, camera: [0, 4.3, 4.9], fov: 38 },
};

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
