import { useMemo } from 'react';
import { prefersReducedMotion } from '../lib/fx';

// Lightweight, CSS-only "brain field" backdrop for the Home hero. It paints
// instantly — no JS animation loop, no bundle weight — so the app *feels* like a
// brain-game the moment it opens: faint floating brain/puzzle glyphs drift over
// soft indigo/cyan/pink orbs and the shared synapse dot-grid. Everything is
// transform/opacity only and fully suppressed under reduced-motion. It sits
// behind the 3D selector (whose <canvas> is alpha-transparent) so the scene
// reads as one cohesive, premium space rather than a flat panel.

type Glyph = {
  ch: string;
  left: string;
  top: string;
  size: number;
  dur: number;
  delay: number;
  rot: number;
  opacity: number;
};

// Hand-placed so nothing clusters or sits dead-center over the active model.
const GLYPHS: Glyph[] = [
  { ch: '🧠', left: '9%', top: '15%', size: 40, dur: 9, delay: 0, rot: -8, opacity: 0.16 },
  { ch: '🧩', left: '80%', top: '19%', size: 32, dur: 11, delay: 1.4, rot: 10, opacity: 0.15 },
  { ch: '⚡', left: '69%', top: '57%', size: 26, dur: 8, delay: 0.6, rot: -4, opacity: 0.13 },
  { ch: '🎯', left: '17%', top: '64%', size: 30, dur: 12, delay: 2.1, rot: 6, opacity: 0.13 },
  { ch: '♟️', left: '88%', top: '72%', size: 24, dur: 10, delay: 1, rot: -10, opacity: 0.12 },
  { ch: '◆', left: '45%', top: '9%', size: 16, dur: 13, delay: 0.3, rot: 0, opacity: 0.18 },
  { ch: '✦', left: '29%', top: '37%', size: 14, dur: 7, delay: 1.8, rot: 0, opacity: 0.24 },
  { ch: '✦', left: '63%', top: '31%', size: 12, dur: 9, delay: 0.9, rot: 0, opacity: 0.2 },
];

type Orb = { left: string; top: string; size: number; color: string; dur: number; ox: string; oy: string };

const ORBS: Orb[] = [
  { left: '-10%', top: '4%', size: 300, color: 'rgba(99,102,241,0.32)', dur: 17, ox: '24px', oy: '18px' },
  { left: '62%', top: '-8%', size: 280, color: 'rgba(103,232,249,0.22)', dur: 21, ox: '-20px', oy: '26px' },
  { left: '38%', top: '56%', size: 340, color: 'rgba(244,114,182,0.18)', dur: 24, ox: '18px', oy: '-22px' },
];

export default function BrainFieldBg() {
  const reduced = useMemo(() => prefersReducedMotion(), []);

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      {/* Synapse dot-grid + soft diagonal — reuses the shared neural utility. */}
      <div className={`absolute inset-0 bg-neural opacity-70 ${reduced ? '' : 'bg-neural-animated'}`} />

      {/* Soft drifting color orbs give the space depth and life. */}
      {ORBS.map((o, i) => (
        <div
          key={`orb${i}`}
          className={reduced ? '' : 'hero-orb'}
          style={{
            position: 'absolute',
            left: o.left,
            top: o.top,
            width: o.size,
            height: o.size,
            borderRadius: '9999px',
            background: `radial-gradient(circle, ${o.color} 0%, transparent 70%)`,
            filter: 'blur(8px)',
            ['--dur' as string]: `${o.dur}s`,
            ['--ox' as string]: o.ox,
            ['--oy' as string]: o.oy,
          }}
        />
      ))}

      {/* Floating brain / puzzle glyphs. */}
      {GLYPHS.map((g, i) => (
        <span
          key={`g${i}`}
          className={reduced ? '' : 'hero-float'}
          style={{
            position: 'absolute',
            left: g.left,
            top: g.top,
            fontSize: g.size,
            opacity: g.opacity,
            lineHeight: 1,
            filter: 'drop-shadow(0 4px 12px rgba(0,0,0,0.45))',
            ['--dur' as string]: `${g.dur}s`,
            ['--delay' as string]: `${g.delay}s`,
            ['--rot' as string]: `${g.rot}deg`,
          }}
        >
          {g.ch}
        </span>
      ))}
    </div>
  );
}
