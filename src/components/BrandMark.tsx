import { useId } from 'react';

// ============================================================
// BrandMark — the BrainClub identity (emoji-free, original SVG)
// ============================================================
// A custom "synapse monogram": the letter B drawn as a neural circuit
// (gradient strokes + node junctions) with a few synapse sparks firing in
// from outside — the brand metaphor of information being fed into the brain.
// Paired with a tight, two-weight uppercase wordmark for an editorial-yet-
// modern lockup. One source of truth for the header, the splash, and anywhere
// else the brand appears. `animated` opts into the splash draw-on choreography
// (the keyframes are scoped under `.bc-splash` in styles/index.css).

// Circuit junctions on the B. Kept few so the glyph reads at header size.
const NODES: [number, number][] = [
  [20, 14], // spine top
  [20, 32], // spine middle
  [20, 50], // spine bottom
  [33, 32], // bowl join
  [44, 23], // upper bowl apex
  [47, 41], // lower bowl apex
];

export function BrandGlyph({
  className,
  animated = false,
}: {
  className?: string;
  animated?: boolean;
}) {
  // Unique gradient id per instance so multiple glyphs (header + splash) don't
  // collide on the same id.
  const uid = useId().replace(/[:]/g, '');
  const gid = `bc-grad-${uid}`;

  return (
    <svg viewBox="0 0 64 64" className={className} fill="none" aria-hidden="true">
      <defs>
        <linearGradient id={gid} x1="6" y1="6" x2="58" y2="58" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#818cf8" />
          <stop offset="0.5" stopColor="#67e8f9" />
          <stop offset="1" stopColor="#f472b6" />
        </linearGradient>
      </defs>

      {/* synapse sparks — signals firing into the brain */}
      <g
        className={animated ? 'bc-spark' : undefined}
        stroke={`url(#${gid})`}
        strokeWidth="2"
        strokeLinecap="round"
      >
        <line x1="44" y1="23" x2="57" y2="14" />
        <line x1="47" y1="41" x2="59" y2="49" />
        <line x1="20" y1="32" x2="7" y2="29" />
      </g>
      <g className={animated ? 'bc-spark' : undefined} fill={`url(#${gid})`}>
        <circle cx="57" cy="14" r="2" />
        <circle cx="59" cy="49" r="2" />
        <circle cx="7" cy="29" r="2" />
      </g>

      {/* the B, drawn as a neural circuit (stroke-only so it can "draw on") */}
      <g
        className={animated ? 'bc-draw' : undefined}
        stroke={`url(#${gid})`}
        strokeWidth="3.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path pathLength={1} d="M20 14 V50" />
        <path pathLength={1} d="M20 14 H33 C41 14 44 18 44 23 C44 28 41 32 33 32 H20" />
        <path pathLength={1} d="M20 32 H36 C44 32 47 37 47 41 C47 46 44 50 36 50 H20" />
      </g>

      {/* node junctions */}
      <g className={animated ? 'bc-node' : undefined}>
        {NODES.map(([x, y]) => (
          <circle key={`${x}-${y}`} cx={x} cy={y} r="2.7" fill="#0b1020" stroke={`url(#${gid})`} strokeWidth="1.8" />
        ))}
      </g>
    </svg>
  );
}

// The wordmark: uppercase, wide-tracked, with a weight contrast (heavy "BRAIN"
// + light "CLUB") for a refined, premium feel. Defaults to light-on-dark to
// match the app's dark chrome; pass a text color via `className` to override.
export function BrandWordmark({ className }: { className?: string }) {
  return (
    <span className={`bc-wordmark ${className ?? ''}`}>
      <span className="bc-wordmark-strong">Brain</span>
      <span className="bc-wordmark-light">Club</span>
    </span>
  );
}

// Glyph + wordmark, horizontally locked up — the standard header/brand unit.
export function BrandLockup({
  className,
  glyphClassName = 'h-7 w-7',
  wordmarkClassName,
}: {
  className?: string;
  glyphClassName?: string;
  wordmarkClassName?: string;
}) {
  return (
    <span className={`inline-flex items-center gap-2 ${className ?? ''}`}>
      <BrandGlyph className={glyphClassName} />
      <BrandWordmark className={wordmarkClassName} />
    </span>
  );
}
