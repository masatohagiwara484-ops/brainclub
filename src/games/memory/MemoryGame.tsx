import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { GameProps } from '../types';
import { difficultyKey, DIFFICULTY_STYLE } from '../../lib/difficulty';
import { getSetting, setSetting } from '../../lib/storage';
import { makeRng } from '../../lib/daily';
import { fx } from '../../lib/fx';
import { recordPlay, clamp01, XP_WEIGHT } from '../../lib/synapse';
import { getGame } from '../registry';
import ProgressResultModal from '../../components/ProgressResultModal';
import { useShareMsg } from '../shareHook';

const AXES = getGame('memory')?.axes ?? {};
const PAIRS: Record<string, number> = { easy: 6, medium: 8, hard: 10, expert: 12 };
const FACES = ['🍎', '🍋', '🍇', '🍑', '🍓', '🥝', '🍉', '🍒', '🥥', '🍍', '🥕', '🌽'];

// A shuffled deck where every face appears exactly twice (pure; mirrored in verify).
export function makeDeck(pairs: number, rng: () => number): number[] {
  const deck: number[] = [];
  for (let i = 0; i < pairs; i++) deck.push(i, i);
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

export default function MemoryGame({ difficulty = 'easy' }: GameProps) {
  const { t } = useTranslation();
  const { shareMsg, doShare } = useShareMsg();
  const pairs = PAIRS[difficulty];
  const bestKey = `memory.best.${difficulty}`; // fewest moves
  const cols = pairs <= 6 ? 4 : pairs <= 8 ? 4 : pairs <= 10 ? 4 : 4;

  const [seed, setSeed] = useState(() => (Date.now() ^ Math.floor(Math.random() * 1e9)) >>> 0);
  const deck = useMemo(() => makeDeck(pairs, makeRng(seed)), [pairs, seed]);
  const [matched, setMatched] = useState<Set<number>>(new Set());
  const [flipped, setFlipped] = useState<number[]>([]);
  const [moves, setMoves] = useState(0);
  const [busy, setBusy] = useState(false);
  const [best, setBest] = useState(() => getSetting<number>(bestKey, 0));
  const [isBest, setIsBest] = useState(false);
  const [levelUp, setLevelUp] = useState<string | null>(null);
  const lock = useRef(false);

  const restart = useCallback(() => {
    setSeed((Date.now() ^ Math.floor(Math.random() * 1e9)) >>> 0);
    setMatched(new Set());
    setFlipped([]);
    setMoves(0);
    setBusy(false);
    setIsBest(false);
    setLevelUp(null);
    lock.current = false;
  }, []);

  const won = matched.size === deck.length && deck.length > 0;

  useEffect(() => {
    if (!won) return;
    fx.win();
    const prev = getSetting<number>(bestKey, 0);
    const better = prev === 0 || moves < prev;
    if (better) {
      setBest(moves);
      setSetting(bestKey, moves);
    }
    setIsBest(better);
    // Fewer wasted moves = higher quality. Perfect = pairs moves.
    const perf = clamp01(pairs / Math.max(1, moves));
    const res = recordPlay({ gameId: 'memory', axes: AXES, quality: clamp01(0.3 + 0.6 * perf), weight: XP_WEIGHT[difficulty] });
    setLevelUp(res.leveledUp ? t('synapse.levelUp', { n: res.newLevel }) : null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [won]);

  const flip = (i: number) => {
    if (lock.current || busy || flipped.includes(i) || matched.has(i)) return;
    const nf = [...flipped, i];
    setFlipped(nf);
    if (nf.length === 2) {
      setMoves((m) => m + 1);
      lock.current = true;
      setBusy(true);
      const [a, b] = nf;
      if (deck[a] === deck[b]) {
        fx.correct({ streak: matched.size / 2 + 1 });
        window.setTimeout(() => {
          setMatched((prev) => new Set(prev).add(a).add(b));
          setFlipped([]);
          setBusy(false);
          lock.current = false;
        }, 360);
      } else {
        window.setTimeout(() => {
          setFlipped([]);
          setBusy(false);
          lock.current = false;
        }, 760);
      }
    } else {
      fx.tick();
    }
  };

  return (
    <div className="flex h-full flex-col items-center px-4 py-3">
      <div className="flex w-full max-w-md items-center justify-between text-sm">
        <span
          className="font-dot rounded-lg px-2 py-1 text-xs font-bold text-white"
          style={{ backgroundColor: DIFFICULTY_STYLE[difficulty].color }}
        >
          {t(difficultyKey(difficulty))}
        </span>
        <span className="font-semibold tabular-nums text-slate-700">
          {moves} {t('memory.moves')}
        </span>
        <span className="text-xs font-semibold tabular-nums text-slate-400">🏆 {best || '—'}</span>
      </div>

      <div className="flex flex-1 items-center justify-center">
        <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0,1fr))`, width: 'min(88vw, 380px)' }}>
          {deck.map((face, i) => {
            const open = flipped.includes(i) || matched.has(i);
            return (
              <button
                key={i}
                onClick={() => flip(i)}
                className={`grid aspect-square place-items-center rounded-xl text-2xl transition active:scale-95 ${
                  open ? 'bg-white ring-2 ring-brand/40' : 'bg-brand text-transparent'
                } ${matched.has(i) ? 'opacity-50' : ''}`}
              >
                <span className={open ? '' : 'opacity-0'}>{FACES[face]}</span>
              </button>
            );
          })}
        </div>
      </div>

      {won && (
        <ProgressResultModal
          emoji={isBest ? '🏆' : '🧠'}
          title={isBest ? t('memory.newBest') : t('memory.solved')}
          celebrate
          levelUp={levelUp}
          stats={[
            { value: moves, label: t('memory.moves') },
            { value: best || moves, label: '🏆' },
            { value: pairs, label: t('memory.pairs') },
          ]}
          actions={[
            { label: t('memory.again'), onClick: restart, variant: 'primary' },
            {
              label: t('memory.share'),
              onClick: () =>
                doShare(`BrainClub · ${t('games.memory.name')} (${t(difficultyKey(difficulty))})\n🧠 ${moves} ${t('memory.moves')}\n${window.location.origin}`),
              variant: 'secondary',
            },
          ]}
          shareMsg={shareMsg}
        />
      )}
    </div>
  );
}
