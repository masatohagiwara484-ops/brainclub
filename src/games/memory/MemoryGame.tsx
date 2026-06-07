import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { GameProps } from '../types';
import { difficultyKey } from '../../lib/difficulty';
import { getSetting, setSetting } from '../../lib/storage';
import { makeRng } from '../../lib/daily';
import { fx } from '../../lib/fx';
import { recordPlay, clamp01, XP_WEIGHT } from '../../lib/synapse';
import { getGame } from '../registry';
import GameResultScreen from '../../components/GameResultScreen';
import GameShell from '../../components/GameShell';
import { useShareMsg } from '../shareHook';
import MemoryGlyph from './MemoryGlyphs';

const AXES = getGame('memory')?.axes ?? {};
const PAIRS: Record<string, number> = { easy: 6, medium: 8, hard: 10, expert: 12 };
// A "clear time" target (seconds) per difficulty — beating it lifts quality.
const PAR_SECONDS: Record<string, number> = { easy: 18, medium: 28, hard: 42, expert: 60 };

// How long the opening flash shows every card before it flips away. A touch
// longer when there are more cards to memorize.
function previewMs(pairs: number): number {
  return Math.min(1600, 700 + pairs * 70);
}

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
  const bestKey = `memory.bestTime.${difficulty}`; // fastest clear time (seconds)
  const cols = 4;

  const [seed, setSeed] = useState(() => (Date.now() ^ Math.floor(Math.random() * 1e9)) >>> 0);
  const deck = useMemo(() => makeDeck(pairs, makeRng(seed)), [pairs, seed]);
  const [matched, setMatched] = useState<Set<number>>(new Set());
  const [flipped, setFlipped] = useState<number[]>([]);
  const [moves, setMoves] = useState(0);
  const [busy, setBusy] = useState(false);
  // 'preview' = the opening flash, 'play' = interactive.
  const [phase, setPhase] = useState<'preview' | 'play'>('preview');
  const [elapsed, setElapsed] = useState(0);
  const [best, setBest] = useState(() => getSetting<number>(bestKey, 0));
  const [isBest, setIsBest] = useState(false);
  const [levelUp, setLevelUp] = useState<string | null>(null);
  const lock = useRef(false);
  const startRef = useRef(0);

  const restart = useCallback(() => {
    setSeed((Date.now() ^ Math.floor(Math.random() * 1e9)) >>> 0);
    setMatched(new Set());
    setFlipped([]);
    setMoves(0);
    setBusy(false);
    setIsBest(false);
    setLevelUp(null);
    setElapsed(0);
    setPhase('preview');
    lock.current = false;
  }, []);

  const won = matched.size === deck.length && deck.length > 0;

  // Opening flash: show every card, then flip them down and start the clock.
  useEffect(() => {
    setPhase('preview');
    const id = window.setTimeout(() => {
      setPhase('play');
      startRef.current = Date.now();
      setElapsed(0);
    }, previewMs(pairs));
    return () => window.clearTimeout(id);
  }, [seed, pairs]);

  // Tick the clock while playing.
  useEffect(() => {
    if (phase !== 'play' || won) return;
    const id = window.setInterval(() => setElapsed((Date.now() - startRef.current) / 1000), 100);
    return () => window.clearInterval(id);
  }, [phase, won]);

  useEffect(() => {
    if (!won) return;
    const secs = Math.round(((Date.now() - startRef.current) / 1000) * 10) / 10;
    setElapsed(secs);
    const prev = getSetting<number>(bestKey, 0);
    const better = prev === 0 || secs < prev;
    if (better) {
      setBest(secs);
      setSetting(bestKey, secs);
    }
    setIsBest(better);
    // Faster than par = higher quality; fewer wasted moves nudges it too.
    const timePerf = clamp01(PAR_SECONDS[difficulty] / Math.max(1, secs));
    const movePerf = clamp01(pairs / Math.max(1, moves));
    const res = recordPlay({
      gameId: 'memory',
      axes: AXES,
      quality: clamp01(0.25 + 0.45 * timePerf + 0.2 * movePerf),
      weight: XP_WEIGHT[difficulty],
    });
    setLevelUp(res.leveledUp ? t('synapse.levelUp', { n: res.newLevel }) : null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [won]);

  const flip = (i: number) => {
    if (phase !== 'play' || lock.current || busy || flipped.includes(i) || matched.has(i)) return;
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

  const preview = phase === 'preview';

  return (
    <GameShell
      difficulty={difficulty}
      stat={<>⏱ {elapsed.toFixed(1)}s</>}
      action={<span className="text-xs font-semibold tabular-nums text-white/60">🏆 {best ? `${best}s` : '—'}</span>}
    >
      <div className="flex flex-1 flex-col items-center justify-center">
        {preview && (
          <p className="mb-3 text-sm font-semibold uppercase tracking-wide text-accent-cyan">
            {t('memory.memorize')}
          </p>
        )}
        <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0,1fr))`, width: 'min(88vw, 380px)' }}>
          {deck.map((face, i) => {
            const open = preview || flipped.includes(i) || matched.has(i);
            return (
              <button
                key={i}
                onClick={() => flip(i)}
                className={`grid aspect-square place-items-center rounded-xl p-2 transition active:scale-95 ${
                  open ? 'bg-slate-800/70 ring-2 ring-accent-cyan/40' : 'bg-gradient-to-br from-primary to-indigo-700'
                } ${matched.has(i) ? 'opacity-50' : ''}`}
              >
                <MemoryGlyph index={face} className={`h-full w-full ${open ? '' : 'opacity-0'}`} />
              </button>
            );
          })}
        </div>
        <p className="mt-3 text-xs tabular-nums text-white/40">
          {moves} {t('memory.moves')}
        </p>
      </div>

      {won && (
        <GameResultScreen
          emoji={isBest ? '🏆' : '🧠'}
          title={isBest ? t('memory.newBest') : t('memory.solved')}
          isNewBest={isBest}
          celebrate
          levelUp={levelUp}
          stats={[
            { value: `${elapsed.toFixed(1)}s`, label: '⏱' },
            { value: `${best || elapsed.toFixed(1)}s`, label: '🏆' },
            { value: moves, label: t('memory.moves') },
          ]}
          actions={[
            { label: t('memory.again'), onClick: restart, variant: 'primary' },
            {
              label: t('memory.share'),
              onClick: () =>
                doShare(`BrainClub · ${t('games.memory.name')} (${t(difficultyKey(difficulty))})\n🧠 ${elapsed.toFixed(1)}s · ${moves} ${t('memory.moves')}\n${window.location.origin}`),
              variant: 'secondary',
            },
          ]}
          shareMsg={shareMsg}
        />
      )}
    </GameShell>
  );
}
