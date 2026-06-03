// The single, app-wide visual FX surface. Mounted exactly once (inside the
// Layout's relative <main>). It subscribes to the tiny fx event bus and paints
// three kinds of screen-level juice WITHOUT any library or <canvas>:
//   • confetti — a burst of transform-only <span> pieces (count scales with
//     intensity AND the theme token --confetti-count-scale), auto-removed
//   • flash    — a full-bleed tint that fades out (color comes from fx/theme)
//   • shake    — a brief shake class applied to the play area
//
// All layers are pointer-events-none + aria-hidden (purely decorative).
// Reduced-motion is already filtered upstream in fx.ts, so anything that
// arrives here is meant to be shown. Audio is armed on the first pointerdown
// (browsers require a gesture before an AudioContext can make sound).

import { useEffect, useRef, useState } from 'react';
import { subscribeFx } from '../lib/fx';
import type { FxEvent } from '../lib/fx';
import { sound } from '../lib/sound';

type ConfettiBurst = {
  id: number;
  pieces: { x: number; y: number; rot: number; hue: number; delay: number }[];
};
type Flash = { id: number; color: string };

const CONFETTI_COLORS = [
  'var(--fx-accent, #f59e0b)',
  '#ef4444',
  '#3b82f6',
  '#22c55e',
  '#a855f7',
  '#ec4899',
];

// Read the theme's confetti scale (Zen dials it down, Arcade up). Falls back to 1.
function confettiScale(): number {
  if (typeof window === 'undefined') return 1;
  const raw = getComputedStyle(document.documentElement).getPropertyValue('--confetti-count-scale');
  const n = parseFloat(raw);
  return Number.isFinite(n) && n > 0 ? n : 1;
}

export default function FxLayer() {
  const [bursts, setBursts] = useState<ConfettiBurst[]>([]);
  const [flashes, setFlashes] = useState<Flash[]>([]);
  const [shakeKey, setShakeKey] = useState(0);
  const [shakeStrength, setShakeStrength] = useState<'sm' | 'md'>('md');
  const idRef = useRef(0);
  const rootRef = useRef<HTMLDivElement | null>(null);

  // Arm audio on the very first user gesture, then stop listening.
  useEffect(() => {
    const arm = () => sound.unlock();
    window.addEventListener('pointerdown', arm, { once: true });
    window.addEventListener('keydown', arm, { once: true });
    return () => {
      window.removeEventListener('pointerdown', arm);
      window.removeEventListener('keydown', arm);
    };
  }, []);

  useEffect(() => {
    const unsub = subscribeFx((e: FxEvent) => {
      const id = ++idRef.current;
      if (e.kind === 'confetti') {
        const base = Math.round(26 * Math.max(0.1, e.intensity) * confettiScale());
        const count = Math.min(Math.max(base, 6), 40);
        const pieces = Array.from({ length: count }, () => ({
          x: (Math.random() * 2 - 1) * 55, // vw spread from center
          y: 60 + Math.random() * 35, // fall distance (vh)
          rot: (Math.random() * 2 - 1) * 720,
          hue: Math.floor(Math.random() * CONFETTI_COLORS.length),
          delay: Math.random() * 120,
        }));
        setBursts((b) => [...b, { id, pieces }]);
        window.setTimeout(() => {
          setBursts((b) => b.filter((x) => x.id !== id));
        }, 1300);
      } else if (e.kind === 'flash') {
        setFlashes((f) => [...f, { id, color: e.color }]);
        window.setTimeout(() => {
          setFlashes((f) => f.filter((x) => x.id !== id));
        }, 420);
      } else if (e.kind === 'shake') {
        setShakeStrength(e.strength);
        setShakeKey(id); // changing key retriggers the CSS animation
        window.setTimeout(() => {
          setShakeKey((k) => (k === id ? 0 : k));
        }, 460);
      }
    });
    return unsub;
  }, []);

  return (
    <div
      ref={rootRef}
      aria-hidden
      className={`pointer-events-none absolute inset-0 z-30 overflow-hidden ${
        shakeKey ? (shakeStrength === 'sm' ? 'fx-shake-sm' : 'fx-shake-md') : ''
      }`}
      key={shakeKey}
    >
      {flashes.map((f) => (
        <div
          key={f.id}
          className="fx-flash absolute inset-0"
          style={{ ['--flash-color' as string]: f.color }}
        />
      ))}

      {bursts.map((burst) => (
        <div key={burst.id} className="absolute inset-0">
          {burst.pieces.map((p, i) => (
            <span
              key={i}
              className="fx-confetti-piece absolute left-1/2 top-[38%] block h-2.5 w-2 rounded-[2px]"
              style={{
                background: CONFETTI_COLORS[p.hue],
                ['--x' as string]: `${p.x}vw`,
                ['--y' as string]: `${p.y}vh`,
                ['--rot' as string]: `${p.rot}deg`,
                animationDelay: `${p.delay}ms`,
              }}
            />
          ))}
        </div>
      ))}
    </div>
  );
}
