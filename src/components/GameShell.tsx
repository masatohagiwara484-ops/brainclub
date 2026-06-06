import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { difficultyKey, DIFFICULTY_STYLE, type Difficulty } from '../lib/difficulty';

// ============================================================================
// GameShell — the shared dark-premium scaffold every game screen sits in, so
// all 20 titles read as one cohesive, paid-app-grade product instead of a wall
// of bespoke layouts. It owns the unified dark backdrop and a standardized top
// bar (difficulty chip · live stat · primary action). Games drop their board +
// controls in as children and use <ShellButton> for chrome so spacing,
// typography, color and motion stay consistent across the whole app.
// ============================================================================

// The one dark backdrop shared by every game — the source of cross-game cohesion.
export const GAME_BG = 'radial-gradient(120% 80% at 50% 0%, #1b2440 0%, #0d1322 58%, #080b14 100%)';

export function ShellButton({
  children,
  onClick,
  ariaLabel,
  className = '',
}: {
  children: ReactNode;
  onClick: () => void;
  ariaLabel?: string;
  className?: string;
}) {
  return (
    <button
      onClick={onClick}
      aria-label={ariaLabel}
      className={`rounded-xl bg-white/[0.08] px-3 py-1.5 text-sm font-semibold text-white ring-1 ring-white/15 backdrop-blur-sm transition hover:bg-white/[0.14] active:scale-95 ${className}`}
    >
      {children}
    </button>
  );
}

/** A standardized difficulty pill (colored dot + level), dark-surface friendly. */
export function DifficultyChip({ difficulty }: { difficulty: Difficulty }) {
  const { t } = useTranslation();
  return (
    <span className="inline-flex items-center gap-1.5 rounded-lg bg-white/[0.08] px-2.5 py-1 text-xs font-bold uppercase tracking-wide text-white ring-1 ring-white/10">
      <span className="h-2 w-2 rounded-full" style={{ background: DIFFICULTY_STYLE[difficulty].color }} />
      {t(difficultyKey(difficulty))}
    </span>
  );
}

export default function GameShell({
  difficulty,
  left,
  stat,
  action,
  children,
  scroll = true,
}: {
  /** Renders the standardized difficulty chip on the left. */
  difficulty?: Difficulty;
  /** Custom left content (used instead of `difficulty` when a game needs it). */
  left?: ReactNode;
  /** The live stat shown centered (timer / score / moves …). */
  stat?: ReactNode;
  /** The right-aligned primary action (usually a New / Restart ShellButton). */
  action?: ReactNode;
  children: ReactNode;
  /** Whether the content area scrolls (default true). */
  scroll?: boolean;
}) {
  return (
    <div className="flex h-full w-full flex-col text-white" style={{ background: GAME_BG }}>
      <div className="mx-auto flex w-full max-w-md items-center justify-between gap-3 px-4 pb-1 pt-3 text-sm">
        <div className="flex min-w-0 flex-1 items-center">{left ?? (difficulty && <DifficultyChip difficulty={difficulty} />)}</div>
        <div className="flex shrink-0 items-center justify-center font-semibold tabular-nums text-white/85">{stat}</div>
        <div className="flex min-w-0 flex-1 items-center justify-end">{action}</div>
      </div>
      <div className={`flex flex-1 flex-col items-center px-4 pb-4 ${scroll ? 'overflow-y-auto' : 'overflow-hidden'}`}>
        {children}
      </div>
    </div>
  );
}
