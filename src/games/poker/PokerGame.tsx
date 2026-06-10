import { useEffect, useReducer, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { GameProps } from '../types';
import { difficultyKey, DIFFICULTY_STYLE } from '../../lib/difficulty';
import { makeRng } from '../../lib/daily';
import { fx } from '../../lib/fx';
import { haptics } from '../../lib/haptics';
import { recordPlay, difficultyQuality, clamp01, XP_WEIGHT } from '../../lib/synapse';
import { getGame } from '../registry';
import { submitScore } from '../../lib/leaderboard';
import GameResultScreen from '../../components/GameResultScreen';
import { useShareMsg } from '../shareHook';
import { evaluate7, HAND_NAMES, type Card } from './pokerEval';
import {
  aiDecide,
  applyAction,
  createGame,
  legalActions,
  reckon,
  startHand,
  type Action,
  type State,
} from './pokerEngine';

const AXES = getGame('poker')?.axes ?? {};
const START_STACK = 1000;
const BIG_BLIND = 20;

const RANKS: Record<number, string> = { 11: 'J', 12: 'Q', 13: 'K', 14: 'A' };
const SUITS = ['♠', '♥', '♦', '♣'];
const rankLabel = (r: number) => RANKS[r] ?? String(r);

function CardView({ card, hidden, small }: { card?: Card; hidden?: boolean; small?: boolean }) {
  const size = small ? 'h-10 w-7 text-xs' : 'h-14 w-10 text-sm';
  if (hidden || !card) {
    return <div className={`grid ${size} place-items-center rounded-md bg-gradient-to-br from-indigo-600 to-indigo-900 ring-1 ring-white/20`}><span className="text-white/40">✦</span></div>;
  }
  const red = card.s === 1 || card.s === 2;
  return (
    <div className={`flex ${size} flex-col items-center justify-center rounded-md bg-white font-bold shadow ring-1 ring-black/10 ${red ? 'text-rose-600' : 'text-slate-900'}`}>
      <span className="leading-none">{rankLabel(card.r)}</span>
      <span className="leading-none">{SUITS[card.s]}</span>
    </div>
  );
}

export default function PokerGame({ difficulty = 'medium' }: GameProps) {
  const { t } = useTranslation();
  const { shareMsg, doShare } = useShareMsg();
  const rngRef = useRef<() => number>(makeRng((Date.now() ^ Math.floor(Math.random() * 1e9)) >>> 0));
  const sRef = useRef<State | null>(null);
  const [, force] = useReducer((x: number) => x + 1, 0);
  const [over, setOver] = useState<{ humanWon: boolean } | null>(null);
  const [levelUp, setLevelUp] = useState<string | null>(null);
  const timers = useRef<number[]>([]);
  const recordedRef = useRef(false);
  useEffect(() => () => timers.current.forEach((id) => clearTimeout(id)), []);

  // Lazily create + start the first hand.
  if (!sRef.current) {
    const s = createGame(rngRef.current, START_STACK, BIG_BLIND);
    startHand(s, rngRef.current);
    sRef.current = s;
  }
  const s = sRef.current;

  const endTournament = (humanWon: boolean) => {
    setOver({ humanWon });
  };

  const nextHand = () => {
    const w = reckon(s);
    if (w === 0) return endTournament(true); // human is last standing
    if (w !== null) return endTournament(false); // someone else is last standing
    if (s.players[0].out) return endTournament(false); // human busted out
    startHand(s, rngRef.current);
    force();
  };

  // Drive the AI seats.
  useEffect(() => {
    if (over || !sRef.current) return;
    const st = sRef.current;
    if (st.stage === 'handover' || st.stage === 'showdown') return;
    if (st.toAct !== 0) {
      const id = window.setTimeout(() => {
        const a = aiDecide(st, st.toAct, difficulty, rngRef.current);
        applyAction(st, st.toAct, a);
        if (st.lastAction === 'raise' || st.lastAction === 'call') haptics.tick();
        force();
      }, 720);
      timers.current.push(id);
      return () => clearTimeout(id);
    }
  });

  // Record once when the tournament ends.
  useEffect(() => {
    if (!over || recordedRef.current) return;
    recordedRef.current = true;
    const chips = s.players[0].stack;
    void submitScore('poker', difficulty, chips, { chips });
    const quality = over.humanWon ? difficultyQuality(difficulty, 0.9) : clamp01((chips / (START_STACK * 4)) * 0.5);
    const res = recordPlay({ gameId: 'poker', axes: AXES, quality, weight: XP_WEIGHT[difficulty] });
    setLevelUp(over.humanWon && res.leveledUp ? t('synapse.levelUp', { n: res.newLevel }) : null);
    if (over.humanWon) fx.correct({ streak: 4 });
  }, [over, difficulty, t, s.players]);

  const newGame = () => {
    timers.current.forEach((id) => clearTimeout(id));
    timers.current = [];
    rngRef.current = makeRng((Date.now() ^ Math.floor(Math.random() * 1e9)) >>> 0);
    const ns = createGame(rngRef.current, START_STACK, BIG_BLIND);
    startHand(ns, rngRef.current);
    sRef.current = ns;
    recordedRef.current = false;
    setLevelUp(null);
    setOver(null);
    force();
  };

  // Human action helpers.
  const act = (a: Action) => {
    if (s.toAct !== 0) return;
    applyAction(s, 0, a);
    haptics.tick();
    force();
  };
  const la = s.toAct === 0 && s.stage !== 'handover' && s.stage !== 'showdown' ? legalActions(s, 0) : null;
  const pot = s.players.reduce((a, p) => a + p.total, 0);
  const raiseTo = (frac: number) => {
    if (!la) return 0;
    const target = Math.round(pot * frac) + s.currentBet;
    return Math.min(la.maxRaiseTo, Math.max(la.minRaiseTo, target));
  };

  const handName = (p: { hole: Card[] }) =>
    s.community.length >= 3 ? HAND_NAMES[evaluate7([...p.hole, ...s.community])[0]] : '';

  const awardFor = (id: number) => s.awards.filter((a) => a.winners.includes(id)).reduce((sum, a) => sum + Math.floor(a.amount / a.winners.length), 0);
  const isHandOver = s.stage === 'handover';

  return (
    <div className="relative flex h-full w-full flex-col bg-[radial-gradient(120%_100%_at_50%_0%,#0f3d2e_0%,#0e1226_62%,#05060d_100%)] text-white">
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 pb-1 pt-3 text-sm">
        <span className="font-dot rounded-lg px-2 py-1 text-xs font-bold" style={{ backgroundColor: DIFFICULTY_STYLE[difficulty].color }}>
          {t(difficultyKey(difficulty))}
        </span>
        <span className="text-xs font-semibold text-white/70">{t('poker.blinds')} {Math.floor(BIG_BLIND / 2)}/{BIG_BLIND}</span>
        <span className="text-xs font-bold tabular-nums text-amber-300">{t('poker.pot')} {pot}</span>
      </div>

      {/* Opponents */}
      <div className="flex justify-around px-2 pt-1">
        {[1, 2, 3].map((i) => {
          const p = s.players[i];
          const won = isHandOver && awardFor(i) > 0;
          return (
            <div key={i} className={`flex flex-col items-center gap-0.5 rounded-xl px-2 py-1 ${s.toAct === i && !isHandOver ? 'bg-accent-cyan/15 ring-1 ring-accent-cyan/40' : ''} ${p.out ? 'opacity-30' : ''}`}>
              <div className="flex gap-0.5">
                <CardView card={p.hole[0]} hidden={!s.reveal || p.folded} small />
                <CardView card={p.hole[1]} hidden={!s.reveal || p.folded} small />
              </div>
              <span className="text-[10px] text-white/60">
                {t('poker.bot', { n: i })} {s.button === i && <span className="text-amber-300">Ⓓ</span>}
              </span>
              <span className="text-[10px] font-bold tabular-nums text-amber-300/80">{p.stack}{won && <span className="text-emerald-400"> +{awardFor(i)}</span>}</span>
              <span className="h-3 text-[9px] text-white/50">
                {p.out ? t('poker.out') : p.folded ? t('poker.folded') : p.allIn ? t('poker.allInTag') : p.committed > 0 ? `▸${p.committed}` : ''}
              </span>
            </div>
          );
        })}
      </div>

      {/* Community + pot */}
      <div className="flex flex-1 flex-col items-center justify-center gap-2">
        <div className="flex gap-1.5">
          {[0, 1, 2, 3, 4].map((i) => (
            <CardView key={i} card={s.community[i]} hidden={!s.community[i]} />
          ))}
        </div>
        {isHandOver && (
          <p className="text-sm font-semibold text-amber-300">
            {s.awards.length > 0 && s.awards[0].winners.length > 0
              ? t('poker.winsPot', { who: s.awards[0].winners.includes(0) ? t('poker.you') : t('poker.bot', { n: s.awards[0].winners[0] }), amt: s.awards.reduce((a, w) => a + w.amount, 0) })
              : ''}
          </p>
        )}
      </div>

      {/* Human */}
      <div className={`flex flex-col items-center gap-1 ${s.toAct === 0 && !isHandOver ? '' : 'opacity-95'}`}>
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-accent-cyan">{t('poker.you')} {s.button === 0 && <span className="text-amber-300">Ⓓ</span>}</span>
          <span className="text-xs font-bold tabular-nums text-amber-300">🪙{s.players[0].stack}{isHandOver && awardFor(0) > 0 && <span className="text-emerald-400"> +{awardFor(0)}</span>}</span>
          {s.players[0].folded && !s.players[0].out && <span className="text-[10px] text-white/50">{t('poker.folded')}</span>}
        </div>
        <div className="flex gap-1.5">
          <CardView card={s.players[0].hole[0]} hidden={s.players[0].out} />
          <CardView card={s.players[0].hole[1]} hidden={s.players[0].out} />
        </div>
        {s.community.length >= 3 && !s.players[0].folded && <span className="text-[11px] text-white/55">{handName(s.players[0])}</span>}
      </div>

      {/* Action bar */}
      <div className="min-h-[88px] px-3 pb-5 pt-2">
        {isHandOver ? (
          <button onClick={nextHand} className="mx-auto block w-full max-w-xs rounded-2xl bg-gradient-to-r from-primary to-accent-cyan py-3 text-base font-bold text-white shadow-premium active:scale-95">
            {t('poker.nextHand')}
          </button>
        ) : la ? (
          <div className="flex flex-col items-center gap-2">
            <div className="flex justify-center gap-2">
              <Btn tone="fold" onClick={() => act({ type: 'fold' })}>{t('poker.fold')}</Btn>
              {la.canCheck ? (
                <Btn onClick={() => act({ type: 'check' })}>{t('poker.check')}</Btn>
              ) : (
                <Btn onClick={() => act({ type: 'call' })}>{t('poker.call')} {la.callAmount}</Btn>
              )}
            </div>
            {la.canRaise && (
              <div className="flex justify-center gap-2">
                <Btn small onClick={() => act({ type: 'raise', amount: raiseTo(0.5) })}>½ {t('poker.pot')}</Btn>
                <Btn small onClick={() => act({ type: 'raise', amount: raiseTo(1) })}>{t('poker.pot')}</Btn>
                <Btn small tone="raise" onClick={() => act({ type: 'raise', amount: la.maxRaiseTo })}>{t('poker.allIn')}</Btn>
              </div>
            )}
          </div>
        ) : (
          <p className="text-center text-sm text-white/45">{t('poker.thinking')}</p>
        )}
      </div>

      {over && (
        <GameResultScreen
          gameId="poker"
          emoji={over.humanWon ? '🏆' : '🃏'}
          title={over.humanWon ? t('poker.youWin') : t('poker.youLose')}
          celebrate={over.humanWon}
          levelUp={levelUp}
          stats={[{ value: `🪙${s.players[0].stack}`, label: t('poker.you') }]}
          actions={[
            { label: t('poker.again'), onClick: newGame, variant: 'primary' },
            { label: t('poker.share'), onClick: () => doShare(`BrainClub · ${t('games.poker.name')} (${t(difficultyKey(difficulty))})\n${over.humanWon ? '🏆 ' + t('poker.youWin') : '🃏 ' + t('poker.youLose')}\n${window.location.origin}`), variant: 'secondary' },
          ]}
          shareMsg={shareMsg}
        />
      )}
    </div>
  );
}

function Btn({ children, onClick, tone, small }: { children: React.ReactNode; onClick: () => void; tone?: 'fold' | 'raise'; small?: boolean }) {
  const base = small ? 'min-h-[44px] min-w-[72px] py-2 text-sm' : 'min-h-[48px] min-w-[96px] py-3 text-base';
  const color =
    tone === 'fold'
      ? 'bg-white/[0.08] text-white/70 ring-1 ring-white/12'
      : tone === 'raise'
        ? 'bg-gradient-to-r from-rose-500 to-amber-500 text-white'
        : 'bg-white/[0.12] text-white ring-1 ring-white/15';
  return (
    <button onClick={onClick} className={`rounded-2xl font-bold shadow-premium transition active:scale-95 ${base} ${color}`}>
      {children}
    </button>
  );
}
