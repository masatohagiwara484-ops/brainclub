import {
  Suspense,
  useCallback,
  useMemo,
  useRef,
  useState,
  type MutableRefObject,
} from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Text } from '@react-three/drei';
import { AnimatePresence, motion } from 'framer-motion';
import { useNavigate, type NavigateFunction } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import * as THREE from 'three';
import { GAMES, type GameDef } from '../games/registry';
import { prefersReducedMotion } from '../lib/fx';
import { haptics } from '../lib/haptics';
import { palette } from '../lib/theme';

// ============================================================================
// Rotating3DGameSelector — a true 3D rotating "game wheel" (rotating-door style)
// built on @react-three/fiber. Drag/swipe left-right to spin the ring; the
// front-center slot snaps in with a spring (THREE.MathUtils.damp), scales up and
// glows. Each slot carries a hand-crafted mini 3D model of its game. An HTML
// overlay (framer-motion) cross-fades the name + tagline. Reduced-motion users
// get a clean 2D snap carousel instead.
//
// Perf notes: low-poly geometry, emissive materials carry the "glow" so lighting
// stays cheap, and every model's internal animation is gated to the active
// (front) slot via a boolean ref — so only ~1 model animates at a time.
// The whole component is lazy-routed, keeping three/drei/framer out of the main
// bundle.
// ============================================================================

const RADIUS = 6.2; // ring radius — sized so 21 slots don't overlap
const DRAG_SPEED = 0.009; // radians of rotation per pixel dragged

type Trio = [base: string, alt: string, glow: string];
type ActiveRef = MutableRefObject<boolean>;

// Per-game material palette (base, accent, glow) chosen to match each game's
// 2D identity. Falls back to the premium indigo set.
const GAME_COLORS: Record<string, Trio> = {
  cube: ['#e11d48', '#f59e0b', '#22d3ee'],
  sudoku: ['#0ea5e9', '#4f46e5', '#38bdf8'],
  wordle: ['#10b981', '#0d9488', '#34d399'],
  solitaire: ['#f43f5e', '#dc2626', '#fb7185'],
  watersort: ['#06b6d4', '#2563eb', '#22d3ee'],
  gomoku: ['#d9a441', '#b45309', '#fbbf24'],
  colorclash: ['#ec4899', '#f97316', '#f472b6'],
  reaction: ['#84cc16', '#16a34a', '#a3e635'],
  simon: ['#f43f5e', '#db2777', '#fb7185'],
  memorygrid: ['#8b5cf6', '#d946ef', '#c084fc'],
  whack: ['#f59e0b', '#ea580c', '#fbbf24'],
  memory: ['#d946ef', '#9333ea', '#e879f9'],
  schulte: ['#14b8a6', '#0891b2', '#2dd4bf'],
  '2048': ['#fb923c', '#ef4444', '#fdba74'],
  slide: ['#0ea5e9', '#1d4ed8', '#38bdf8'],
  lightsout: ['#facc15', '#d97706', '#fde047'],
  mastermind: ['#6366f1', '#7e22ce', '#a5b4fc'],
  minesweeper: ['#64748b', '#334155', '#94a3b8'],
  flood: ['#22d3ee', '#2563eb', '#67e8f9'],
  pegsolitaire: ['#d97706', '#92400e', '#fbbf24'],
  chess: ['#94a3b8', '#334155', '#cbd5e1'],
};

const getColors = (id: string): Trio =>
  GAME_COLORS[id] ?? [palette.primary, palette.accentPink, palette.accentCyan];

// ---------------------------------------------------------------------------
// Hand-crafted mini models
// ---------------------------------------------------------------------------

function RubikModel({ activeRef }: { activeRef: ActiveRef }) {
  const g = useRef<THREE.Group>(null);
  const mats = useMemo(
    () =>
      ['#ffffff', '#ffd500', '#c41e3a', '#ff5800', '#0051ba', '#009e60'].map(
        (c) => new THREE.MeshStandardMaterial({ color: c, metalness: 0.1, roughness: 0.45 }),
      ),
    [],
  );
  useFrame((_, dt) => {
    if (g.current && activeRef.current) {
      g.current.rotation.y += dt * 0.6;
      g.current.rotation.x += dt * 0.25;
    }
  });
  const gap = 0.5;
  const cubelets = [];
  for (let xi = 0; xi < 2; xi++)
    for (let yi = 0; yi < 2; yi++)
      for (let zi = 0; zi < 2; zi++)
        cubelets.push(
          <mesh
            key={`${xi}${yi}${zi}`}
            material={mats}
            position={[(xi - 0.5) * gap, (yi - 0.5) * gap, (zi - 0.5) * gap]}
          >
            <boxGeometry args={[0.46, 0.46, 0.46]} />
          </mesh>,
        );
  return (
    <group ref={g} scale={0.95}>
      {cubelets}
    </group>
  );
}

function TubesModel({ activeRef, tubes }: { activeRef: ActiveRef; tubes: string[][] }) {
  const ref = useRef<THREE.Group>(null);
  useFrame((s) => {
    if (ref.current && activeRef.current)
      ref.current.children.forEach((c, i) => {
        c.position.y = Math.sin(s.clock.elapsedTime * 2 + i) * 0.025;
      });
  });
  const tubeW = 0.34;
  const spacing = 0.44;
  const h = 1.15;
  return (
    <group ref={ref} position={[-((tubes.length - 1) * spacing) / 2, 0, 0]}>
      {tubes.map((layers, ti) => (
        <group key={ti} position={[ti * spacing, 0, 0]}>
          <mesh>
            <cylinderGeometry args={[tubeW / 2, tubeW / 2, h, 20, 1, true]} />
            <meshStandardMaterial
              color="#cbd5e1"
              transparent
              opacity={0.18}
              roughness={0.1}
              side={THREE.DoubleSide}
            />
          </mesh>
          <mesh position={[0, -h / 2, 0]}>
            <cylinderGeometry args={[tubeW / 2, tubeW / 2, 0.05, 20]} />
            <meshStandardMaterial color="#94a3b8" transparent opacity={0.4} />
          </mesh>
          {layers.map((col, li) => {
            const lh = (h - 0.1) / layers.length;
            return (
              <mesh key={li} position={[0, -h / 2 + 0.06 + lh * (li + 0.5), 0]}>
                <cylinderGeometry args={[tubeW / 2 - 0.03, tubeW / 2 - 0.03, lh * 0.95, 20]} />
                <meshStandardMaterial
                  color={col}
                  roughness={0.3}
                  metalness={0.1}
                  emissive={col}
                  emissiveIntensity={0.18}
                />
              </mesh>
            );
          })}
        </group>
      ))}
    </group>
  );
}

function StonesModel({ activeRef }: { activeRef: ActiveRef }) {
  const drop = useRef<THREE.Mesh>(null);
  useFrame((s) => {
    if (drop.current) {
      const t = activeRef.current ? Math.abs(Math.sin(s.clock.elapsedTime * 1.6)) : 1;
      drop.current.position.y = 0.13 + (1 - t) * 0.7;
    }
  });
  const pts: [number, number, boolean][] = [
    [-0.42, -0.42, true],
    [0, -0.42, false],
    [0.42, 0, true],
    [-0.42, 0.42, false],
    [0.42, 0.42, true],
    [0, 0, false],
  ];
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <boxGeometry args={[1.45, 1.45, 0.12]} />
        <meshStandardMaterial color="#d9a441" roughness={0.6} />
      </mesh>
      {pts.map(([x, z, black], i) => (
        <mesh key={i} position={[x, 0.13, z]}>
          <sphereGeometry args={[0.16, 20, 20]} />
          <meshStandardMaterial color={black ? '#1e293b' : '#f8fafc'} roughness={0.35} metalness={0.1} />
        </mesh>
      ))}
      <mesh ref={drop} position={[0.42, 0.13, -0.42]}>
        <sphereGeometry args={[0.16, 20, 20]} />
        <meshStandardMaterial color="#1e293b" roughness={0.35} />
      </mesh>
    </group>
  );
}

function LettersModel({ activeRef }: { activeRef: ActiveRef }) {
  const ref = useRef<THREE.Group>(null);
  const letters = ['W', 'O', 'R', 'D'];
  const cols = ['#22c55e', '#64748b', '#eab308', '#22c55e'];
  useFrame((s) => {
    if (ref.current && activeRef.current)
      ref.current.children.forEach((c, i) => {
        c.position.y = Math.sin(s.clock.elapsedTime * 2 + i * 0.6) * 0.07;
      });
  });
  const gap = 0.46;
  return (
    <group ref={ref} position={[-((letters.length - 1) * gap) / 2, 0, 0]}>
      {letters.map((ch, i) => (
        <group key={i} position={[i * gap, 0, 0]}>
          <mesh>
            <boxGeometry args={[0.42, 0.42, 0.16]} />
            <meshStandardMaterial color={cols[i]} roughness={0.4} emissive={cols[i]} emissiveIntensity={0.12} />
          </mesh>
          <Text position={[0, 0, 0.1]} fontSize={0.28} color="#ffffff" anchorX="center" anchorY="middle">
            {ch}
          </Text>
        </group>
      ))}
    </group>
  );
}

function GridGlowModel({
  activeRef,
  n,
  base,
  glow,
  seed,
  motif,
}: {
  activeRef: ActiveRef;
  n: number;
  base: string;
  glow: string;
  seed: number;
  motif?: React.ReactNode;
}) {
  const ref = useRef<THREE.Group>(null);
  useFrame((s) => {
    if (ref.current && activeRef.current) ref.current.rotation.y = Math.sin(s.clock.elapsedTime * 0.6) * 0.22;
  });
  const tile = 0.34;
  const step = tile + 0.04;
  const off = ((n - 1) * step) / 2;
  const cells = [];
  for (let i = 0; i < n; i++)
    for (let j = 0; j < n; j++) {
      const on = (i * 7 + j * 13 + seed) % 3 === 0;
      cells.push(
        <mesh key={`${i}${j}`} position={[i * step - off, on ? 0.12 : 0.06, j * step - off]}>
          <boxGeometry args={[tile, on ? 0.18 : 0.1, tile]} />
          <meshStandardMaterial
            color={on ? glow : base}
            emissive={on ? glow : '#000000'}
            emissiveIntensity={on ? 0.6 : 0}
            roughness={0.4}
            metalness={0.15}
          />
        </mesh>,
      );
    }
  return (
    <group ref={ref}>
      <mesh position={[0, -0.02, 0]}>
        <boxGeometry args={[n * step + 0.1, 0.08, n * step + 0.1]} />
        <meshStandardMaterial color="#0f172a" roughness={0.6} />
      </mesh>
      {cells}
      {motif}
    </group>
  );
}

function PegsModel({ activeRef, cols }: { activeRef: ActiveRef; cols: string[] }) {
  const ref = useRef<THREE.Group>(null);
  useFrame((s) => {
    if (ref.current && activeRef.current)
      ref.current.children.forEach((c, i) => {
        c.position.y = Math.sin(s.clock.elapsedTime * 2 + i) * 0.06;
      });
  });
  const gap = 0.4;
  return (
    <group ref={ref} position={[-((cols.length - 1) * gap) / 2, 0, 0]}>
      {cols.map((c, i) => (
        <mesh key={i} position={[i * gap, 0, 0]}>
          <sphereGeometry args={[0.17, 20, 20]} />
          <meshStandardMaterial color={c} roughness={0.25} metalness={0.2} emissive={c} emissiveIntensity={0.15} />
        </mesh>
      ))}
    </group>
  );
}

function CardsModel({ activeRef, accent, flip }: { activeRef: ActiveRef; accent: string; flip: boolean }) {
  const c2 = useRef<THREE.Group>(null);
  useFrame((s) => {
    if (c2.current && activeRef.current && flip) c2.current.rotation.y = s.clock.elapsedTime * 1.6;
  });
  const Card = ({ rot, pos, r }: { rot: number; pos: [number, number, number]; r?: typeof c2 }) => (
    <group ref={r} rotation={[0, 0, rot]} position={pos}>
      <mesh>
        <boxGeometry args={[0.7, 1.0, 0.04]} />
        <meshStandardMaterial color="#f8fafc" roughness={0.4} />
      </mesh>
      <mesh position={[0, 0, 0.03]}>
        <boxGeometry args={[0.26, 0.26, 0.02]} />
        <meshStandardMaterial color={accent} emissive={accent} emissiveIntensity={0.2} />
      </mesh>
    </group>
  );
  return (
    <group>
      <Card rot={0.25} pos={[-0.22, 0, -0.05]} />
      <Card rot={-0.15} pos={[0.22, 0, 0]} r={flip ? c2 : undefined} />
    </group>
  );
}

function SimonModel({ activeRef }: { activeRef: ActiveRef }) {
  const cols = ['#22c55e', '#ef4444', '#eab308', '#3b82f6'];
  const r0 = useRef<THREE.Mesh>(null);
  const r1 = useRef<THREE.Mesh>(null);
  const r2 = useRef<THREE.Mesh>(null);
  const r3 = useRef<THREE.Mesh>(null);
  const refs = [r0, r1, r2, r3];
  useFrame((s) => {
    const lit = Math.floor(s.clock.elapsedTime * 1.5) % 4;
    refs.forEach((r, i) => {
      const m = r.current?.material as THREE.MeshStandardMaterial | undefined;
      if (m) m.emissiveIntensity = activeRef.current && i === lit ? 1.1 : 0.15;
    });
  });
  const pos: [number, number][] = [
    [-0.32, 0.32],
    [0.32, 0.32],
    [-0.32, -0.32],
    [0.32, -0.32],
  ];
  return (
    <group rotation={[-0.5, 0, 0]}>
      {pos.map((p, i) => (
        <mesh key={i} ref={refs[i]} position={[p[0], p[1], 0]}>
          <boxGeometry args={[0.55, 0.55, 0.18]} />
          <meshStandardMaterial color={cols[i]} emissive={cols[i]} emissiveIntensity={0.15} roughness={0.4} />
        </mesh>
      ))}
    </group>
  );
}

function BoltModel({ activeRef }: { activeRef: ActiveRef }) {
  const m = useRef<THREE.MeshStandardMaterial>(null);
  const shape = useMemo(() => {
    const s = new THREE.Shape();
    s.moveTo(0.05, 0.6);
    s.lineTo(-0.3, 0.0);
    s.lineTo(-0.05, 0.0);
    s.lineTo(-0.2, -0.6);
    s.lineTo(0.32, 0.1);
    s.lineTo(0.06, 0.1);
    s.closePath();
    return s;
  }, []);
  useFrame((s) => {
    if (m.current)
      m.current.emissiveIntensity = activeRef.current
        ? 0.6 + Math.abs(Math.sin(s.clock.elapsedTime * 6)) * 1.3
        : 0.4;
  });
  return (
    <mesh>
      <extrudeGeometry
        args={[shape, { depth: 0.14, bevelEnabled: true, bevelThickness: 0.02, bevelSize: 0.02, bevelSegments: 1 }]}
      />
      <meshStandardMaterial ref={m} color="#fde047" emissive="#facc15" emissiveIntensity={0.5} metalness={0.3} roughness={0.3} />
    </mesh>
  );
}

function PaletteModel({ activeRef }: { activeRef: ActiveRef }) {
  const ref = useRef<THREE.Group>(null);
  useFrame((_, dt) => {
    if (ref.current && activeRef.current) ref.current.rotation.y += dt * 0.8;
  });
  const cols = ['#ec4899', '#8b5cf6', '#fb923c'];
  return (
    <group ref={ref}>
      {cols.map((c, i) => {
        const a = (i / 3) * Math.PI * 2;
        return (
          <mesh key={i} position={[Math.cos(a) * 0.3, Math.sin(a) * 0.3, 0]}>
            <sphereGeometry args={[0.32, 24, 24]} />
            <meshStandardMaterial color={c} transparent opacity={0.72} roughness={0.2} emissive={c} emissiveIntensity={0.22} />
          </mesh>
        );
      })}
    </group>
  );
}

function MalletModel({ activeRef }: { activeRef: ActiveRef }) {
  const arm = useRef<THREE.Group>(null);
  useFrame((s) => {
    if (arm.current)
      arm.current.rotation.z = activeRef.current ? -0.5 - Math.abs(Math.sin(s.clock.elapsedTime * 4)) * 0.6 : -0.3;
  });
  return (
    <group>
      <mesh position={[0, -0.3, 0]}>
        <sphereGeometry args={[0.5, 24, 16, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshStandardMaterial color="#a16207" roughness={0.7} />
      </mesh>
      <mesh position={[0, -0.05, 0]}>
        <sphereGeometry args={[0.26, 20, 20]} />
        <meshStandardMaterial color="#92400e" roughness={0.5} />
      </mesh>
      <group ref={arm} position={[0.1, 0.2, 0]}>
        <mesh position={[0, 0.35, 0]}>
          <cylinderGeometry args={[0.05, 0.05, 0.6, 12]} />
          <meshStandardMaterial color="#78350f" />
        </mesh>
        <mesh position={[0, 0.65, 0]}>
          <boxGeometry args={[0.4, 0.22, 0.22]} />
          <meshStandardMaterial color="#ef4444" roughness={0.4} metalness={0.2} />
        </mesh>
      </group>
    </group>
  );
}

function PawnModel({ activeRef }: { activeRef: ActiveRef }) {
  const ref = useRef<THREE.Group>(null);
  useFrame((_, dt) => {
    if (ref.current && activeRef.current) ref.current.rotation.y += dt * 0.5;
  });
  const pts = useMemo(
    () =>
      (
        [
          [0, -0.6],
          [0.34, -0.6],
          [0.3, -0.5],
          [0.16, -0.42],
          [0.14, 0.0],
          [0.24, 0.12],
          [0.1, 0.22],
          [0.18, 0.34],
          [0, 0.36],
        ] as [number, number][]
      ).map(([x, y]) => new THREE.Vector2(Math.max(0.001, x), y)),
    [],
  );
  return (
    <group ref={ref}>
      <mesh>
        <latheGeometry args={[pts, 28]} />
        <meshStandardMaterial color="#e2e8f0" roughness={0.3} metalness={0.2} />
      </mesh>
      <mesh position={[0, 0.46, 0]}>
        <sphereGeometry args={[0.16, 20, 20]} />
        <meshStandardMaterial color="#e2e8f0" roughness={0.3} metalness={0.2} />
      </mesh>
    </group>
  );
}

function DefaultModel({ colors }: { colors: Trio }) {
  const [base, , glow] = colors;
  return (
    <mesh>
      <icosahedronGeometry args={[0.6, 0]} />
      <meshStandardMaterial color={base} emissive={glow} emissiveIntensity={0.25} roughness={0.3} metalness={0.3} flatShading />
    </mesh>
  );
}

// Flat number/letter helper for grid motifs.
const flatText = (s: string, color = '#ffffff') => (
  <Text position={[0, 0.34, 0]} rotation={[-Math.PI / 2, 0, 0]} fontSize={0.3} color={color} anchorX="center" anchorY="middle">
    {s}
  </Text>
);

function GameModel({ id, colors, activeRef }: { id: string; colors: Trio; activeRef: ActiveRef }) {
  const [base, , glow] = colors;
  switch (id) {
    case 'cube':
      return <RubikModel activeRef={activeRef} />;
    case 'watersort':
      return (
        <TubesModel
          activeRef={activeRef}
          tubes={[
            ['#ef4444', '#3b82f6', '#22c55e'],
            ['#3b82f6', '#22c55e', '#eab308'],
            ['#eab308', '#ef4444', '#8b5cf6'],
          ]}
        />
      );
    case 'gomoku':
      return <StonesModel activeRef={activeRef} />;
    case 'wordle':
      return <LettersModel activeRef={activeRef} />;
    case 'sudoku':
      return <GridGlowModel activeRef={activeRef} n={3} base={base} glow={glow} seed={0} motif={flatText('5')} />;
    case 'flood':
      return <GridGlowModel activeRef={activeRef} n={4} base={base} glow={glow} seed={1} />;
    case 'memorygrid':
      return <GridGlowModel activeRef={activeRef} n={4} base={base} glow={glow} seed={3} />;
    case 'schulte':
      return <GridGlowModel activeRef={activeRef} n={4} base={base} glow={glow} seed={6} />;
    case 'slide':
      return <GridGlowModel activeRef={activeRef} n={3} base={base} glow={glow} seed={5} motif={flatText('15')} />;
    case '2048':
      return <GridGlowModel activeRef={activeRef} n={3} base={base} glow={glow} seed={7} motif={flatText('2048', '#ffffff')} />;
    case 'lightsout':
      return (
        <GridGlowModel
          activeRef={activeRef}
          n={3}
          base={base}
          glow={glow}
          seed={2}
          motif={
            <mesh position={[0, 0.42, 0]}>
              <sphereGeometry args={[0.13, 16, 16]} />
              <meshStandardMaterial color="#fde047" emissive="#fde047" emissiveIntensity={1.2} />
            </mesh>
          }
        />
      );
    case 'minesweeper':
      return (
        <GridGlowModel
          activeRef={activeRef}
          n={3}
          base={base}
          glow={glow}
          seed={4}
          motif={
            <mesh position={[0, 0.4, 0]}>
              <sphereGeometry args={[0.16, 18, 18]} />
              <meshStandardMaterial color="#0f172a" roughness={0.4} metalness={0.3} />
            </mesh>
          }
        />
      );
    case 'mastermind':
      return <PegsModel activeRef={activeRef} cols={['#ef4444', '#22c55e', '#3b82f6', '#eab308']} />;
    case 'pegsolitaire':
      return <PegsModel activeRef={activeRef} cols={['#d97706', '#f59e0b', '#d97706']} />;
    case 'solitaire':
      return <CardsModel activeRef={activeRef} accent={base} flip={false} />;
    case 'memory':
      return <CardsModel activeRef={activeRef} accent={base} flip />;
    case 'simon':
      return <SimonModel activeRef={activeRef} />;
    case 'reaction':
      return <BoltModel activeRef={activeRef} />;
    case 'colorclash':
      return <PaletteModel activeRef={activeRef} />;
    case 'whack':
      return <MalletModel activeRef={activeRef} />;
    case 'chess':
      return <PawnModel activeRef={activeRef} />;
    default:
      return <DefaultModel colors={colors} />;
  }
}

// ---------------------------------------------------------------------------
// Slot — one game on the ring (model + pedestal + selection glow)
// ---------------------------------------------------------------------------

function Slot({
  game,
  colors,
  baseAngle,
  rotRef,
}: {
  game: GameDef;
  colors: Trio;
  baseAngle: number;
  rotRef: MutableRefObject<number>;
}) {
  const group = useRef<THREE.Group>(null);
  const halo = useRef<THREE.Mesh>(null);
  const rim = useRef<THREE.Mesh>(null);
  const activeRef = useRef(false);
  const [, , glow] = colors;
  const x = Math.sin(baseAngle) * RADIUS;
  const z = Math.cos(baseAngle) * RADIUS;

  useFrame((_, dt) => {
    const d = Math.min(dt, 0.05);
    const world = baseAngle + rotRef.current;
    const fc = Math.max(0, Math.cos(world)); // 1 at front, 0 at the sides/back
    const intensity = fc * fc;
    activeRef.current = fc > 0.6;
    if (group.current) {
      const s = THREE.MathUtils.damp(group.current.scale.x, 1 + intensity * 0.45, 9, d);
      group.current.scale.setScalar(s);
    }
    if (halo.current) (halo.current.material as THREE.MeshBasicMaterial).opacity = intensity * 0.55;
    if (rim.current) (rim.current.material as THREE.MeshStandardMaterial).emissiveIntensity = 0.2 + intensity * 1.6;
  });

  return (
    <group position={[x, 0, z]} rotation={[0, baseAngle, 0]}>
      <group ref={group}>
        <mesh ref={halo} position={[0, 0.3, -0.5]}>
          <circleGeometry args={[1.15, 40]} />
          <meshBasicMaterial color={glow} transparent opacity={0} blending={THREE.AdditiveBlending} depthWrite={false} />
        </mesh>
        <group position={[0, 0.2, 0]}>
          <GameModel id={game.id} colors={colors} activeRef={activeRef} />
        </group>
        <mesh position={[0, -0.85, 0]}>
          <cylinderGeometry args={[0.78, 0.9, 0.16, 36]} />
          <meshStandardMaterial color="#0f172a" metalness={0.5} roughness={0.45} />
        </mesh>
        <mesh ref={rim} position={[0, -0.76, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.74, 0.03, 12, 40]} />
          <meshStandardMaterial color={glow} emissive={glow} emissiveIntensity={0.3} metalness={0.3} roughness={0.4} />
        </mesh>
      </group>
    </group>
  );
}

// ---------------------------------------------------------------------------
// Scene — lights + the rotating ring; owns rotation damping + selection
// ---------------------------------------------------------------------------

function Scene({
  games,
  slotAngle,
  drag,
  rotRef,
  onSelect,
}: {
  games: GameDef[];
  slotAngle: number;
  drag: MutableRefObject<{ target: number; dragging: boolean }>;
  rotRef: MutableRefObject<number>;
  onSelect: (i: number) => void;
}) {
  const ring = useRef<THREE.Group>(null);
  useFrame((_, dt) => {
    const g = ring.current;
    if (!g) return;
    g.rotation.y = THREE.MathUtils.damp(g.rotation.y, drag.current.target, 8, Math.min(dt, 0.05));
    rotRef.current = g.rotation.y;
    const n = games.length;
    onSelect(((Math.round(-g.rotation.y / slotAngle) % n) + n) % n);
  });
  return (
    <>
      <ambientLight intensity={0.7} />
      <directionalLight position={[5, 7, 6]} intensity={2.0} color="#ffffff" />
      <pointLight position={[-6, 3, -4]} intensity={30} color={palette.accentCyan} distance={28} />
      <pointLight position={[5, -2, 5]} intensity={18} color={palette.accentPink} distance={28} />
      <group ref={ring}>
        {games.map((g, i) => (
          <Slot key={g.id} game={g} colors={getColors(g.id)} baseAngle={i * slotAngle} rotRef={rotRef} />
        ))}
      </group>
    </>
  );
}

// ---------------------------------------------------------------------------
// 2D fallback (reduced motion) — a clean horizontal snap carousel
// ---------------------------------------------------------------------------

function Fallback2D({
  games,
  t,
  nav,
  embedded = false,
}: {
  games: GameDef[];
  t: TFunction;
  nav: NavigateFunction;
  embedded?: boolean;
}) {
  return (
    <div className="h-full w-full overflow-x-auto" style={embedded ? undefined : { background: BG }}>
      <div className="flex h-full snap-x snap-mandatory items-center gap-4 px-[18vw]">
        {games.map((g) => (
          <button
            key={g.id}
            onClick={() => g.available && nav(g.route)}
            className={`flex aspect-[3/4] w-56 shrink-0 snap-center flex-col rounded-3xl bg-gradient-to-br ${g.gradient} p-5 text-left text-white shadow-elevated transition-premium active:scale-95`}
          >
            <div className="text-5xl">{g.emoji}</div>
            <div className="mt-auto">
              <div className="font-display text-xl">{t(g.nameKey)}</div>
              <div className="text-sm text-white/80">{t(g.taglineKey)}</div>
              {!g.available && <div className="mt-1 text-xs font-semibold uppercase tracking-wide text-white/70">{t('home.comingSoon')}</div>}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

const BG = 'radial-gradient(120% 90% at 50% 8%, #1e1b4b 0%, #0b1020 58%, #070a14 100%)';

// ---------------------------------------------------------------------------
// PlayButton — the call-to-action. `big` is the Home-hero variant: a tall,
// premium PLAY slab (gradient primary→cyan, indigo glow) with a framer-motion
// spring press. The small variant keeps the original look for the /labs route.
// ---------------------------------------------------------------------------

function PlayButton({
  game,
  onClick,
  t,
  big = false,
}: {
  game: GameDef;
  onClick: () => void;
  t: TFunction;
  big?: boolean;
}) {
  const playLabel = t('selector.play', { defaultValue: 'Play' });
  if (big) {
    return (
      <motion.button
        onClick={onClick}
        disabled={!game.available}
        whileTap={game.available ? { scale: 0.95 } : undefined}
        whileHover={game.available ? { scale: 1.015 } : undefined}
        transition={{ type: 'spring', stiffness: 480, damping: 26 }}
        className={`pointer-events-auto flex h-20 w-full items-center justify-center gap-3 rounded-3xl font-display text-2xl uppercase text-white ${
          game.available
            ? 'bg-gradient-to-r from-primary to-accent-cyan tracking-[0.22em] shadow-premium'
            : 'cursor-not-allowed bg-white/10 tracking-[0.12em] text-white/50'
        }`}
        aria-label={game.available ? `${playLabel} ${t(game.nameKey)}` : t('home.comingSoon')}
      >
        {game.available ? (
          <>
            <span aria-hidden className="text-xl leading-none">
              ▶
            </span>
            {playLabel}
          </>
        ) : (
          t('home.comingSoon')
        )}
      </motion.button>
    );
  }
  return (
    <button
      onClick={onClick}
      disabled={!game.available}
      className={`pointer-events-auto rounded-2xl px-8 py-3 font-display text-base shadow-premium transition-premium active:scale-95 ${
        game.available ? 'bg-brand text-white hover:bg-brandDark' : 'cursor-not-allowed bg-white/15 text-white/50'
      }`}
    >
      {game.available ? playLabel : t('home.comingSoon')}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Public component
// ---------------------------------------------------------------------------

export default function Rotating3DGameSelector({
  embedded = false,
}: {
  /** Home-hero mode: transparent backdrop (so the floating brain field shows
   *  through) + the large PLAY slab docked below the canvas. */
  embedded?: boolean;
} = {}) {
  const { t } = useTranslation();
  const nav = useNavigate();
  const reduced = useMemo(() => prefersReducedMotion(), []);
  const games = GAMES;
  const slotAngle = (Math.PI * 2) / games.length;

  const drag = useRef({ target: 0, dragging: false });
  const rotRef = useRef(0);
  const lastX = useRef(0);
  const lastIdx = useRef(-1);
  const [selected, setSelected] = useState(0);

  const reportIndex = useCallback((i: number) => {
    if (i === lastIdx.current) return;
    lastIdx.current = i;
    setSelected(i);
    haptics.tick();
  }, []);

  if (reduced) return <Fallback2D games={games} t={t} nav={nav} embedded={embedded} />;

  const snap = () => {
    drag.current.target = Math.round(drag.current.target / slotAngle) * slotAngle;
  };
  const onDown = (e: React.PointerEvent) => {
    drag.current.dragging = true;
    lastX.current = e.clientX;
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
  };
  const onMove = (e: React.PointerEvent) => {
    if (!drag.current.dragging) return;
    drag.current.target -= (e.clientX - lastX.current) * DRAG_SPEED;
    lastX.current = e.clientX;
  };
  const onUp = () => {
    if (!drag.current.dragging) return;
    drag.current.dragging = false;
    snap();
  };
  const onWheel = (e: React.WheelEvent) => {
    drag.current.target += Math.sign(e.deltaY) * slotAngle;
    snap();
  };

  const game = games[selected];
  const play = () => {
    if (game.available) nav(game.route);
  };

  // The drag/spin surface lives on the canvas region so it never fights with the
  // PLAY slab below it (embedded) or anything else.
  const dragHandlers = {
    onPointerDown: onDown,
    onPointerMove: onMove,
    onPointerUp: onUp,
    onPointerLeave: onUp,
    onPointerCancel: onUp,
    onWheel,
  };

  const canvasEl = (
    <Canvas
      dpr={[1, 2]}
      gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
      camera={{ position: [0, 1.5, 10.4], fov: 32 }}
      onCreated={({ camera }) => camera.lookAt(0, 0.2, 5.6)}
    >
      <Suspense fallback={null}>
        <Scene games={games} slotAngle={slotAngle} drag={drag} rotRef={rotRef} onSelect={reportIndex} />
      </Suspense>
    </Canvas>
  );

  const hintEl = (
    <div className="pointer-events-none absolute inset-x-0 top-0 flex justify-center pt-4">
      <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-white/70 backdrop-blur-sm">
        {t('selector.hint', { defaultValue: 'Drag to explore' })}
      </span>
    </div>
  );

  const nameEl = (
    <AnimatePresence mode="wait">
      <motion.div
        key={selected}
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -16 }}
        transition={{ duration: 0.26, ease: [0.22, 1, 0.36, 1] }}
        className="flex flex-col items-center text-center"
      >
        <h2 className="font-display text-2xl text-white drop-shadow-lg">{t(game.nameKey)}</h2>
        <p className="mt-1 max-w-xs text-sm text-white/70">{t(game.taglineKey)}</p>
      </motion.div>
    </AnimatePresence>
  );

  // Home-hero layout: canvas dominates (flex-1), the name/tagline floats at its
  // base, and the big PLAY slab docks directly below it in normal flow.
  if (embedded) {
    return (
      <div className="flex h-full w-full select-none flex-col overflow-hidden">
        <div className="relative min-h-0 flex-1" style={{ touchAction: 'none' }} {...dragHandlers}>
          {canvasEl}
          {hintEl}
          <div className="pointer-events-none absolute inset-x-0 bottom-2 flex justify-center px-6">{nameEl}</div>
        </div>
        <div className="px-5 pb-3 pt-1">
          <PlayButton game={game} onClick={play} t={t} big />
        </div>
      </div>
    );
  }

  // Standalone /labs/selector — the original full-bleed immersive view.
  return (
    <div
      className="relative h-full w-full select-none overflow-hidden"
      style={{ touchAction: 'none', background: BG }}
      {...dragHandlers}
    >
      {canvasEl}
      {hintEl}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 flex flex-col items-center gap-3 px-6 pb-10">
        {nameEl}
        <PlayButton game={game} onClick={play} t={t} />
      </div>
    </div>
  );
}
