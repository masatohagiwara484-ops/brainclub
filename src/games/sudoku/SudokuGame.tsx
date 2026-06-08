import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { makePuzzle, cell, N, type Grid, type Puzzle } from './sudokuGen';
import { type Difficulty } from '../../lib/difficulty';
import type { GameProps } from '../types';
import { saveBest } from '../../lib/storage';
import { submitScore } from '../../lib/leaderboard';
import { fx } from '../../lib/fx';
import { recordPlay, difficultyQuality, clamp01, XP_WEIGHT } from '../../lib/synapse';
import { getGame } from '../registry';
import GameResultScreen from '../../components/GameResultScreen';
import GameShell, { ShellButton } from '../../components/GameShell';

const AXES = getGame('sudoku')?.axes ?? {};
// Target solve times (seconds) per difficulty — beating them nudges quality up.
const TARGET: Record<Difficulty, number> = { easy: 300, medium: 420, hard: 600, expert: 900 };

// Escalating combo names for consecutive unit completions (combo starts at 3).
const COMBO_WORDS = ['GOOD', 'GREAT', 'AMAZING', 'FANTASTIC', 'INCREDIBLE', 'UNSTOPPABLE', 'LEGENDARY'];
function comboLabel(n: number): string {
  return n >= 10 ? 'GODLIKE' : (COMBO_WORDS[n - 3] ?? 'GODLIKE');
}

// Cells of the row / column / 3×3 box that contain index `i`.
function rowCells(i: number): number[] {
  const r = Math.floor(i / N);
  return [...Array(N).keys()].map((c) => cell(r, c));
}
function colCells(i: number): number[] {
  const c = i % N;
  return [...Array(N).keys()].map((r) => cell(r, c));
}
function boxCells(i: number): number[] {
  const br = Math.floor(Math.floor(i / N) / 3) * 3;
  const bc = Math.floor((i % N) / 3) * 3;
  const out: number[] = [];
  for (let dr = 0; dr < 3; dr++) for (let dc = 0; dc < 3; dc++) out.push(cell(br + dr, bc + dc));
  return out;
}

/** A unit is "incomplete" if any cell is empty or two cells share a value. */
function unitIncomplete(values: Grid, cells: number[]): boolean {
  const seen = new Set<number>();
  for (const i of cells) {
    const v = values[i];
    if (v === 0 || seen.has(v)) return true;
    seen.add(v);
  }
  return false;
}

function fmt(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

/** Indices whose value duplicates another in the same row, column, or box. */
function findConflicts(values: Grid): Set<number> {
  const bad = new Set<number>();
  const check = (cells: number[]) => {
    const seen = new Map<number, number>();
    for (const i of cells) {
      const v = values[i];
      if (v === 0) continue;
      if (seen.has(v)) {
        bad.add(i);
        bad.add(seen.get(v)!);
      } else {
        seen.set(v, i);
      }
    }
  };
  for (let r = 0; r < N; r++) check([...Array(N).keys()].map((c) => cell(r, c)));
  for (let c = 0; c < N; c++) check([...Array(N).keys()].map((r) => cell(r, c)));
  for (let br = 0; br < 3; br++) {
    for (let bc = 0; bc < 3; bc++) {
      const cells: number[] = [];
      for (let dr = 0; dr < 3; dr++)
        for (let dc = 0; dc < 3; dc++) cells.push(cell(br * 3 + dr, bc * 3 + dc));
      check(cells);
    }
  }
  return bad;
}

export default function SudokuGame({ difficulty = 'easy' }: GameProps) {
  const { t } = useTranslation();

  const [data, setData] = useState<Puzzle | null>(null);
  const [values, setValues] = useState<Grid>([]);
  const [selected, setSelected] = useState<number | null>(null);
  // The digit the player last tapped — every matching cell lights up so it's
  // easy to see where that number already lives on the board.
  const [activeDigit, setActiveDigit] = useState<number | null>(null);
  const [seconds, setSeconds] = useState(0);
  const [solved, setSolved] = useState(false);
  const [levelUp, setLevelUp] = useState<string | null>(null);
  const [shareMsg, setShareMsg] = useState<string | null>(null);
  // Cells that just completed a unit — they briefly glow + pop.
  const [glow, setGlow] = useState<{ cells: Set<number>; key: number }>({ cells: new Set(), key: 0 });
  // Combo banner (GOOD … GODLIKE) for consecutive unit completions.
  const [combo, setCombo] = useState<{ label: string; count: number; key: number } | null>(null);
  const streakRef = useRef(0); // unit-completions this puzzle (drives the pitch ramp)
  const comboRef = useRef(0); // consecutive completing moves (resets on a plain move)
  const comboKeyRef = useRef(0);
  const glowKeyRef = useRef(0);

  // How many of each digit (1–9) are on the board. A digit placed all 9 times
  // is "used up" and disappears from the number pad.
  const counts = useMemo(() => {
    const c = Array(10).fill(0) as number[];
    for (const v of values) if (v >= 1 && v <= 9) c[v]++;
    return c;
  }, [values]);

  const givenMask = useMemo(
    () => (data ? data.puzzle.map((v) => v !== 0) : []),
    [data],
  );
  const conflicts = useMemo(() => findConflicts(values), [values]);

  const generate = useCallback((d: Difficulty) => {
    setData(null); // show a brief "generating" state
    // Defer so the loading state can paint before the (synchronous) solve.
    setTimeout(() => {
      const p = makePuzzle(d);
      setData(p);
      setValues(p.puzzle.slice());
      setSelected(null);
      setActiveDigit(null);
      setSeconds(0);
      setSolved(false);
      setLevelUp(null);
      setGlow({ cells: new Set(), key: 0 });
      setCombo(null);
      streakRef.current = 0;
      comboRef.current = 0;
    }, 20);
  }, []);

  // Clear the glow highlight shortly after it fires.
  useEffect(() => {
    if (glow.cells.size === 0) return;
    const id = setTimeout(() => setGlow({ cells: new Set(), key: 0 }), 720);
    return () => clearTimeout(id);
  }, [glow]);

  // Clear the combo banner after its pop animation.
  useEffect(() => {
    if (!combo) return;
    const id = setTimeout(() => setCombo(null), 1000);
    return () => clearTimeout(id);
  }, [combo]);

  useEffect(() => {
    generate(difficulty);
  }, [difficulty, generate]);

  // Timer: tick while playing.
  useEffect(() => {
    if (!data || solved) return;
    const id = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [data, solved]);

  const place = (v: number) => {
    if (selected == null || !data || solved) return;
    if (givenMask[selected]) return;
    const idx = selected;
    setValues((prev) => {
      const next = prev.slice();
      next[idx] = next[idx] === v ? 0 : v;

      // Did this move newly complete the row / column / box? (filled + no conflict)
      const newly: number[] = [];
      for (const unit of [rowCells(idx), colCells(idx), boxCells(idx)]) {
        if (!unitIncomplete(next, unit) && unitIncomplete(prev, unit)) newly.push(...unit);
      }
      const full = next.every((x, i) => x === data.solution[i]);

      if (full) {
        setSolved(true);
        // The win celebration (confetti + chime) is fired centrally by the
        // result modal when it opens.
        saveBest('sudoku', difficulty, { seconds, moves: 0, at: Date.now() });
        // Faster solve → higher leaderboard score (server keeps best of the day).
        void submitScore('sudoku', difficulty, Math.max(1, Math.round(1_000_000 / Math.max(1, seconds))), { time: fmt(seconds) });
        const perf = clamp01((TARGET[difficulty] - seconds) / TARGET[difficulty]);
        const res = recordPlay({
          gameId: 'sudoku',
          axes: AXES,
          quality: difficultyQuality(difficulty, perf),
          weight: XP_WEIGHT[difficulty],
        });
        setLevelUp(res.leveledUp ? t('synapse.levelUp', { n: res.newLevel }) : null);
      } else if (newly.length) {
        streakRef.current += 1;
        fx.correct({ streak: streakRef.current }); // rising chime + escalating haptic
        setGlow({ cells: new Set(newly), key: ++glowKeyRef.current });
        // Combo: each consecutive completing move climbs the ladder.
        comboRef.current += 1;
        if (comboRef.current >= 3) {
          setCombo({ label: comboLabel(comboRef.current), count: comboRef.current, key: ++comboKeyRef.current });
        }
      } else {
        fx.tick(); // soft blip on a normal placement
        comboRef.current = 0; // a non-completing move breaks the combo chain
      }
      return next;
    });
  };

  // Tapping a pad digit highlights every matching cell AND (if a cell is
  // selected) places it. Highlighting works even with no cell selected, so the
  // player can peek where a number already lives.
  const onPadDigit = (n: number) => {
    setActiveDigit(n);
    place(n);
  };

  const erase = () => {
    if (selected == null || !data || givenMask[selected]) return;
    comboRef.current = 0;
    setValues((prev) => {
      const next = prev.slice();
      next[selected] = 0;
      return next;
    });
  };

  // Keyboard support.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key >= '1' && e.key <= '9') onPadDigit(Number(e.key));
      else if (e.key === 'Backspace' || e.key === 'Delete' || e.key === '0') erase();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const onShare = async () => {
    const text = `BrainClub · ${t('games.sudoku.name')} (${t(`difficulty.${difficulty}`)})\n🧩 ${fmt(
      seconds,
    )}\n${window.location.origin}`;
    let res: 'shared' | 'copied' | 'failed' = 'failed';
    try {
      if (navigator.share) {
        await navigator.share({ title: 'BrainClub', text });
        res = 'shared';
      } else {
        await navigator.clipboard.writeText(text);
        res = 'copied';
      }
    } catch {
      try {
        await navigator.clipboard.writeText(text);
        res = 'copied';
      } catch {
        res = 'failed';
      }
    }
    setShareMsg(res === 'shared' ? t('share.shared') : res === 'copied' ? t('share.copied') : t('share.failed'));
    setTimeout(() => setShareMsg(null), 2500);
  };

  const selVal = selected != null ? values[selected] : 0;
  const selRow = selected != null ? Math.floor(selected / N) : -1;
  const selCol = selected != null ? selected % N : -1;
  // A tapped pad digit wins; otherwise the selected cell's own value lights up
  // its twins.
  const highlightVal = activeDigit ?? selVal;

  return (
    <GameShell
      difficulty={difficulty}
      stat={<>⏱ {fmt(seconds)}</>}
      action={<ShellButton onClick={() => generate(difficulty)}>{t('sudoku.newGame')}</ShellButton>}
    >
      {/* Board */}
      <div className="relative mt-2 w-full max-w-md">
        {!data ? (
          <div className="grid aspect-square place-items-center text-white/50">
            {t('sudoku.generating')}
          </div>
        ) : (
          <div className="grid aspect-square grid-cols-9 overflow-hidden rounded-2xl border-2 border-white/20 bg-slate-900/50 shadow-elevated ring-1 ring-white/5">
            {values.map((v, i) => {
              const r = Math.floor(i / N);
              const c = i % N;
              const isGiven = givenMask[i];
              const isSel = selected === i;
              const inLine = r === selRow || c === selCol;
              const sameVal = v !== 0 && v === highlightVal;
              const conflict = conflicts.has(i);

              const borders = [
                'border-white/10',
                c % 3 === 0 && c !== 0 ? 'border-l-2 border-l-white/30' : '',
                r % 3 === 0 && r !== 0 ? 'border-t-2 border-t-white/30' : '',
              ].join(' ');

              // Twin cells glow WARM (orange) so they pop against the navy theme.
              let bg = 'bg-transparent';
              if (isSel) bg = 'bg-primary/40';
              else if (sameVal) bg = 'bg-orange-500/30 ring-1 ring-inset ring-orange-400/60';
              else if (inLine) bg = 'bg-white/[0.06]';

              const text = conflict
                ? 'text-rose-400'
                : isGiven
                  ? 'text-white'
                  : 'text-accent-cyan';

              const glowing = glow.cells.has(i);

              return (
                <button
                  key={i}
                  onClick={() => {
                    setSelected(i);
                    setActiveDigit(null); // selecting a cell hands highlight back to its own value
                  }}
                  data-evolve={glowing ? 'unit' : undefined}
                  className={`flex aspect-square items-center justify-center border text-lg font-semibold sm:text-xl ${borders} ${bg} ${text} ${
                    isGiven ? 'font-bold' : ''
                  } ${glowing ? 'fx-glow fx-pop z-10' : ''}`}
                >
                  {v !== 0 ? v : ''}
                </button>
              );
            })}
          </div>
        )}

        {/* Combo banner — shows the streak count (e.g. "5 COMBO") + its name. */}
        {combo && (
          <div key={combo.key} className="combo-pop pointer-events-none absolute inset-0 z-20 flex flex-col items-center justify-start pt-10">
            <span className="font-display text-2xl font-black tabular-nums text-amber-300 drop-shadow">{combo.count} COMBO</span>
            <span className="font-display text-5xl uppercase tracking-tight text-transparent" style={{
              backgroundImage: 'linear-gradient(100deg, #fb923c, #f472b6, #f59e0b)',
              WebkitBackgroundClip: 'text',
              backgroundClip: 'text',
            }}>
              {combo.label}
            </span>
          </div>
        )}
      </div>

      {/* Number pad */}
      <div className="mt-4 grid w-full max-w-md grid-cols-5 gap-2 sm:grid-cols-10">
        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => {
          const usedUp = counts[n] >= 9; // all placed → remove from the pad
          const isActive = activeDigit === n;
          return (
            <button
              key={n}
              onClick={() => onPadDigit(n)}
              disabled={usedUp}
              aria-hidden={usedUp}
              className={`aspect-square rounded-xl text-xl font-bold shadow-sm ring-1 transition active:scale-95 ${
                usedUp
                  ? 'invisible'
                  : isActive
                    ? 'bg-orange-500/30 text-white ring-orange-400/60'
                    : 'bg-white/[0.08] text-white ring-white/10 hover:bg-primary/30'
              }`}
            >
              {n}
            </button>
          );
        })}
        <button
          onClick={erase}
          className="aspect-square rounded-xl bg-white/[0.08] text-lg text-white/70 shadow-sm ring-1 ring-white/10 transition hover:bg-white/[0.16] active:scale-95"
          aria-label={t('sudoku.erase')}
        >
          ⌫
        </button>
      </div>

      {/* Solved modal */}
      {solved && (
        <GameResultScreen
          emoji="🎉"
          title={t('sudoku.solved')}
          subtitle={
            <>
              {t(`difficulty.${difficulty}`)} · ⏱ {fmt(seconds)}
            </>
          }
          levelUp={levelUp}
          actions={[
            { label: t('sudoku.share'), onClick: onShare, variant: 'primary' },
            { label: t('sudoku.again'), onClick: () => generate(difficulty), variant: 'secondary' },
          ]}
          shareMsg={shareMsg}
        />
      )}
    </GameShell>
  );
}
