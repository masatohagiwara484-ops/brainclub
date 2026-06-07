import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { GameProps } from '../types';
import { difficultyKey } from '../../lib/difficulty';
import { makeRng } from '../../lib/daily';
import { fx } from '../../lib/fx';
import { recordPlay, clamp01, XP_WEIGHT } from '../../lib/synapse';
import { getGame } from '../registry';
import GameResultScreen from '../../components/GameResultScreen';
import GameShell from '../../components/GameShell';
import { useShareMsg } from '../shareHook';

const AXES = getGame('mastermind')?.axes ?? {};
const PALETTE = ['#ef4444', '#3b82f6', '#22c55e', '#eab308', '#a855f7', '#f97316', '#06b6d4', '#ec4899'];
type Cfg = { colors: number; pegs: number; tries: number };
const CFG: Record<string, Cfg> = {
  easy: { colors: 6, pegs: 4, tries: 10 },
  medium: { colors: 6, pegs: 4, tries: 8 },
  hard: { colors: 7, pegs: 4, tries: 8 },
  expert: { colors: 8, pegs: 5, tries: 10 },
};

// Classic peg scoring: exact = right color & spot, color = right color wrong spot
// (duplicate-safe). Pure — mirrored in verify.
export function scoreGuess(secret: number[], guess: number[]): { exact: number; color: number } {
  let exact = 0;
  const sRem: number[] = [];
  const gRem: number[] = [];
  for (let i = 0; i < secret.length; i++) {
    if (guess[i] === secret[i]) exact++;
    else {
      sRem.push(secret[i]);
      gRem.push(guess[i]);
    }
  }
  const freq: Record<number, number> = {};
  for (const v of sRem) freq[v] = (freq[v] ?? 0) + 1;
  let color = 0;
  for (const v of gRem) {
    if (freq[v] > 0) {
      color++;
      freq[v]--;
    }
  }
  return { exact, color };
}

export function makeSecret(colors: number, pegs: number, rng: () => number): number[] {
  return Array.from({ length: pegs }, () => Math.floor(rng() * colors));
}

type Row = { guess: number[]; exact: number; color: number };

export default function MastermindGame({ difficulty = 'easy' }: GameProps) {
  const { t } = useTranslation();
  const { shareMsg, doShare } = useShareMsg();
  const cfg = CFG[difficulty];

  const [seed, setSeed] = useState(() => (Date.now() ^ Math.floor(Math.random() * 1e9)) >>> 0);
  const secret = useMemo(() => makeSecret(cfg.colors, cfg.pegs, makeRng(seed)), [cfg, seed]);
  const [rows, setRows] = useState<Row[]>([]);
  const [cur, setCur] = useState<number[]>(() => Array<number>(cfg.pegs).fill(-1));
  const [status, setStatus] = useState<'play' | 'won' | 'lost'>('play');
  const [levelUp, setLevelUp] = useState<string | null>(null);

  const restart = useCallback(() => {
    setSeed((Date.now() ^ Math.floor(Math.random() * 1e9)) >>> 0);
    setRows([]);
    setCur(Array<number>(cfg.pegs).fill(-1));
    setStatus('play');
    setLevelUp(null);
  }, [cfg.pegs]);

  const activeSlot = cur.indexOf(-1);
  const full = activeSlot === -1;

  const pick = (color: number) => {
    if (status !== 'play' || full) return;
    const c = cur.slice();
    c[activeSlot] = color;
    setCur(c);
    fx.tick();
  };
  const clearSlot = (i: number) => {
    if (status !== 'play') return;
    const c = cur.slice();
    c[i] = -1;
    setCur(c);
  };

  const submit = () => {
    if (status !== 'play' || !full) return;
    const { exact, color } = scoreGuess(secret, cur);
    const nrows = [...rows, { guess: cur.slice(), exact, color }];
    setRows(nrows);
    setCur(Array<number>(cfg.pegs).fill(-1));
    if (exact === cfg.pegs) {
      setStatus('won');
      const perf = clamp01((cfg.tries - nrows.length + 1) / cfg.tries);
      const res = recordPlay({ gameId: 'mastermind', axes: AXES, quality: clamp01(0.4 + 0.5 * perf), weight: XP_WEIGHT[difficulty] });
      setLevelUp(res.leveledUp ? t('synapse.levelUp', { n: res.newLevel }) : null);
    } else if (nrows.length >= cfg.tries) {
      setStatus('lost');
      recordPlay({ gameId: 'mastermind', axes: AXES, quality: 0.2, weight: XP_WEIGHT[difficulty] });
    } else {
      fx.correct({ streak: exact });
    }
  };

  const pegDot = (i: number, n: number, cls: string) =>
    Array.from({ length: n }, (_, k) => <span key={`${i}-${k}`} className={`h-2.5 w-2.5 rounded-full ${cls}`} />);

  return (
    <GameShell
      difficulty={difficulty}
      stat={
        <>
          {rows.length}/{cfg.tries}
        </>
      }
      action={<span className="text-xs font-semibold text-white/60">🎯 {cfg.pegs}</span>}
      scroll={false}
    >
      <div className="mt-3 flex w-full max-w-xs min-h-0 flex-1 flex-col gap-1.5 overflow-y-auto">
        {rows.map((r, i) => (
          <div key={i} className="flex items-center justify-between rounded-xl bg-white/[0.05] px-3 py-1.5 ring-1 ring-white/8">
            <div className="flex gap-1.5">
              {r.guess.map((g, k) => (
                <span key={k} className="h-6 w-6 rounded-full" style={{ backgroundColor: PALETTE[g] }} />
              ))}
            </div>
            {/* Feedback pegs in ONE horizontal row (exact → color → empty) so
                the player can read how many are matched at a glance. */}
            <div className="flex items-center gap-1">
              {pegDot(i, r.exact, 'bg-white')}
              {pegDot(i, r.color, 'bg-white/50')}
              {pegDot(i, cfg.pegs - r.exact - r.color, 'bg-white/15')}
            </div>
          </div>
        ))}

        {status === 'play' && (
          <div className="mt-1 flex items-center justify-center gap-1.5">
            {cur.map((g, i) => (
              <button
                key={i}
                onClick={() => clearSlot(i)}
                className={`h-8 w-8 rounded-full border-2 ${
                  g >= 0 ? 'border-transparent' : 'border-dashed border-white/30'
                } ${i === activeSlot ? 'ring-2 ring-accent-cyan' : ''}`}
                style={g >= 0 ? { backgroundColor: PALETTE[g] } : undefined}
              />
            ))}
          </div>
        )}
      </div>

      {status === 'play' && (
        <div className="w-full max-w-md pt-2">
          <div className="mb-2 flex flex-wrap justify-center gap-2">
            {PALETTE.slice(0, cfg.colors).map((hex, i) => (
              <button
                key={i}
                onClick={() => pick(i)}
                className="h-10 w-10 rounded-full shadow active:scale-90"
                style={{ backgroundColor: hex }}
                aria-label={`color ${i + 1}`}
              />
            ))}
          </div>
          <button
            onClick={submit}
            disabled={!full}
            className="w-full rounded-2xl bg-gradient-to-r from-primary to-accent-cyan py-3 font-bold text-white shadow-premium disabled:opacity-40"
          >
            {t('mastermind.guess')}
          </button>
        </div>
      )}

      {status !== 'play' && (
        <GameResultScreen
          emoji={status === 'won' ? '🎯' : '🔓'}
          title={status === 'won' ? t('mastermind.won') : t('mastermind.lost')}
          celebrate={status === 'won'}
          levelUp={levelUp}
          stats={[
            { value: rows.length, label: t('mastermind.guesses') },
            { value: cfg.tries, label: t('mastermind.tries') },
          ]}
          actions={[
            { label: t('mastermind.again'), onClick: restart, variant: 'primary' },
            {
              label: t('mastermind.share'),
              onClick: () =>
                doShare(`BrainClub · ${t('games.mastermind.name')} (${t(difficultyKey(difficulty))})\n🎯 ${status === 'won' ? rows.length : 'X'}/${cfg.tries}\n${window.location.origin}`),
              variant: 'secondary',
            },
          ]}
          shareMsg={shareMsg}
        >
          <div className="mt-1 flex justify-center gap-1.5">
            {secret.map((s, i) => (
              <span key={i} className="h-6 w-6 rounded-full" style={{ backgroundColor: PALETTE[s] }} />
            ))}
          </div>
        </GameResultScreen>
      )}
    </GameShell>
  );
}
