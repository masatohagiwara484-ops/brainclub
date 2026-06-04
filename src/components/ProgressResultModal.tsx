// The ONE result modal every game shows when a round ends. Before this, all
// seven games hand-rolled a near-identical overlay (emoji → title → subtitle →
// buttons → share toast). This unifies that markup AND centralizes the win
// celebration: instead of each game scattering `fx.win()` through its win
// detection, it just renders this modal with `celebrate` and the confetti +
// chime fire exactly once, the moment the modal opens.
//
// It is descriptor-driven: pass `stats` chips, an optional `distribution`, and
// any custom content via `children` — so games stay declarative and the layout
// stays consistent. Render it conditionally (`{won && <ProgressResultModal …/>}`)
// just like the markup it replaces.

import { useEffect, useRef, type ReactNode } from 'react';
import { fx } from '../lib/fx';
import SynapsePanel from './SynapsePanel';
import AdSlot from './AdSlot';

export type StatChip = { value: ReactNode; label: ReactNode };

export type ResultBar = {
  rowLabel: ReactNode;
  value: number;
  /** This bar is the current result — paint it with `highlightClass`. */
  highlight?: boolean;
};

export type Distribution = {
  label: ReactNode;
  bars: ResultBar[];
  /** Tailwind bg-* class for the highlighted bar (pass a color-blind-aware one). */
  highlightClass?: string;
};

export type ResultAction = {
  label: ReactNode;
  onClick: () => void;
  /** 'primary' (brand fill) is the default; 'secondary' is the muted button. */
  variant?: 'primary' | 'secondary';
};

type Props = {
  emoji: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  /** Fire the win celebration (confetti + chime) once when the modal opens. */
  celebrate?: boolean;
  stats?: StatChip[];
  distribution?: Distribution;
  /** Extra custom content, rendered between the stats/distribution and actions. */
  children?: ReactNode;
  /** A small grey footnote below the custom content. */
  note?: ReactNode;
  actions: ResultAction[];
  /**
   * When the play crossed a Synapse level threshold, pass the banner content
   * (e.g. "Level 3!"). It shows a banner and upgrades the open celebration from
   * the win chime to the level-up fanfare. Only honored when `celebrate` is on,
   * so a loss is never dressed up as a level-up.
   */
  levelUp?: ReactNode;
  /** Show the live Synapse profile panel (radar + score + level). Default true. */
  synapse?: boolean;
  /** Ephemeral "Copied!/Shared!" toast text. */
  shareMsg?: string | null;
  /** Optional dismiss link at the very bottom (e.g. "Back"). */
  onClose?: () => void;
  closeLabel?: ReactNode;
};

// Static class names so Tailwind's JIT keeps them in the bundle.
const COLS: Record<number, string> = {
  1: 'grid-cols-1',
  2: 'grid-cols-2',
  3: 'grid-cols-3',
  4: 'grid-cols-4',
};

export default function ProgressResultModal({
  emoji,
  title,
  subtitle,
  celebrate = true,
  stats,
  distribution,
  children,
  note,
  actions,
  levelUp,
  synapse = true,
  shareMsg,
  onClose,
  closeLabel,
}: Props) {
  // Fire the celebration exactly once, when the modal first appears. The ref
  // guard keeps React 18 StrictMode's double-invoked mount effect from firing
  // it twice in development. A level-up upgrades the win chime to the louder
  // level-up fanfare.
  const showLevelUp = celebrate && levelUp != null;
  const fired = useRef(false);
  useEffect(() => {
    if (celebrate && !fired.current) {
      fired.current = true;
      if (showLevelUp) fx.levelUp();
      else fx.win();
    }
  }, [celebrate, showLevelUp]);

  const maxBar = distribution ? Math.max(1, ...distribution.bars.map((b) => b.value)) : 1;

  return (
    <div className="absolute inset-0 z-10 flex items-center justify-center bg-slate-900/40 p-6 backdrop-blur-sm">
      <div className="max-h-[88vh] w-full max-w-sm overflow-y-auto rounded-3xl bg-white p-6 text-center text-slate-900 shadow-2xl ring-1 ring-black/5">
        <div className="text-4xl">{emoji}</div>
        <h2 className="font-cyber mt-2 text-2xl">{title}</h2>
        {showLevelUp && (
          <div className="mx-auto mt-2 inline-block rounded-full bg-accent px-3 py-1 text-sm font-bold text-white shadow fx-pop">
            ⚡ {levelUp}
          </div>
        )}
        {subtitle != null && <p className="mt-1 text-slate-500">{subtitle}</p>}

        {stats && stats.length > 0 && (
          <div className={`mt-4 grid gap-1 text-center ${COLS[stats.length] ?? 'grid-cols-4'}`}>
            {stats.map((s, i) => (
              <div key={i}>
                <div className="text-xl font-bold tabular-nums">{s.value}</div>
                <div className="text-[10px] leading-tight text-slate-500">{s.label}</div>
              </div>
            ))}
          </div>
        )}

        {distribution && (
          <>
            <div className="mt-4 text-left text-xs font-semibold text-slate-500">{distribution.label}</div>
            <div className="mt-1 flex flex-col gap-1">
              {distribution.bars.map((b, i) => (
                <div key={i} className="flex items-center gap-2 text-xs">
                  <span className="w-3 text-slate-500">{b.rowLabel}</span>
                  <div className="flex-1">
                    <div
                      className={`flex h-5 items-center justify-end rounded px-1.5 font-bold text-white ${
                        b.highlight ? distribution.highlightClass ?? 'bg-brand' : 'bg-slate-400'
                      }`}
                      style={{ width: `${Math.max(8, (b.value / maxBar) * 100)}%` }}
                    >
                      {b.value}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {children}
        {synapse && <SynapsePanel compact />}
        <AdSlot className="mt-4 text-left" />
        {note != null && <p className="mt-3 text-xs text-slate-400">{note}</p>}

        <div className="mt-5 flex justify-center gap-2">
          {actions.map((a, i) => (
            <button
              key={i}
              onClick={a.onClick}
              className={`rounded-xl px-4 py-2 font-semibold ${
                a.variant === 'secondary' ? 'bg-slate-100 text-slate-700' : 'bg-brand text-white'
              }`}
            >
              {a.label}
            </button>
          ))}
        </div>

        {shareMsg && <p className="mt-3 text-sm text-accent">{shareMsg}</p>}

        {onClose && (
          <button onClick={onClose} className="mt-4 text-xs text-slate-400 underline">
            {closeLabel}
          </button>
        )}
      </div>
    </div>
  );
}
