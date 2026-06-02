import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { makePuzzle, cell, N, type Grid, type Puzzle } from './sudokuGen';
import { difficultyKey, DIFFICULTY_STYLE, type Difficulty } from '../../lib/difficulty';
import type { GameProps } from '../types';
import { saveBest } from '../../lib/storage';
import { haptics } from '../../lib/haptics';

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
    }, 20);
  }, []);

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
    setValues((prev) => {
      const next = prev.slice();
      next[selected] = next[selected] === v ? 0 : v;
      haptics.tick();

      if (next.every((x, i) => x === data.solution[i])) {
        setSolved(true);
        haptics.success();
        saveBest('sudoku', difficulty, { seconds, moves: 0, at: Date.now() });
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

              return (
                <button
                  key={i}
                  onClick={() => setSelected(i)}
                  className={`flex aspect-square items-center justify-center border text-lg font-semibold sm:text-xl ${borders} ${bg} ${text} ${
                    isGiven ? 'font-bold' : ''
                  }`}
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
        <div className="absolute inset-0 flex items-center justify-center bg-slate-900/40 p-6 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-3xl bg-white p-6 text-center text-slate-900 shadow-2xl ring-1 ring-black/5">
            <div className="text-4xl">🎉</div>
            <h2 className="font-cyber mt-2 text-2xl">{t('sudoku.solved')}</h2>
            <p className="mt-1 text-slate-500">
              {t(`difficulty.${difficulty}`)} · ⏱ {fmt(seconds)}
            </p>
            <div className="mt-5 flex justify-center gap-2">
              <button onClick={onShare} className="rounded-xl bg-brand px-4 py-2 font-semibold text-white">
                {t('sudoku.share')}
              </button>
              <button
                onClick={() => generate(difficulty)}
                className="rounded-xl bg-slate-100 px-4 py-2 font-semibold text-slate-700"
              >
                {t('sudoku.again')}
              </button>
            </div>
            {shareMsg && <p className="mt-3 text-sm text-accent">{shareMsg}</p>}
          </div>
        </div>
      )}
    </div>
  );
}
