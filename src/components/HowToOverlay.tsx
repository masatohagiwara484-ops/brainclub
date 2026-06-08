// Textless gesture tutorial (Mission 9).
//
// A purely visual "how to play": an animated finger 👆 demonstrates each game's
// core gesture on a schematic mini-board, looping forever. No instructional text
// at all — so it needs zero translation and reads for kids and every language.
// Three gesture archetypes cover all seven games:
//   • tap1  — tap one target            (gomoku, colorclash, wordle)
//   • tap2  — tap a source, then a target (sudoku, solitaire, watersort)
//   • swipe — press and drag             (cube)
// Each game's scene is just data: schematic board pieces, where the finger goes,
// and what "result" appears after the gesture. The finger path is driven by CSS
// vars (--ax/--ay/--bx/--by) feeding the ht-* keyframes in index.css. Under
// prefers-reduced-motion those keyframes are disabled and the scene degrades to a
// readable static diagram (finger parked on the first target, results visible).

import { lazy, Suspense, type ReactNode, type CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import { useHowto } from '../lib/howto';
import { getGame } from '../games/registry';
import { VISUAL_TUTORIAL_GAMES } from './visualTutorialGames';

// The premium 3D (Three.js) tutorials are lazy-loaded so three stays out of the
// main bundle — it only loads when a game that has one actually opens its
// tutorial. Games without a 3D scene keep the instant 2D gesture diagram below.
const VisualTutorial = lazy(() => import('./VisualTutorial'));

const W = 240;
const H = 180;

type Pt = { x: number; y: number };
type Piece = {
  x: number;
  y: number;
  w: number;
  h: number;
  cls?: string;
  round?: boolean;
  label?: ReactNode;
};
type Reveal = Piece & { timing: 'late' | 'early'; delay?: number };
type Pulse = { x: number; y: number; size?: number; delay?: number };
type Finger = { mode: 'tap1' | 'tap2' | 'swipe'; a: Pt; b?: Pt };
type Scene = { board: Piece[]; reveals?: Reveal[]; pulses?: Pulse[]; finger: Finger };

// ---- Scene catalog (one per playable game) ------------------------------------

const CUBE_COLORS = ['#ef4444', '#f59e0b', '#22c55e', '#3b82f6', '#a855f7', '#ec4899', '#14b8a6', '#eab308', '#f97316'];

const SCENES: Record<string, Scene> = {
  // Drag across a face to turn a layer.
  cube: {
    board: [
      ...[55, 85, 115].flatMap((y, r) =>
        [90, 120, 150].map((x, c) => ({
          x,
          y,
          w: 28,
          h: 28,
          cls: '',
          label: <span style={{ background: CUBE_COLORS[r * 3 + c] }} className="block h-full w-full rounded" />,
        })),
      ),
      { x: 120, y: 145, w: 90, h: 22, cls: 'text-slate-400 text-lg', label: '↔' },
    ],
    pulses: [{ x: 72, y: 85 }],
    finger: { mode: 'swipe', a: { x: 72, y: 85 }, b: { x: 168, y: 85 } },
  },

  // Tap an empty cell, then tap a number.
  sudoku: {
    board: [
      ...[35, 63, 91].flatMap((y) =>
        [70, 100, 130].map((x) => ({ x, y, w: 26, h: 26, cls: 'border border-slate-300 bg-white' })),
      ),
      { x: 100, y: 35, w: 26, h: 26, cls: 'text-slate-300 font-bold', label: '3' },
      { x: 130, y: 63, w: 26, h: 26, cls: 'text-slate-300 font-bold', label: '7' },
      { x: 70, y: 91, w: 26, h: 26, cls: 'text-slate-300 font-bold', label: '1' },
      ...[['4', 80], ['5', 120], ['6', 160]].map(([n, x]) => ({
        x: x as number,
        y: 150,
        w: 30,
        h: 30,
        round: true,
        cls: 'bg-slate-100 text-slate-600 font-bold',
        label: n as string,
      })),
    ],
    reveals: [{ x: 70, y: 35, w: 26, h: 26, cls: 'text-brand font-bold text-lg', label: '5', timing: 'late' }],
    pulses: [{ x: 70, y: 35 }, { x: 120, y: 150, delay: 1.6 }],
    finger: { mode: 'tap2', a: { x: 70, y: 35 }, b: { x: 120, y: 150 } },
  },

  // Guess a word; tiles flip to green / yellow / gray.
  wordle: {
    board: [
      ...[66, 98, 130, 162].map((x) => ({ x, y: 50, w: 26, h: 26, cls: 'border-2 border-slate-300 bg-white' })),
      ...[70, 110, 150].map((x) => ({ x, y: 138, w: 26, h: 20, cls: 'bg-slate-200', round: false })),
    ],
    reveals: [
      { x: 66, y: 50, w: 26, h: 26, cls: 'bg-[#22c55e]', timing: 'late', delay: 0 },
      { x: 98, y: 50, w: 26, h: 26, cls: 'bg-[#94a3b8]', timing: 'late', delay: 0.18 },
      { x: 130, y: 50, w: 26, h: 26, cls: 'bg-[#eab308]', timing: 'late', delay: 0.36 },
      { x: 162, y: 50, w: 26, h: 26, cls: 'bg-[#22c55e]', timing: 'late', delay: 0.54 },
    ],
    pulses: [{ x: 110, y: 138 }],
    finger: { mode: 'tap1', a: { x: 110, y: 138 } },
  },

  // Tap a card, then tap where it goes.
  solitaire: {
    board: [
      { x: 66, y: 80, w: 40, h: 54, cls: 'border border-slate-300 bg-white text-rose-500 text-xl', label: '♥' },
      { x: 174, y: 80, w: 40, h: 54, cls: 'border-2 border-dashed border-slate-300 bg-slate-50' },
    ],
    reveals: [
      { x: 174, y: 80, w: 40, h: 54, cls: 'border border-slate-300 bg-white text-rose-500 text-xl', label: '♥', timing: 'late' },
    ],
    pulses: [{ x: 66, y: 80 }, { x: 174, y: 80, delay: 1.6 }],
    finger: { mode: 'tap2', a: { x: 66, y: 80 }, b: { x: 174, y: 80 } },
  },

  // Tap a tube, then another, to pour the matching top color.
  watersort: {
    board: [
      { x: 90, y: 95, w: 30, h: 100, cls: 'border-2 border-slate-300 bg-white rounded-b-2xl' },
      { x: 160, y: 95, w: 30, h: 100, cls: 'border-2 border-slate-300 bg-white rounded-b-2xl' },
      { x: 90, y: 60, w: 22, h: 26, cls: 'bg-[#ef4444]' },
      { x: 90, y: 88, w: 22, h: 26, cls: 'bg-[#3b82f6]' },
      { x: 90, y: 116, w: 22, h: 26, cls: 'bg-[#3b82f6] rounded-b-xl' },
      { x: 160, y: 88, w: 22, h: 26, cls: 'bg-[#ef4444]' },
      { x: 160, y: 116, w: 22, h: 26, cls: 'bg-[#ef4444] rounded-b-xl' },
    ],
    reveals: [{ x: 160, y: 60, w: 22, h: 26, cls: 'bg-[#ef4444]', timing: 'late' }],
    pulses: [{ x: 90, y: 55 }, { x: 160, y: 55, delay: 1.6 }],
    finger: { mode: 'tap2', a: { x: 90, y: 55 }, b: { x: 160, y: 55 } },
  },

  // Tap an intersection to place a stone (five in a row wins).
  gomoku: {
    board: [
      ...[80, 110, 140].map((x) => ({ x, y: 85, w: 2, h: 64, cls: 'bg-slate-300' })),
      ...[55, 85, 115].map((y) => ({ x: 110, y, w: 64, h: 2, cls: 'bg-slate-300' })),
      { x: 80, y: 85, w: 18, h: 18, round: true, cls: 'bg-slate-800' },
      { x: 140, y: 85, w: 18, h: 18, round: true, cls: 'bg-slate-800' },
      { x: 110, y: 55, w: 18, h: 18, round: true, cls: 'bg-white border border-slate-400' },
      { x: 110, y: 115, w: 18, h: 18, round: true, cls: 'bg-white border border-slate-400' },
    ],
    reveals: [{ x: 110, y: 85, w: 18, h: 18, round: true, cls: 'bg-slate-800', timing: 'early' }],
    pulses: [{ x: 110, y: 85 }],
    finger: { mode: 'tap1', a: { x: 110, y: 85 } },
  },

  // Tap empty cells to build a chain linking your two (cyan) edges, top to bottom.
  hex: {
    board: [
      { x: 120, y: 40, w: 96, h: 6, cls: 'bg-[#22d3ee]' },
      { x: 150, y: 140, w: 96, h: 6, cls: 'bg-[#22d3ee]' },
      ...[
        [90, 62],
        [120, 62],
        [150, 62],
        [105, 91],
        [135, 91],
        [165, 91],
        [120, 120],
        [150, 120],
        [180, 120],
      ].map(([x, y]) => ({ x, y, w: 24, h: 24, round: true, cls: 'bg-slate-200' })),
    ],
    reveals: [
      { x: 120, y: 62, w: 24, h: 24, round: true, cls: 'bg-[#22d3ee]', timing: 'early' },
      { x: 135, y: 91, w: 24, h: 24, round: true, cls: 'bg-[#22d3ee]', timing: 'early', delay: 0.2 },
      { x: 150, y: 120, w: 24, h: 24, round: true, cls: 'bg-[#22d3ee]', timing: 'early', delay: 0.4 },
    ],
    pulses: [{ x: 135, y: 91 }],
    finger: { mode: 'tap1', a: { x: 135, y: 91 } },
  },

  // Swipe to merge matching tiles (2048).
  '2048': {
    board: [
      { x: 70, y: 80, w: 40, h: 40, cls: 'bg-[#eee4da] text-[#776e65] text-xl font-bold', label: '2' },
      { x: 120, y: 80, w: 40, h: 40, cls: 'bg-[#eee4da] text-[#776e65] text-xl font-bold', label: '2' },
      { x: 170, y: 80, w: 40, h: 40, cls: 'bg-slate-200' },
      { x: 120, y: 140, w: 80, h: 22, cls: 'text-slate-400 text-lg', label: '→' },
    ],
    reveals: [{ x: 170, y: 80, w: 40, h: 40, cls: 'bg-[#f2b179] text-white text-xl font-bold', label: '4', timing: 'late' }],
    pulses: [{ x: 60, y: 80 }],
    finger: { mode: 'swipe', a: { x: 55, y: 80 }, b: { x: 175, y: 80 } },
  },

  // Tap the button that matches the INK (fill), not the marks (word color).
  colorclash: {
    board: [
      { x: 120, y: 52, w: 84, h: 38, cls: 'bg-[#22c55e]' },
      { x: 106, y: 46, w: 18, h: 3, cls: 'bg-[#ef4444]' },
      { x: 122, y: 52, w: 18, h: 3, cls: 'bg-[#ef4444]' },
      { x: 110, y: 58, w: 18, h: 3, cls: 'bg-[#ef4444]' },
      { x: 70, y: 132, w: 42, h: 42, round: true, cls: 'bg-[#ef4444]' },
      { x: 120, y: 132, w: 42, h: 42, round: true, cls: 'bg-[#22c55e]' },
      { x: 170, y: 132, w: 42, h: 42, round: true, cls: 'bg-[#3b82f6]' },
    ],
    reveals: [
      { x: 120, y: 132, w: 42, h: 42, round: true, cls: 'text-white text-2xl font-bold', label: '✓', timing: 'early' },
      { x: 70, y: 132, w: 42, h: 42, round: true, cls: 'text-white text-xl font-bold', label: '✗', timing: 'early', delay: 0.2 },
    ],
    pulses: [{ x: 120, y: 132 }],
    finger: { mode: 'tap1', a: { x: 120, y: 132 } },
  },
};

// Fallback for any game without a bespoke scene: most are tap-driven, so a
// single "tap here" finger on a generic target reads correctly everywhere.
const GENERIC: Scene = {
  board: [{ x: 120, y: 80, w: 96, h: 56, cls: 'bg-white ring-1 ring-slate-200 text-3xl', label: '👆' }],
  reveals: [{ x: 120, y: 80, w: 96, h: 56, cls: 'bg-brand/10 ring-2 ring-brand/40', timing: 'early' }],
  pulses: [{ x: 120, y: 80, size: 64 }],
  finger: { mode: 'tap1', a: { x: 120, y: 80 } },
};

// ---- Rendering ----------------------------------------------------------------

function centered(x: number, y: number, w: number, h: number): CSSProperties {
  return { left: x, top: y, width: w, height: h, marginLeft: -w / 2, marginTop: -h / 2 };
}

function PieceEl({ p, anim }: { p: Reveal; anim?: string }) {
  return (
    <div
      className={`absolute flex items-center justify-center ${p.round ? 'rounded-full' : 'rounded'} ${p.cls ?? ''} ${anim ?? ''}`}
      style={{ ...centered(p.x, p.y, p.w, p.h), ...(p.delay ? { animationDelay: `${p.delay}s` } : {}) }}
    >
      {p.label}
    </div>
  );
}

function StageView({ scene }: { scene: Scene }) {
  const { finger } = scene;
  const fingerStyle: CSSProperties = {
    left: finger.a.x,
    top: finger.a.y,
    marginLeft: -13,
    marginTop: -4,
    ['--ax' as string]: `${finger.a.x}px`,
    ['--ay' as string]: `${finger.a.y}px`,
    ['--bx' as string]: `${finger.b?.x ?? finger.a.x}px`,
    ['--by' as string]: `${finger.b?.y ?? finger.a.y}px`,
  };
  const fingerClass =
    finger.mode === 'tap1' ? 'ht-finger1' : finger.mode === 'swipe' ? 'ht-swipe' : 'ht-finger2';

  return (
    <div
      aria-hidden
      className="relative mx-auto overflow-hidden rounded-2xl bg-slate-50 ring-1 ring-slate-200"
      style={{ width: W, height: H }}
    >
      {scene.board.map((p, i) => (
        <PieceEl key={`b${i}`} p={{ ...p, timing: 'late' }} />
      ))}
      {scene.pulses?.map((p, i) => (
        <div
          key={`p${i}`}
          className="ht-pulse absolute rounded-full border-2 border-brand"
          style={{ ...centered(p.x, p.y, p.size ?? 30, p.size ?? 30), ...(p.delay ? { animationDelay: `${p.delay}s` } : {}) }}
        />
      ))}
      {scene.reveals?.map((p, i) => (
        <PieceEl key={`r${i}`} p={p} anim={p.timing === 'early' ? 'ht-reveal-early' : 'ht-reveal-late'} />
      ))}
      <div className={`pointer-events-none absolute text-3xl ${fingerClass}`} style={fingerStyle}>
        👆
      </div>
    </div>
  );
}

export default function HowToOverlay() {
  const { t } = useTranslation();
  const h = useHowto();
  const id = h.openId();
  if (!id) return null;
  const game = getGame(id);
  if (!game) return null;
  const scene = SCENES[id] ?? GENERIC;

  return (
    <div
      role="dialog"
      aria-label={t('howto.help')}
      className="absolute inset-0 z-40 flex items-center justify-center bg-slate-900/50 p-5 backdrop-blur-sm"
      onClick={() => h.close()}
    >
      <div
        className="w-full max-w-sm rounded-3xl bg-white p-6 text-center text-slate-900 shadow-2xl ring-1 ring-black/5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-center gap-2">
          <span className="text-2xl">{game.emoji}</span>
          <h2 className="font-cyber text-xl">{t(game.nameKey)}</h2>
        </div>

        {VISUAL_TUTORIAL_GAMES.has(id) ? (
          <Suspense
            fallback={
              <div
                className="flex w-full items-center justify-center rounded-2xl bg-slate-950 ring-1 ring-white/10"
                style={{ height: 210 }}
              >
                <span className="animate-[pulse_2s_ease-in-out_infinite] text-sm text-white/60">…</span>
              </div>
            }
          >
            <VisualTutorial gameId={id} />
          </Suspense>
        ) : (
          <StageView scene={scene} />
        )}

        <button
          onClick={() => h.close()}
          className="mt-5 w-full rounded-2xl bg-brand px-4 py-3 font-semibold text-white"
        >
          {t('howto.gotIt')}
        </button>
      </div>
    </div>
  );
}
