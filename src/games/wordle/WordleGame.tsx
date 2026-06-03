import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { GameProps } from '../types';
import { difficultyKey, DIFFICULTY_STYLE, type Difficulty } from '../../lib/difficulty';
import { dailySeed, dayNumber, makeRng } from '../../lib/daily';
import { bumpStreak, getSetting, setSetting } from '../../lib/storage';
import { haptics } from '../../lib/haptics';
import { fx } from '../../lib/fx';
import {
  WORD_CONFIG,
  evaluate,
  isValidGuess,
  pickWord,
  randomWord,
  stateEmoji,
  bestState,
  type LetterState,
} from './wordGuess';

type Mode = 'daily' | 'practice';
type Status = 'playing' | 'won' | 'lost';

type DailyProgress = {
  day: number;
  answer: string;
  guesses: string[];
  status: Status;
};

type Stats = {
  played: number;
  wins: number;
  streak: number;
  maxStreak: number;
  lastDay: number;
  dist: number[]; // index 0 = solved in 1 guess
};

const KEY_ROWS = [
  ['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p'],
  ['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l'],
  ['enter', 'z', 'x', 'c', 'v', 'b', 'n', 'm', 'back'],
];

function emptyStats(maxGuesses: number): Stats {
  return { played: 0, wins: 0, streak: 0, maxStreak: 0, lastDay: -2, dist: new Array(maxGuesses).fill(0) };
}

function loadStats(difficulty: Difficulty, maxGuesses: number): Stats {
  const s = getSetting<Stats | null>(`wordle.stats.${difficulty}`, null);
  if (!s || !Array.isArray(s.dist) || s.dist.length !== maxGuesses) return emptyStats(maxGuesses);
  return s;
}

export default function WordleGame({ difficulty = 'medium' }: GameProps) {
  const { t } = useTranslation();
  const { length, maxGuesses } = WORD_CONFIG[difficulty];

  const [mode, setMode] = useState<Mode>('daily');
  const [answer, setAnswer] = useState('');
  const [guesses, setGuesses] = useState<string[]>([]);
  const [current, setCurrent] = useState('');
  const [status, setStatus] = useState<Status>('playing');

  const [stats, setStats] = useState<Stats>(() => loadStats(difficulty, maxGuesses));
  const [showResult, setShowResult] = useState(false);
  const [shareMsg, setShareMsg] = useState<string | null>(null);

  // Animation nonces.
  const [popKey, setPopKey] = useState(0);
  const [shakeKey, setShakeKey] = useState(0);
  const [flipRow, setFlipRow] = useState<number | null>(null);

  const dailyKey = `wordle.daily.${difficulty}`;

  // ---- Start / restore a board whenever difficulty or mode changes ----
  const startDaily = useCallback(() => {
    const today = dayNumber();
    const saved = getSetting<DailyProgress | null>(dailyKey, null);
    if (saved && saved.day === today && saved.answer.length === length) {
      setAnswer(saved.answer);
      setGuesses(saved.guesses);
      setStatus(saved.status);
      setCurrent('');
      setShowResult(saved.status !== 'playing');
      return;
    }
    const word = pickWord(length, makeRng(dailySeed(`wordle-${difficulty}`)));
    setAnswer(word);
    setGuesses([]);
    setStatus('playing');
    setCurrent('');
    setShowResult(false);
  }, [dailyKey, difficulty, length]);

  const startPractice = useCallback(() => {
    setAnswer(randomWord(length));
    setGuesses([]);
    setStatus('playing');
    setCurrent('');
    setShowResult(false);
  }, [length]);

  useEffect(() => {
    setStats(loadStats(difficulty, maxGuesses));
    if (mode === 'daily') startDaily();
    else startPractice();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [difficulty, mode]);

  // Persist daily progress.
  const persistDaily = useCallback(
    (g: string[], st: Status, ans: string) => {
      if (mode !== 'daily') return;
      const prog: DailyProgress = { day: dayNumber(), answer: ans, guesses: g, status: st };
      setSetting(dailyKey, prog);
    },
    [mode, dailyKey],
  );

  // Record stats once, when a daily game ends.
  const recordDaily = useCallback(
    (won: boolean, guessCount: number) => {
      if (mode !== 'daily') return;
      setStats((prev) => {
        const today = dayNumber();
        if (prev.lastDay === today) return prev; // already recorded today
        const dist = prev.dist.slice();
        if (won) dist[guessCount - 1] = (dist[guessCount - 1] ?? 0) + 1;
        const streak = won ? (prev.lastDay === today - 1 ? prev.streak + 1 : 1) : 0;
        const next: Stats = {
          played: prev.played + 1,
          wins: prev.wins + (won ? 1 : 0),
          streak,
          maxStreak: Math.max(prev.maxStreak, streak),
          lastDay: today,
          dist,
        };
        setSetting(`wordle.stats.${difficulty}`, next);
        return next;
      });
      if (won) bumpStreak();
    },
    [mode, difficulty],
  );

  // ---- Evaluated states for submitted rows + keyboard ----
  const rowStates = useMemo(
    () => guesses.map((g) => evaluate(g, answer)),
    [guesses, answer],
  );

  const keyState = useMemo(() => {
    const map: Record<string, LetterState> = {};
    guesses.forEach((g, r) => {
      const st = rowStates[r];
      for (let i = 0; i < g.length; i++) {
        map[g[i]] = bestState(map[g[i]], st[i]);
      }
    });
    return map;
  }, [guesses, rowStates]);

  // ---- Input handlers ----
  const submit = useCallback(() => {
    if (status !== 'playing') return;
    if (!isValidGuess(current, length)) {
      setShakeKey((k) => k + 1);
      haptics.bump();
      return;
    }
    const g = [...guesses, current];
    const won = current === answer;
    const lost = !won && g.length >= maxGuesses;
    const st: Status = won ? 'won' : lost ? 'lost' : 'playing';

    setGuesses(g);
    setCurrent('');
    setFlipRow(g.length - 1);
    setStatus(st);
    persistDaily(g, st, answer);

    if (won) {
      fx.win();
      recordDaily(true, g.length);
    } else if (lost) {
      haptics.bump();
      recordDaily(false, g.length);
    } else {
      haptics.tick();
    }
    if (st !== 'playing') setTimeout(() => setShowResult(true), length * 280 + 400);
  }, [status, current, length, guesses, answer, maxGuesses, persistDaily, recordDaily]);

  const typeLetter = useCallback(
    (ch: string) => {
      if (status !== 'playing') return;
      if (current.length >= length) return;
      setCurrent((c) => c + ch);
      setPopKey((k) => k + 1);
    },
    [status, current, length],
  );

  const backspace = useCallback(() => {
    if (status !== 'playing') return;
    setCurrent((c) => c.slice(0, -1));
  }, [status]);

  const onKey = useCallback(
    (k: string) => {
      if (k === 'enter') submit();
      else if (k === 'back') backspace();
      else typeLetter(k);
    },
    [submit, backspace, typeLetter],
  );

  // Physical keyboard.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const k = e.key.toLowerCase();
      if (k === 'enter') submit();
      else if (k === 'backspace') backspace();
      else if (/^[a-z]$/.test(k)) typeLetter(k);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [submit, backspace, typeLetter]);

  // ---- Share ----
  const onShare = async () => {
    const grid = rowStates.map((st) => st.map(stateEmoji).join('')).join('\n');
    const won = status === 'won';
    const score = won ? `${guesses.length}/${maxGuesses}` : `X/${maxGuesses}`;
    const head =
      mode === 'daily'
        ? `${t('games.wordle.name')} · ${t('wordle.daily')} #${dayNumber()} (${t(difficultyKey(difficulty))})`
        : `${t('games.wordle.name')} · ${t('wordle.practice')} (${t(difficultyKey(difficulty))})`;
    const text = `BrainClub · ${head}\n${score}\n${grid}\n${window.location.origin}`;

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

  // ---- Tile rendering helpers ----
  const tileColor = (s: LetterState): string =>
    s === 'correct'
      ? 'bg-green-500 border-green-500 text-white'
      : s === 'present'
        ? 'bg-yellow-400 border-yellow-400 text-white'
        : 'bg-slate-400 border-slate-400 text-white';

  const winRate = stats.played ? Math.round((stats.wins / stats.played) * 100) : 0;
  const maxDist = Math.max(1, ...stats.dist);

  return (
    <div className="flex h-full flex-col items-center overflow-y-auto px-3 py-3">
      {/* Header: difficulty + mode toggle */}
      <div className="flex w-full max-w-md items-center justify-between text-sm">
        <span
          className="font-dot rounded-lg px-2 py-1 text-xs font-bold text-white"
          style={{ backgroundColor: DIFFICULTY_STYLE[difficulty].color }}
        >
          {t(difficultyKey(difficulty))} · {length}
        </span>

        <div className="flex overflow-hidden rounded-xl bg-slate-100 p-0.5 text-xs font-semibold">
          {(['daily', 'practice'] as Mode[]).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`rounded-lg px-3 py-1.5 transition ${
                mode === m ? 'bg-brand text-white shadow-sm' : 'text-slate-600'
              }`}
            >
              {t(`wordle.${m}`)}
            </button>
          ))}
        </div>

        {mode === 'practice' ? (
          <button
            onClick={startPractice}
            className="rounded-xl bg-slate-100 px-3 py-1.5 font-semibold text-slate-700 shadow-sm hover:bg-slate-200 active:scale-95"
          >
            {t('wordle.newGame')}
          </button>
        ) : (
          <span className="w-[68px] text-right text-xs text-slate-400">
            {Math.min(guesses.length + (status === 'playing' ? 1 : 0), maxGuesses)}/{maxGuesses}
          </span>
        )}
      </div>

      {/* Board */}
      <div className="mt-4 flex flex-col gap-1.5" style={{ perspective: '800px' }}>
        {Array.from({ length: maxGuesses }).map((_, r) => {
          const submitted = r < guesses.length;
          const isActive = r === guesses.length && status === 'playing';
          const rowVal = submitted ? guesses[r] : isActive ? current : '';
          const st = submitted ? rowStates[r] : null;

          return (
            <div
              key={isActive ? `active-${shakeKey}` : `row-${r}`}
              className={`flex gap-1.5 ${isActive && shakeKey ? 'wg-shake' : ''}`}
            >
              {Array.from({ length }).map((_, i) => {
                const ch = rowVal[i] ?? '';
                const filled = !!ch;
                const justTyped = isActive && i === current.length - 1;
                const flipping = flipRow === r;
                const won = status === 'won' && submitted && st && st.every((s) => s === 'correct');

                const base =
                  'flex items-center justify-center rounded-md border-2 font-bold uppercase select-none';
                const sizeCls =
                  length >= 7
                    ? 'h-11 w-11 text-lg sm:h-12 sm:w-12 sm:text-xl'
                    : length === 6
                      ? 'h-12 w-12 text-xl sm:text-2xl'
                      : 'h-14 w-14 text-2xl';

                let look: string;
                if (submitted && st) look = tileColor(st[i]);
                else if (filled) look = 'bg-white border-slate-400 text-slate-900';
                else look = 'bg-white border-slate-200 text-slate-900';

                const anim = won ? 'wg-bounce' : flipping ? 'wg-flip' : '';
                const delay = (won || flipping) ? `${i * 120}ms` : undefined;

                return (
                  <div
                    key={justTyped ? `t-${i}-${popKey}` : `t-${i}`}
                    className={`${base} ${sizeCls} ${look} ${anim} ${justTyped ? 'wg-pop' : ''}`}
                    style={delay ? { animationDelay: delay } : undefined}
                  >
                    {ch}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>

      {/* On-screen keyboard */}
      <div className="mt-auto w-full max-w-lg select-none pt-4">
        {KEY_ROWS.map((row, ri) => (
          <div key={ri} className="mb-1.5 flex justify-center gap-1.5">
            {row.map((k) => {
              const wide = k === 'enter' || k === 'back';
              const s = keyState[k];
              let bg = 'bg-slate-200 text-slate-800';
              if (s === 'correct') bg = 'bg-green-500 text-white';
              else if (s === 'present') bg = 'bg-yellow-400 text-white';
              else if (s === 'absent') bg = 'bg-slate-400 text-white';
              return (
                <button
                  key={k}
                  onClick={() => onKey(k)}
                  className={`flex h-12 items-center justify-center rounded-md text-sm font-bold uppercase shadow-sm transition active:scale-95 ${
                    wide ? 'flex-[1.5] text-xs' : 'flex-1'
                  } ${bg}`}
                  aria-label={k === 'back' ? 'Backspace' : k}
                >
                  {k === 'back' ? '⌫' : k === 'enter' ? t('wordle.enter') : k}
                </button>
              );
            })}
          </div>
        ))}
      </div>

      {/* Result modal */}
      {showResult && status !== 'playing' && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-slate-900/40 p-6 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-3xl bg-white p-6 text-center text-slate-900 shadow-2xl ring-1 ring-black/5">
            <div className="text-4xl">{status === 'won' ? '🎉' : '😅'}</div>
            <h2 className="font-cyber mt-2 text-2xl">
              {status === 'won' ? t('wordle.won') : t('wordle.lost')}
            </h2>
            <p className="mt-1 text-slate-500">
              {t('wordle.answer')}: <span className="font-bold uppercase tracking-widest text-slate-800">{answer}</span>
            </p>

            {/* Stats (daily only) */}
            {mode === 'daily' && (
              <div className="mt-4">
                <div className="grid grid-cols-4 gap-1 text-center">
                  {[
                    [stats.played, t('wordle.played')],
                    [winRate, t('wordle.winRate')],
                    [stats.streak, t('wordle.streak')],
                    [stats.maxStreak, t('wordle.maxStreak')],
                  ].map(([v, label], i) => (
                    <div key={i}>
                      <div className="text-xl font-bold tabular-nums">{v}</div>
                      <div className="text-[10px] leading-tight text-slate-500">{label}</div>
                    </div>
                  ))}
                </div>

                <div className="mt-4 text-left text-xs font-semibold text-slate-500">
                  {t('wordle.distribution')}
                </div>
                <div className="mt-1 flex flex-col gap-1">
                  {stats.dist.map((count, i) => {
                    const isThis = status === 'won' && guesses.length === i + 1;
                    return (
                      <div key={i} className="flex items-center gap-2 text-xs">
                        <span className="w-3 text-slate-500">{i + 1}</span>
                        <div className="flex-1">
                          <div
                            className={`flex h-5 items-center justify-end rounded px-1.5 font-bold text-white ${
                              isThis ? 'bg-green-500' : 'bg-slate-400'
                            }`}
                            style={{ width: `${Math.max(8, (count / maxDist) * 100)}%` }}
                          >
                            {count}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <p className="mt-3 text-xs text-slate-400">{t('wordle.dailyDone')}</p>
              </div>
            )}

            <div className="mt-5 flex justify-center gap-2">
              <button onClick={onShare} className="rounded-xl bg-brand px-4 py-2 font-semibold text-white">
                {t('wordle.share')}
              </button>
              {mode === 'practice' ? (
                <button
                  onClick={startPractice}
                  className="rounded-xl bg-slate-100 px-4 py-2 font-semibold text-slate-700"
                >
                  {t('wordle.again')}
                </button>
              ) : (
                <button
                  onClick={() => setMode('practice')}
                  className="rounded-xl bg-slate-100 px-4 py-2 font-semibold text-slate-700"
                >
                  {t('wordle.practiceMore')}
                </button>
              )}
            </div>
            {shareMsg && <p className="mt-3 text-sm text-accent">{shareMsg}</p>}

            <button
              onClick={() => setShowResult(false)}
              className="mt-4 text-xs text-slate-400 underline"
            >
              {t('nav.back')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
