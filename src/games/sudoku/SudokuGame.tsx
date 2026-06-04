import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { makePuzzle, cell, N, type Grid, type Puzzle } from './sudokuGen';
import { difficultyKey, DIFFICULTY_STYLE, type Difficulty } from '../../lib/difficulty';
import type { GameProps } from '../types';
import { saveBest } from '../../lib/storage';
import { fx } from '../../lib/fx';
import ProgressResultModal from '../../components/ProgressResultModal';

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
  const [seconds, setSeconds] = useState(0);
  const [solved, setSolved] = useState(false);
  const [shareMsg, setShareMsg] = useState<string | null>(null);
  // Cells that just completed a unit — they briefly glow + pop.
  const [glow, setGlow] = useState<{ cells: Set<number>; key: number }>({ cells: new Set(), key: 0 });
  const streakRef = useRef(0); // unit-completions this puzzle (drives the pitch ramp)
  const glowKeyRef = useRef(0);

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
      setSeconds(0);
      setSolved(false);
      setGlow({ cells: new Set(), key: 0 });
      streakRef.current = 0;
    }, 20);
  }, []);

  // Clear the glow highlight shortly after it fires.
  useEffect(() => {
    if (glow.cells.size === 0) return;
    const id = setTimeout(() => setGlow({ cells: new Set(), key: 0 }), 720);
    return () => clearTimeout(id);
  }, [glow]);

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
      } else if (newly.length) {
        streakRef.current += 1;
        fx.correct({ streak: streakRef.current }); // rising chime + escalating haptic
        setGlow({ cells: new Set(newly), key: ++glowKeyRef.current });
      } else {
        fx.tick(); // soft blip on a normal placement
      }
      return next;
    });
  };

  const erase = () => {
    if (selected == null || !data || givenMask[selected]) return;
    setValues((prev) => {
      const next = prev.slice();
      next[selected] = 0;
      return next;
    });
  };

  // Keyboard support.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key >= '1' && e.key <= '9') place(Number(e.key));
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

  return (
    <div className="flex h-full flex-col items-center overflow-y-auto px-4 py-3">
      {/* Controls header */}
      <div className="flex w-full max-w-md items-center justify-between text-sm">
        <span
          className="font-dot rounded-lg px-2 py-1 text-xs font-bold text-white"
          style={{ backgroundColor: DIFFICULTY_STYLE[difficulty].color }}
        >
          {t(difficultyKey(difficulty))}
        </span>
        <span className="font-semibold tabular-nums text-slate-700">⏱ {fmt(seconds)}</span>
        <button
          onClick={() => generate(difficulty)}
          className="rounded-xl bg-slate-100 px-3 py-1.5 font-semibold text-slate-700 shadow-sm hover:bg-slate-200 active:scale-95"
        >
          {t('sudoku.newGame')}
        </button>
      </div>

      {/* Board */}
      <div className="relative mt-3 w-full max-w-md">
        {!data ? (
          <div className="grid aspect-square place-items-center text-slate-400">
            {t('sudoku.generating')}
          </div>
        ) : (
          <div className="grid aspect-square grid-cols-9 overflow-hidden rounded-xl border-2 border-slate-800 bg-white">
            {values.map((v, i) => {
              const r = Math.floor(i / N);
              const c = i % N;
              const isGiven = givenMask[i];
              const isSel = selected === i;
              const inLine = r === selRow || c === selCol;
              const sameVal = v !== 0 && v === selVal;
              const conflict = conflicts.has(i);

              const borders = [
                'border-slate-200',
                c % 3 === 0 && c !== 0 ? 'border-l-2 border-l-slate-800' : '',
                r % 3 === 0 && r !== 0 ? 'border-t-2 border-t-slate-800' : '',
              ].join(' ');

              let bg = 'bg-white';
              if (isSel) bg = 'bg-blue-200';
              else if (sameVal) bg = 'bg-blue-100';
              else if (inLine) bg = 'bg-slate-50';

              const text = conflict
                ? 'text-red-500'
                : isGiven
                  ? 'text-slate-900'
                  : 'text-brand';

              const glowing = glow.cells.has(i);

              return (
                <button
                  key={i}
                  onClick={() => setSelected(i)}
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
      </div>

      {/* Number pad */}
      <div className="mt-4 grid w-full max-w-md grid-cols-5 gap-2 sm:grid-cols-10">
        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
          <button
            key={n}
            onClick={() => place(n)}
            className="aspect-square rounded-xl bg-slate-100 text-xl font-bold text-slate-800 shadow-sm transition hover:bg-blue-100 active:scale-95"
          >
            {n}
          </button>
        ))}
        <button
          onClick={erase}
          className="aspect-square rounded-xl bg-slate-100 text-lg text-slate-500 shadow-sm transition hover:bg-slate-200 active:scale-95"
          aria-label={t('sudoku.erase')}
        >
          ⌫
        </button>
      </div>

      {/* Solved modal */}
      {solved && (
        <ProgressResultModal
          emoji="🎉"
          title={t('sudoku.solved')}
          subtitle={
            <>
              {t(`difficulty.${difficulty}`)} · ⏱ {fmt(seconds)}
            </>
          }
          actions={[
            { label: t('sudoku.share'), onClick: onShare, variant: 'primary' },
            { label: t('sudoku.again'), onClick: () => generate(difficulty), variant: 'secondary' },
          ]}
          shareMsg={shareMsg}
        />
      )}
    </div>
  );
}
