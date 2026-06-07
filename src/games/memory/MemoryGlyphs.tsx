import type { ReactNode } from 'react';

// ============================================================
// MemoryGlyphs — 12 original, emoji-free card faces for Memory Match.
// ============================================================
// Each is a distinct neon geometric glyph (unique shape + hue) so pairs are
// easy to tell apart at a glance, and they glow on the dark card surface to fit
// the premium theme. Pure inline SVG — zero assets, crisp at any size.

type Glyph = { color: string; node: ReactNode };

// Shapes are drawn in a 48×48 viewBox, filled with the glyph's hue.
const GLYPHS: Glyph[] = [
  { color: '#67e8f9', node: <path d="M24 7 L41 39 L7 39 Z" /> }, // triangle
  { color: '#818cf8', node: <path d="M24 5 L40 15 L40 33 L24 43 L8 33 L8 15 Z" /> }, // hexagon
  { color: '#f472b6', node: <path d="M24 5 C37 22 34 41 24 41 C14 41 11 22 24 5 Z" /> }, // droplet
  {
    color: '#fbbf24',
    node: <path d="M24 5 L29 18 L43 19 L32 28 L36 42 L24 34 L12 42 L16 28 L5 19 L19 18 Z" />,
  }, // star
  { color: '#34d399', node: <path d="M24 5 L41 24 L24 43 L7 24 Z" /> }, // diamond
  { color: '#a78bfa', node: <circle cx="24" cy="24" r="15" fill="none" stroke="#a78bfa" strokeWidth="6" /> }, // ring
  { color: '#fb7185', node: <rect x="9" y="9" width="30" height="30" rx="5" /> }, // square
  {
    color: '#facc15',
    node: <path d="M27 5 L12 27 L22 27 L19 43 L36 20 L25 20 Z" />,
  }, // lightning bolt
  { color: '#38bdf8', node: <path d="M31 7 A17 17 0 1 0 31 41 A13 13 0 1 1 31 7 Z" /> }, // crescent
  {
    color: '#2dd4bf',
    node: <path d="M19 7 H29 V19 H41 V29 H29 V41 H19 V29 H7 V19 H19 Z" />,
  }, // plus
  { color: '#fb923c', node: <path d="M7 18 L24 31 L41 18 L41 27 L24 40 L7 27 Z" /> }, // chevron
  {
    color: '#e879f9',
    node: <path d="M24 4 L28 20 L44 24 L28 28 L24 44 L20 28 L4 24 L20 20 Z" />,
  }, // sparkle
];

export const GLYPH_COUNT = GLYPHS.length;

export default function MemoryGlyph({ index, className }: { index: number; className?: string }) {
  const g = GLYPHS[index % GLYPHS.length];
  return (
    <svg
      viewBox="0 0 48 48"
      className={className}
      fill={g.color}
      aria-hidden="true"
      style={{ filter: `drop-shadow(0 0 8px ${g.color}99)` }}
    >
      {g.node}
    </svg>
  );
}
