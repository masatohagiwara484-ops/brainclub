import {
  Suspense,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MutableRefObject,
} from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { AnimatePresence, motion } from 'framer-motion';
import { useNavigate, type NavigateFunction } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import * as THREE from 'three';
import { GAMES, type GameDef } from '../games/registry';
import { prefersReducedMotion } from '../lib/fx';
import { haptics } from '../lib/haptics';
import { gameColors } from '../lib/gamePalette';
import { GameModel } from './Rotating3DGameSelector';

// ============================================================================
// HolographicCardSelector — the home hero, reimagined as a Pokémon-TCG-style
// deck of HOLOGRAPHIC cards (R3F + a custom GLSL foil shader). One card fills the
// center; neighbors peek at the sides (coverflow). Swipe snaps exactly one card
// at a time (reliable selection), the center card tilts toward the pointer / on
// device-tilt (gyro) with an iridescent foil + glare + sparkle, and each card
// floats a hand-crafted 3D model of its game. Lazy-routed so three/drei/framer
// stay out of the main bundle. Reduced-motion users get a calm 2D card rail.
// ============================================================================

const BG = 'radial-gradient(120% 90% at 50% 6%, #221c54 0%, #0b1020 58%, #060812 100%)';
const SPACING = 2.35; // world-x gap between card centers
const CARD_W = 2.2;
const CARD_H = 3.1;
const DRAG_PER_PX = 0.0055; // cards moved per pixel dragged

// ---- Holographic foil shader ----------------------------------------------
const FOIL_VERT = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vView;
  void main() {
    vUv = uv;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vView = normalize(-mv.xyz);
    gl_Position = projectionMatrix * mv;
  }
`;
const FOIL_FRAG = /* glsl */ `
  precision highp float;
  uniform float uTime;
  uniform vec2 uPointer;
  uniform float uActive;
  uniform vec3 uA; // game base color
  uniform vec3 uB; // deep base
  uniform vec3 uC; // glow / rim
  varying vec2 vUv;
  varying vec3 vView;

  vec3 hue(float h){ return clamp(abs(mod(h*6.0+vec3(0.,4.,2.),6.0)-3.0)-1.0, 0.0, 1.0); }
  float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453); }

  // signed rounded-rect for crisp card corners (uv in 0..1)
  float roundedAlpha(vec2 uv, float r){
    vec2 p = abs(uv-0.5)*2.0;
    vec2 q = p - (1.0 - r);
    float d = length(max(q,0.0)) + min(max(q.x,q.y),0.0) - r;
    return 1.0 - smoothstep(0.0, 0.012, d);
  }

  void main(){
    vec2 uv = vUv;
    float a = roundedAlpha(uv, 0.10);
    if(a < 0.01) discard;

    float fres = pow(1.0 - clamp(vView.z, 0.0, 1.0), 2.0);
    vec3 base = mix(uB, uA, uv.y*0.85 + 0.1);

    // iridescent foil — hue shifts with uv, pointer (view angle) and fresnel
    float h = uv.x*2.2 + uv.y*1.3 + uPointer.x*0.7 + uPointer.y*0.45 + uTime*0.04 + fres*1.3;
    vec3 iris = hue(fract(h));
    vec3 col = mix(base, iris, (0.32 + 0.42*fres) * uActive);

    // moving glare band that tracks the pointer like a light reflection
    vec2 g = uv - 0.5 - uPointer*0.42;
    float glare = (1.0 - smoothstep(0.0, 0.42, length(g))) * (0.45*uActive + 0.12);
    col += glare;

    // twinkling sparkles on the foil
    vec2 sp = floor(uv*vec2(38.0, 54.0));
    float tw = step(0.965, hash(sp + floor(uTime*2.2)));
    col += tw * uActive * 0.85 * (0.4 + 0.6*fres);

    // rim light
    col += fres * uC * 0.55;

    // inner border frame
    vec2 b = abs(uv-0.5)*2.0;
    float frame = smoothstep(0.93, 0.95, max(b.x,b.y)) * (1.0 - smoothstep(0.985, 1.0, max(b.x,b.y)));
    col = mix(col, uC, frame*0.6);

    gl_FragColor = vec4(col, a);
  }
`;

type ActiveRef = MutableRefObject<boolean>;
type Pointer = MutableRefObject<{ x: number; y: number }>;

function HoloCard({
  game,
  index,
  progress,
  pointer,
  reduced,
}: {
  game: GameDef;
  index: number;
  progress: MutableRefObject<number>;
  pointer: Pointer;
  reduced: boolean;
}) {
  const group = useRef<THREE.Group>(null);
  const activeRef = useRef(false);
  const colors = useMemo(() => gameColors(game.id), [game.id]);
  const [base, , glow] = colors;

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uPointer: { value: new THREE.Vector2(0, 0) },
      uActive: { value: 0.5 },
      uA: { value: new THREE.Color(base) },
      uB: { value: new THREE.Color('#0a0e1c') },
      uC: { value: new THREE.Color(glow) },
    }),
    [base, glow],
  );
  const zero = useMemo(() => new THREE.Vector2(0, 0), []);

  useFrame((state) => {
    const g = group.current;
    if (!g) return;
    const d = index - progress.current;
    const ad = Math.abs(d);
    g.visible = ad < 2.6;
    if (!g.visible) {
      activeRef.current = false;
      return;
    }
    const center = ad < 0.5;
    const t = state.clock.elapsedTime;

    g.position.x = d * SPACING;
    g.position.z = -Math.min(ad, 3) * 1.2;
    g.position.y = reduced ? 0 : Math.sin(t * 1.1 + index) * 0.05 * (center ? 1.5 : 0.6);

    const scale = 1 - Math.min(ad, 1) * 0.32;
    g.scale.setScalar(scale);

    let ry = -Math.sign(d) * Math.min(ad, 1) * 0.55;
    let rx = 0;
    if (center && !reduced) {
      ry += pointer.current.x * 0.38;
      rx += -pointer.current.y * 0.3;
    }
    g.rotation.set(rx, ry, 0);

    uniforms.uTime.value = t;
    uniforms.uActive.value = center ? 1 : 0.45;
    if (center) uniforms.uPointer.value.set(pointer.current.x, pointer.current.y);
    else uniforms.uPointer.value.lerp(zero, 0.08);

    activeRef.current = center && !reduced;
  });

  return (
    <group ref={group}>
      {/* soft glow halo */}
      <mesh position={[0, 0, -0.08]}>
        <planeGeometry args={[CARD_W + 0.5, CARD_H + 0.5]} />
        <meshBasicMaterial color={glow} transparent opacity={0.16} blending={THREE.AdditiveBlending} depthWrite={false} />
      </mesh>
      {/* holographic foil card */}
      <mesh>
        <planeGeometry args={[CARD_W, CARD_H, 1, 1]} />
        <shaderMaterial vertexShader={FOIL_VERT} fragmentShader={FOIL_FRAG} uniforms={uniforms} transparent />
      </mesh>
      {/* the game's hand-crafted 3D model, floating in front of the card */}
      <group position={[0, 0.35, 0.42]} scale={1.18}>
        <GameModel id={game.id} colors={colors} activeRef={activeRef as ActiveRef} />
      </group>
    </group>
  );
}

function Scene({
  games,
  progress,
  target,
  pointer,
  reduced,
  onSelect,
}: {
  games: GameDef[];
  progress: MutableRefObject<number>;
  target: MutableRefObject<number>;
  pointer: Pointer;
  reduced: boolean;
  onSelect: (i: number) => void;
}) {
  const last = useRef(-1);
  useFrame((_, dt) => {
    progress.current = THREE.MathUtils.damp(progress.current, target.current, 9, Math.min(dt, 0.05));
    const sel = Math.max(0, Math.min(games.length - 1, Math.round(progress.current)));
    if (sel !== last.current) {
      last.current = sel;
      onSelect(sel);
    }
  });
  return (
    <>
      <ambientLight intensity={0.8} />
      <directionalLight position={[3, 5, 6]} intensity={2.1} />
      <pointLight position={[-5, 2, 3]} intensity={26} color="#67e8f9" distance={26} />
      <pointLight position={[5, -2, 3]} intensity={18} color="#f472b6" distance={26} />
      {games.map((g, i) => (
        <HoloCard key={g.id} game={g} index={i} progress={progress} pointer={pointer} reduced={reduced} />
      ))}
    </>
  );
}

// ---- 2D fallback (reduced motion) — a calm horizontal card rail -------------
function Fallback2D({ games, t, nav }: { games: GameDef[]; t: TFunction; nav: NavigateFunction }) {
  return (
    <div className="h-full w-full overflow-x-auto" style={{ background: BG }}>
      <div className="flex h-full snap-x snap-mandatory items-center gap-4 px-[20vw]">
        {games.map((g) => (
          <button
            key={g.id}
            onClick={() => g.available && nav(g.route)}
            className={`flex aspect-[5/7] w-52 shrink-0 snap-center flex-col rounded-3xl bg-gradient-to-br ${g.gradient} p-5 text-left text-white shadow-elevated transition-premium active:scale-95`}
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

export default function HolographicCardSelector() {
  const { t } = useTranslation();
  const nav = useNavigate();
  const reduced = useMemo(() => prefersReducedMotion(), []);
  const games = GAMES;

  const progress = useRef(0);
  const target = useRef(0);
  const pointer = useRef({ x: 0, y: 0 });
  const drag = useRef({ active: false, startX: 0, startTarget: 0, moved: false });
  const gyro = useRef(false);
  const [selected, setSelected] = useState(0);

  // Device-tilt parallax (gyro). iOS needs a permission gesture; we try silently.
  useEffect(() => {
    if (reduced) return;
    const onTilt = (e: DeviceOrientationEvent) => {
      if (e.gamma == null || e.beta == null) return;
      gyro.current = true;
      // only feed gyro when the finger isn't driving the pointer
      if (!drag.current.active) {
        pointer.current.x = THREE.MathUtils.clamp(e.gamma / 28, -1, 1);
        pointer.current.y = THREE.MathUtils.clamp((e.beta - 45) / 28, -1, 1);
      }
    };
    window.addEventListener('deviceorientation', onTilt);
    return () => window.removeEventListener('deviceorientation', onTilt);
  }, [reduced]);

  if (reduced) return <Fallback2D games={games} t={t} nav={nav} />;

  const clampTarget = () => {
    target.current = Math.max(0, Math.min(games.length - 1, target.current));
  };
  const setPointerFromEvent = (e: React.PointerEvent, rect: DOMRect) => {
    pointer.current.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    pointer.current.y = -(((e.clientY - rect.top) / rect.height) * 2 - 1);
  };
  const onDown = (e: React.PointerEvent) => {
    drag.current = { active: true, startX: e.clientX, startTarget: target.current, moved: false };
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    // iOS 13+ gyro permission (best-effort, requires a gesture).
    const DOE = window.DeviceOrientationEvent as unknown as { requestPermission?: () => Promise<string> };
    if (!gyro.current && typeof DOE?.requestPermission === 'function') void DOE.requestPermission().catch(() => {});
  };
  const onMove = (e: React.PointerEvent) => {
    const rect = e.currentTarget.getBoundingClientRect();
    if (drag.current.active) {
      const dx = e.clientX - drag.current.startX;
      if (Math.abs(dx) > 4) drag.current.moved = true;
      target.current = drag.current.startTarget - dx * DRAG_PER_PX;
      clampTarget();
    }
    if (!gyro.current) setPointerFromEvent(e, rect); // pointer parallax on desktop
  };
  const endDrag = () => {
    if (!drag.current.active) return;
    drag.current.active = false;
    target.current = Math.round(target.current); // snap exactly one card
    clampTarget();
    if (!gyro.current) {
      pointer.current.x = 0;
      pointer.current.y = 0;
    }
  };
  const onWheel = (e: React.WheelEvent) => {
    target.current = Math.round(target.current) + Math.sign(e.deltaY);
    clampTarget();
  };
  const report = (i: number) => {
    setSelected(i);
    haptics.tick();
  };

  const game = games[selected];
  const play = () => {
    if (!drag.current.moved && game.available) nav(game.route);
  };

  return (
    <div
      className="relative h-full w-full select-none overflow-hidden"
      style={{ touchAction: 'none', background: BG }}
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={endDrag}
      onPointerLeave={endDrag}
      onPointerCancel={endDrag}
      onWheel={onWheel}
    >
      <Canvas dpr={[1, 2]} gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }} camera={{ position: [0, 0, 6.6], fov: 40 }}>
        <Suspense fallback={null}>
          <Scene games={games} progress={progress} target={target} pointer={pointer} reduced={reduced} onSelect={report} />
        </Suspense>
      </Canvas>

      {/* Hint */}
      <div className="pointer-events-none absolute inset-x-0 top-0 flex justify-center pt-4">
        <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-white/70 backdrop-blur-sm">
          {t('selector.hint', { defaultValue: 'Swipe to explore' })}
        </span>
      </div>

      {/* Name + tagline + big PLAY */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 flex flex-col items-center gap-3 px-6 pb-7">
        <AnimatePresence mode="wait">
          <motion.div
            key={selected}
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -14 }}
            transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
            className="flex flex-col items-center text-center"
          >
            <h2 className="font-display text-2xl text-white drop-shadow-lg">{t(game.nameKey)}</h2>
            <p className="mt-1 max-w-xs text-sm text-white/70">{t(game.taglineKey)}</p>
          </motion.div>
        </AnimatePresence>

        {/* progress dots */}
        <div className="flex items-center gap-1">
          {games.map((g, i) => (
            <span
              key={g.id}
              className={`h-1.5 rounded-full transition-all duration-300 ${i === selected ? 'w-5 bg-white' : 'w-1.5 bg-white/30'}`}
            />
          ))}
        </div>

        <motion.button
          onClick={play}
          disabled={!game.available}
          whileTap={game.available ? { scale: 0.95 } : undefined}
          whileHover={game.available ? { scale: 1.015 } : undefined}
          transition={{ type: 'spring', stiffness: 480, damping: 26 }}
          className={`pointer-events-auto mt-1 flex h-16 w-full max-w-xs items-center justify-center gap-2 rounded-3xl font-display text-xl uppercase tracking-[0.2em] text-white ${
            game.available ? 'bg-gradient-to-r from-primary to-accent-cyan shadow-premium' : 'cursor-not-allowed bg-white/10 tracking-wider text-white/50'
          }`}
        >
          {game.available ? (
            <>
              <span aria-hidden className="text-lg leading-none">▶</span>
              {t('selector.play', { defaultValue: 'Play' })}
            </>
          ) : (
            t('home.comingSoon')
          )}
        </motion.button>
      </div>
    </div>
  );
}
