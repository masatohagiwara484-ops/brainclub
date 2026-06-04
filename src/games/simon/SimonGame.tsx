import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { GameProps } from '../types';
import { getSetting, setSetting } from '../../lib/storage';
import { fx } from '../../lib/fx';
import { sound } from '../../lib/sound';
import { recordPlay, clamp01 } from '../../lib/synapse';
import { getGame } from '../registry';
import ProgressResultModal from '../../components/ProgressResultModal';
import { useShareMsg } from '../shareHook';

const AXES = getGame('simon')?.axes ?? {};
const BEST_KEY = 'simon.best'; // longest sequence repeated
const PADS = [
  { hex: '#22c55e', tone: 392 }, // G
  { hex: '#ef4444', tone: 523 }, // C
  { hex: '#3b82f6', tone: 659 }, // E
  { hex: '#eab308', tone: 784 }, // G
];

type Phase = 'idle' | 'play' | 'input' | 'over';

export default function SimonGame(_: GameProps) {
  const { t } = useTranslation();
  const { shareMsg, doShare } = useShareMsg();
  const [phase, setPhase] = useState<Phase>('idle');
  const [seq, setSeq] = useState<number[]>([]);
  const [active, setActive] = useState<number | null>(null);
  const [best, setBest] = useState(() => getSetting<number>(BEST_KEY, 0));
  const [levelUp, setLevelUp] = useState<string | null>(null);
  const inputIdx = useRef(0);
  const timers = useRef<number[]>([]);

  const clearTimers = () => {
    timers.current.forEach((id) => window.clearTimeout(id));
    timers.current = [];
  };

  const flash = useCallback((pad: number, tone = true) => {
    setActive(pad);
    if (tone) sound.playNote(PADS[pad].tone, 0.18);
    const id = window.setTimeout(() => setActive(null), 320);
    timers.current.push(id);
  }, []);

  const playback = useCallback(
    (s: number[]) => {
      setPhase('play');
      clearTimers();
      s.forEach((pad, i) => {
        const id = window.setTimeout(() => {
          flash(pad);
          if (i === s.length - 1) {
            const done = window.setTimeout(() => {
              inputIdx.current = 0;
              setPhase('input');
            }, 480);
            timers.current.push(done);
          }
        }, 600 * i + 300);
        timers.current.push(id);
      });
    },
    [flash],
  );

  const nextRound = useCallback(
    (prev: number[]) => {
      const s = [...prev, Math.floor(Math.random() * 4)];
      setSeq(s);
      playback(s);
    },
    [playback],
  );

  const start = useCallback(() => {
    setLevelUp(null);
    nextRound([]);
  }, [nextRound]);

  const end = useCallback(
    (score: number) => {
      setPhase('over');
      const prev = getSetting<number>(BEST_KEY, 0);
      if (score > prev) {
        setBest(score);
        setSetting(BEST_KEY, score);
      }
      const res = recordPlay({ gameId: 'simon', axes: AXES, quality: clamp01(0.12 + score * 0.07), weight: 1.2 });
      setLevelUp(score > prev && score > 0 && res.leveledUp ? t('synapse.levelUp', { n: res.newLevel }) : null);
    },
    [t],
  );

  const tap = (pad: number) => {
    if (phase !== 'input') return;
    flash(pad);
    if (pad === seq[inputIdx.current]) {
      inputIdx.current += 1;
      if (inputIdx.current === seq.length) {
        fx.correct({ streak: seq.length });
        window.setTimeout(() => nextRound(seq), 620);
      }
    } else {
      fx.wrong();
      end(seq.length - 1);
    }
  };

  useEffect(() => () => clearTimers(), []);

  const score = Math.max(0, seq.length - (phase === 'over' ? 1 : 0));

  return (
    <div className="flex h-full flex-col items-center px-4 py-3">
      <div className="flex w-full max-w-md items-center justify-between text-sm">
        <span className="font-semibold tabular-nums text-slate-700">
          {t('simon.round')} {seq.length}
        </span>
        <span className="text-xs font-semibold tabular-nums text-slate-400">🏆 {best}</span>
      </div>

      {phase === 'idle' ? (
        <div className="flex flex-1 flex-col items-center justify-center text-center">
          <div className="text-5xl">🎶</div>
          <h2 className="font-cyber mt-3 text-2xl">{t('games.simon.name')}</h2>
          <p className="mt-2 max-w-xs text-sm text-slate-500">{t('simon.howto')}</p>
          <button onClick={start} className="mt-6 rounded-2xl bg-brand px-8 py-3 text-lg font-bold text-white shadow-lg active:scale-95">
            {t('simon.start')}
          </button>
        </div>
      ) : (
        <div className="flex flex-1 flex-col items-center justify-center">
          <p className="mb-4 text-sm font-semibold text-slate-400">
            {phase === 'play' ? t('simon.watch') : t('simon.repeat')}
          </p>
          <div className="grid grid-cols-2 gap-3" style={{ width: 'min(82vw, 320px)' }}>
            {PADS.map((p, i) => (
              <button
                key={i}
                onClick={() => tap(i)}
                disabled={phase !== 'input'}
                className="aspect-square rounded-3xl transition-all duration-150"
                style={{
                  backgroundColor: p.hex,
                  opacity: active === i ? 1 : 0.5,
                  transform: active === i ? 'scale(0.96)' : 'scale(1)',
                  boxShadow: active === i ? `0 0 26px ${p.hex}` : 'none',
                }}
              />
            ))}
          </div>
        </div>
      )}

      {phase === 'over' && (
        <ProgressResultModal
          emoji="🎶"
          title={t('simon.gameOver')}
          subtitle={`${t('simon.reached')} ${score}`}
          celebrate={score >= best && score > 0}
          levelUp={levelUp}
          stats={[
            { value: score, label: t('simon.round') },
            { value: best, label: '🏆' },
          ]}
          actions={[
            { label: t('simon.again'), onClick: start, variant: 'primary' },
            {
              label: t('simon.share'),
              onClick: () => doShare(`BrainClub · ${t('games.simon.name')}\n🎶 ${score}\n${window.location.origin}`),
              variant: 'secondary',
            },
          ]}
          shareMsg={shareMsg}
        />
      )}
    </div>
  );
}
