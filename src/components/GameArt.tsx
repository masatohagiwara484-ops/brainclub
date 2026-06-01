// Lightweight inline-SVG illustrations that evoke each game. Drawn in
// `currentColor` (white on the blue cards) as simple line art — no image assets,
// so they stay crisp at any size and add ~0 KB of network cost.

type Props = { className?: string };

const base = (children: React.ReactNode, extra?: string) => (
  <svg
    viewBox="0 0 64 64"
    fill="none"
    stroke="currentColor"
    strokeWidth={3}
    strokeLinecap="round"
    strokeLinejoin="round"
    className={extra}
    aria-hidden
  >
    {children}
  </svg>
);

const ART: Record<string, (className?: string) => React.ReactNode> = {
  cube: (c) =>
    base(
      <>
        <path d="M32 6 56 19v26L32 58 8 45V19z" />
        <path d="M8 19l24 13 24-13M32 32v26" />
      </>,
      c,
    ),
  sudoku: (c) =>
    base(
      <>
        <rect x="8" y="8" width="48" height="48" rx="3" />
        <path d="M24 8v48M40 8v48M8 24h48M8 40h48" />
        <path d="M14 20h4M30 20v-4M46 36h-4" strokeWidth={4} />
      </>,
      c,
    ),
  gomoku: (c) =>
    base(
      <>
        <path d="M14 14h36M14 26h36M14 38h36M14 50h36M14 14v36M26 14v36M38 14v36M50 14v36" strokeWidth={2} opacity={0.7} />
        <circle cx="26" cy="26" r="5" fill="currentColor" stroke="none" />
        <circle cx="38" cy="38" r="5" fill="currentColor" stroke="none" />
        <circle cx="38" cy="26" r="5" />
      </>,
      c,
    ),
  wordle: (c) =>
    base(
      <>
        <rect x="8" y="20" width="14" height="14" rx="2" />
        <rect x="25" y="20" width="14" height="14" rx="2" fill="currentColor" stroke="none" />
        <rect x="42" y="20" width="14" height="14" rx="2" />
        <rect x="16.5" y="38" width="14" height="14" rx="2" />
        <rect x="33.5" y="38" width="14" height="14" rx="2" />
      </>,
      c,
    ),
  solitaire: (c) =>
    base(
      <>
        <rect x="10" y="16" width="24" height="34" rx="3" transform="rotate(-10 22 33)" />
        <rect x="28" y="14" width="24" height="34" rx="3" transform="rotate(8 40 31)" />
        <path d="M40 24c-3-4-8 0-4 4l4 4 4-4c4-4-1-8-4-4z" fill="currentColor" stroke="none" />
      </>,
      c,
    ),
  watersort: (c) =>
    base(
      <>
        <path d="M20 8v40a8 8 0 0 0 16 0V8" />
        <path d="M16 8h24" />
        <path d="M20 30h16M20 40h16" strokeWidth={2} opacity={0.8} />
        <path d="M44 20v28a6 6 0 0 0 12 0V20" />
        <path d="M41 20h18" />
      </>,
      c,
    ),
  chess: (c) =>
    base(
      <>
        <path d="M32 12a6 6 0 0 1 6 6c0 3-2 4-2 7l4 14H24l4-14c0-3-2-4-2-7a6 6 0 0 1 6-6z" />
        <path d="M20 52h24M22 44h20" />
      </>,
      c,
    ),
  memory: (c) =>
    base(
      <>
        <rect x="9" y="14" width="20" height="28" rx="3" transform="rotate(-6 19 28)" />
        <rect x="34" y="20" width="20" height="28" rx="3" transform="rotate(6 44 34)" />
        <path d="M44 30l1.6 3.4 3.7.4-2.8 2.5.8 3.6-3.3-1.9-3.3 1.9.8-3.6-2.8-2.5 3.7-.4z" fill="currentColor" stroke="none" />
      </>,
      c,
    ),
};

export default function GameArt({ id, className }: Props & { id: string }) {
  const render = ART[id] ?? ART.cube;
  return <>{render(className)}</>;
}
