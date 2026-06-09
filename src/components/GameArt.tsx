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
  hex: (c) =>
    base(
      <>
        {/* three honeycomb cells, the middle one filled — a connecting path */}
        <path d="M29 32 24.5 39.8 15.5 39.8 11 32 15.5 24.2 24.5 24.2Z" strokeWidth={2.5} />
        <path d="M42.5 24 38 31.8 29 31.8 24.5 24 29 16.2 38 16.2Z" fill="currentColor" stroke="none" />
        <path d="M56 32 51.5 39.8 42.5 39.8 38 32 42.5 24.2 51.5 24.2Z" strokeWidth={2.5} />
      </>,
      c,
    ),
  ludo: (c) =>
    base(
      <>
        {/* the cross board + a central home and two tokens */}
        <path d="M24 8h16v16h16v16H40v16H24V40H8V24h16z" strokeWidth={2.5} />
        <circle cx="32" cy="32" r="5" fill="currentColor" stroke="none" />
        <circle cx="20" cy="20" r="2.6" fill="currentColor" stroke="none" />
        <circle cx="44" cy="44" r="2.6" fill="currentColor" stroke="none" />
      </>,
      c,
    ),
  yacht: (c) =>
    base(
      <>
        {/* two dice */}
        <rect x="8" y="14" width="30" height="30" rx="6" strokeWidth={2.5} />
        <circle cx="16" cy="22" r="2.6" fill="currentColor" stroke="none" />
        <circle cx="23" cy="29" r="2.6" fill="currentColor" stroke="none" />
        <circle cx="30" cy="36" r="2.6" fill="currentColor" stroke="none" />
        <rect x="34" y="32" width="22" height="22" rx="5" strokeWidth={2.5} />
        <circle cx="40" cy="38" r="2.1" fill="currentColor" stroke="none" />
        <circle cx="50" cy="48" r="2.1" fill="currentColor" stroke="none" />
      </>,
      c,
    ),
  blackjack: (c) =>
    base(
      <>
        {/* two cards + a chip */}
        <rect x="12" y="18" width="20" height="30" rx="3" transform="rotate(-14 22 33)" strokeWidth={2.5} />
        <rect x="24" y="16" width="20" height="30" rx="3" transform="rotate(4 34 31)" strokeWidth={2.5} />
        <circle cx="46" cy="44" r="9" strokeWidth={2.5} />
        <circle cx="46" cy="44" r="3.5" fill="currentColor" stroke="none" />
      </>,
      c,
    ),
  poker: (c) =>
    base(
      <>
        {/* a four-card fan */}
        <rect x="10" y="22" width="16" height="24" rx="2.5" transform="rotate(-18 18 34)" strokeWidth={2.5} />
        <rect x="20" y="20" width="16" height="24" rx="2.5" transform="rotate(-6 28 32)" strokeWidth={2.5} />
        <rect x="30" y="20" width="16" height="24" rx="2.5" transform="rotate(6 38 32)" strokeWidth={2.5} />
        <rect x="40" y="22" width="16" height="24" rx="2.5" transform="rotate(18 48 34)" strokeWidth={2.5} />
      </>,
      c,
    ),
  tetris: (c) =>
    base(
      <>
        {/* a T tetromino + two loose blocks */}
        <rect x="14" y="14" width="12" height="12" rx="1.5" strokeWidth={2.5} />
        <rect x="26" y="14" width="12" height="12" rx="1.5" strokeWidth={2.5} />
        <rect x="38" y="14" width="12" height="12" rx="1.5" strokeWidth={2.5} />
        <rect x="26" y="26" width="12" height="12" rx="1.5" strokeWidth={2.5} />
        <rect x="14" y="40" width="12" height="12" rx="1.5" fill="currentColor" stroke="none" />
        <rect x="38" y="40" width="12" height="12" rx="1.5" fill="currentColor" stroke="none" />
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
  colorclash: (c) =>
    base(
      <>
        <circle cx="32" cy="32" r="22" />
        <path d="M32 10a22 22 0 0 1 0 44" fill="currentColor" stroke="none" opacity={0.25} />
        <circle cx="24" cy="26" r="3.5" fill="currentColor" stroke="none" />
        <circle cx="40" cy="26" r="3.5" />
        <path d="M24 42c3 3 13 3 16 0" />
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
  reaction: (c) =>
    base(<path d="M36 6 16 36h13l-3 22 22-32H33l3-20z" fill="currentColor" stroke="none" />, c),
  simon: (c) =>
    base(
      <>
        <circle cx="32" cy="32" r="22" />
        <path d="M32 10v44M10 32h44" />
        <path d="M22 22a14 14 0 0 1 4-4" strokeWidth={5} />
      </>,
      c,
    ),
  memorygrid: (c) =>
    base(
      <>
        <rect x="10" y="10" width="44" height="44" rx="4" />
        <path d="M24 10v44M40 10v44M10 24h44M10 40h44" strokeWidth={2} opacity={0.6} />
        <rect x="12.5" y="12.5" width="9" height="9" rx="1.5" fill="currentColor" stroke="none" />
        <rect x="42.5" y="26.5" width="9" height="9" rx="1.5" fill="currentColor" stroke="none" />
        <rect x="27.5" y="42.5" width="9" height="9" rx="1.5" fill="currentColor" stroke="none" />
      </>,
      c,
    ),
  whack: (c) =>
    base(
      <>
        <path d="M14 50c0-12 8-20 18-20s18 8 18 20" />
        <ellipse cx="14" cy="50" rx="8" ry="4" />
        <ellipse cx="50" cy="50" rx="8" ry="4" />
        <circle cx="26" cy="40" r="2.5" fill="currentColor" stroke="none" />
        <circle cx="38" cy="40" r="2.5" fill="currentColor" stroke="none" />
      </>,
      c,
    ),
  schulte: (c) =>
    base(
      <>
        <rect x="10" y="10" width="44" height="44" rx="4" />
        <path d="M25 10v44M39 10v44M10 25h44M10 39h44" strokeWidth={2} opacity={0.6} />
        <path d="M16 20h3M44 33h3M30 47h4" strokeWidth={4} />
      </>,
      c,
    ),
  '2048': (c) =>
    base(
      <>
        <rect x="10" y="10" width="20" height="20" rx="3" />
        <rect x="34" y="10" width="20" height="20" rx="3" fill="currentColor" stroke="none" />
        <rect x="10" y="34" width="20" height="20" rx="3" fill="currentColor" stroke="none" />
        <rect x="34" y="34" width="20" height="20" rx="3" />
      </>,
      c,
    ),
  slide: (c) =>
    base(
      <>
        <rect x="10" y="10" width="44" height="44" rx="4" />
        <path d="M24 10v44M40 10v44M10 24h44M10 40h44" strokeWidth={2} opacity={0.6} />
        <path d="M44 32H28m0 0 6-6m-6 6 6 6" strokeWidth={3} />
      </>,
      c,
    ),
  lightsout: (c) =>
    base(
      <>
        <path d="M32 8a16 16 0 0 0-9 29c2 1.5 3 3 3 6h12c0-3 1-4.5 3-6a16 16 0 0 0-9-29z" />
        <path d="M26 52h12M28 57h8" />
      </>,
      c,
    ),
  mastermind: (c) =>
    base(
      <>
        <circle cx="18" cy="22" r="7" fill="currentColor" stroke="none" />
        <circle cx="38" cy="22" r="7" />
        <circle cx="18" cy="44" r="7" />
        <circle cx="38" cy="44" r="7" fill="currentColor" stroke="none" />
        <circle cx="54" cy="22" r="2.5" fill="currentColor" stroke="none" />
        <circle cx="54" cy="30" r="2.5" fill="currentColor" stroke="none" />
      </>,
      c,
    ),
  minesweeper: (c) =>
    base(
      <>
        <circle cx="30" cy="36" r="16" fill="currentColor" stroke="none" />
        <path d="M30 20V8M30 8l6 4M30 8l-6 4M14 36H8M52 36h-6M19 25l-4-4M45 25l4-4" />
      </>,
      c,
    ),
  flood: (c) =>
    base(
      <>
        <path d="M32 8C22 22 16 30 16 40a16 16 0 0 0 32 0c0-10-6-18-16-32z" />
        <path d="M24 42c2 4 6 6 10 5" strokeWidth={2.5} />
      </>,
      c,
    ),
  pegsolitaire: (c) =>
    base(
      <>
        <path d="M24 10h16v14h14v16H40v14H24V40H10V24h14z" strokeWidth={2.5} />
        <circle cx="32" cy="32" r="3.2" fill="currentColor" stroke="none" />
        <circle cx="32" cy="17" r="3.2" fill="currentColor" stroke="none" />
        <circle cx="32" cy="47" r="3.2" fill="currentColor" stroke="none" />
        <circle cx="17" cy="32" r="3.2" fill="currentColor" stroke="none" />
        <circle cx="47" cy="32" r="3.2" fill="currentColor" stroke="none" />
      </>,
      c,
    ),
};

export default function GameArt({ id, className }: Props & { id: string }) {
  const render = ART[id] ?? ART.cube;
  return <>{render(className)}</>;
}
