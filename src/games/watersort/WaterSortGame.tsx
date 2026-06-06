import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import {
  CAPACITY,
  PALETTE,
  makeLevel,
  pour,
  canPour,
  isSolved,
  type State,
} from './waterSort';
import { difficultyKey, DIFFICULTY_STYLE, type Difficulty } from '../../lib/difficulty';
import type { GameProps } from '../types';
import { haptics } from '../../lib/haptics';
import { recordPlay, difficultyQuality, clamp01, XP_WEIGHT } from '../../lib/synapse';
import { getGame } from '../registry';
import GameResultScreen from '../../components/GameResultScreen';

const AXES = getGame('watersort')?.axes ?? {};
// Target move counts per difficulty — solving in fewer moves nudges quality up.
const TARGET: Record<Difficulty, number> = { easy: 25, medium: 50, hard: 90, expert: 140 };

export default function WaterSortGame({ difficulty = 'easy' }: GameProps) {
  const { t } = useTranslation();

  const [initial, setInitial] = useState<State>([]);
  const [tubes, setTubes] = useState<State>([]);
  const [selected, setSelected] = useState<number | null>(null);
  const [history, setHistory] = useState<State[]>([]);
  const [moves, setMoves] = useState(0);
  const [won, setWon] = useState(false);
  const [levelUp, setLevelUp] = useState<string | null>(null);
  const [shareMsg, setShareMsg] = useState<string | null>(null);

  const newLevel = useCallback(() => {
    const { tubes: t0 } = makeLevel(difficulty);
    setInitial(t0.map((x) => x.slice()));
    setTubes(t0.map((x) => x.slice()));
    setSelected(null);
    setHistory([]);
    setMoves(0);
    setWon(false);
    setLevelUp(null);
  }, [difficulty]);

  useEffect(() => {
    newLevel();
  }, [newLevel]);

  const restart = () => {
    setTubes(initial.map((x) => x.slice()));
    setSelected(null);
    setHistory([]);
    setMoves(0);
    setWon(false);
    setLevelUp(null);
  };

  const undo = () => {
    if (won || history.length === 0) return;
    setHistory((h) => {
      const prev = h[h.length - 1];
      setTubes(prev.map((x) => x.slice()));
      setMoves((m) => Math.max(0, m - 1));
      return h.slice(0, -1);
    });
    setSelected(null);
  };

  const onTube = (i: number) => {
    if (won) return;
    if (selected == null) {
      if (tubes[i].length > 0) setSelected(i);
      return;
    }
    if (selected === i) {
      setSelected(null);
      return;
    }
    if (canPour(tubes, selected, i)) {
      const next = pour(tubes, selected, i);
      setHistory((h) => [...h, tubes.map((x) => x.slice())]);
      setTubes(next);
      setMoves((m) => m + 1);
      setSelected(null);
      haptics.tick();
      if (isSolved(next)) {
        setWon(true);
        // The win celebration is fired centrally by the result modal on open.
        const finalMoves = moves + 1;
        const perf = clamp01((TARGET[difficulty] - finalMoves) / TARGET[difficulty]);
        const res = recordPlay({
          gameId: 'watersort',
          axes: AXES,
          quality: difficultyQuality(difficulty, perf),
          weight: XP_WEIGHT[difficulty],
        });
        setLevelUp(res.leveledUp ? t('synapse.levelUp', { n: res.newLevel }) : null);
      }
    } else {
      // Re-select the tapped tube if it has liquid, else clear.
      setSelected(tubes[i].length > 0 ? i : null);
    }
  };

  const onShare = async () => {
    const text = `BrainClub · ${t('games.watersort.name')} (${t(difficultyKey(difficulty))})\n🧪 ${moves} ${t(
      'watersort.moves',
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

  return (
    <div className="flex h-full flex-col items-center overflow-y-auto px-4 py-3">
      {/* Header */}
      <div className="flex w-full max-w-md items-center justify-between text-sm">
        <span
          className="font-dot rounded-lg px-2 py-1 text-xs font-bold text-white"
          style={{ backgroundColor: DIFFICULTY_STYLE[difficulty].color }}
        >
          {t(difficultyKey(difficulty))}
        </span>
        <span className="font-semibold tabular-nums text-slate-700">
          {moves} {t('watersort.moves')}
        </span>
        <button
          onClick={newLevel}
          className="rounded-xl bg-slate-100 px-3 py-1.5 font-semibold text-slate-700 shadow-sm hover:bg-slate-200 active:scale-95"
        >
          {t('watersort.newGame')}
        </button>
      </div>

      {/* Tubes */}
      <div className="mt-6 flex flex-1 flex-wrap items-center justify-center gap-3 sm:gap-4">
        {tubes.map((tube, i) => (
          <Tube
            key={i}
            tube={tube}
            selected={selected === i}
            onClick={() => onTube(i)}
          />
        ))}
      </div>

      {/* Controls */}
      <div className="mt-4 flex flex-wrap justify-center gap-2">
        <Btn onClick={undo}>{t('watersort.undo')}</Btn>
        <Btn onClick={restart}>{t('watersort.restart')}</Btn>
      </div>

      {/* Win modal */}
      {won && (
        <GameResultScreen
          emoji="🎉"
          title={t('watersort.solved')}
          subtitle={
            <>
              {t(difficultyKey(difficulty))} · {moves} {t('watersort.moves')}
            </>
          }
          levelUp={levelUp}
          actions={[
            { label: t('watersort.share'), onClick: onShare, variant: 'primary' },
            { label: t('watersort.again'), onClick: newLevel, variant: 'secondary' },
          ]}
          shareMsg={shareMsg}
        />
      )}
    </div>
  );
}

// A glass tube rendered as stacked color segments (bottom→top).
function Tube({
  tube,
  selected,
  onClick,
}: {
  tube: number[];
  selected: boolean;
  onClick: () => void;
}) {
  const segH = 100 / CAPACITY; // % height per unit
  return (
    <button
      onClick={onClick}
      className={`relative flex w-12 flex-col-reverse overflow-hidden rounded-b-2xl rounded-t-md border-2 bg-white/60 transition sm:w-14 ${
        selected ? '-translate-y-3 border-brand shadow-lg' : 'border-slate-300'
      }`}
      style={{ height: 160 }}
      aria-label="tube"
    >
      {tube.map((c, k) => (
        <span
          key={k}
          className="block w-full"
          style={{ height: `${segH}%`, backgroundColor: PALETTE[c] }}
        />
      ))}
    </button>
  );
}

function Btn({ children, onClick }: { children: ReactNode; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="rounded-xl bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-200 active:scale-95"
    >
      {children}
    </button>
  );
}
