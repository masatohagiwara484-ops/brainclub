import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { GameProps } from '../types';
import { difficultyKey, DIFFICULTY_STYLE, type Difficulty } from '../../lib/difficulty';
import { makeRng } from '../../lib/daily';
import { fx } from '../../lib/fx';
import { haptics } from '../../lib/haptics';
import { recordPlay, difficultyQuality, clamp01, XP_WEIGHT } from '../../lib/synapse';
import { getGame } from '../registry';
import { submitScore } from '../../lib/leaderboard';
import GameResultScreen from '../../components/GameResultScreen';
import { useShareMsg } from '../shareHook';
import {
  RULES,
  botAction,
  dealerShouldHit,
  handValue,
  isBlackjack,
  isBust,
  makeShoe,
  settle,
  type Card,
} from './blackjackEngine';

const AXES = getGame('blackjack')?.axes ?? {};
const SEATS = 4; // seat 0 = human, 1..3 = AI bots
const ROUNDS = 10;
const START_CHIPS = 500;
const MIN_BET = 10;
const BET_STEPS = [10, 25, 50, 100];

type Phase = 'bet' | 'player' | 'resolve' | 'settle' | 'over';

const RANKS = ['', 'A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
const SUITS = ['♠', '♥', '♦', '♣'];

function CardView({ card, hidden, small }: { card?: Card; hidden?: boolean; small?: boolean }) {
  const size = small ? 'h-11 w-8 text-xs' : 'h-16 w-11 text-base';
  if (hidden || !card) {
    return (
      <div className={`grid ${size} place-items-center rounded-md bg-gradient-to-br from-indigo-600 to-indigo-900 ring-1 ring-white/20`}>
        <span className="text-white/40">✦</span>
      </div>
    );
  }
  const red = card.s === 1 || card.s === 2;
  return (
    <div className={`flex ${size} flex-col items-center justify-center rounded-md bg-white font-bold shadow ring-1 ring-black/10 ${red ? 'text-rose-600' : 'text-slate-900'}`}>
      <span className="leading-none">{RANKS[card.r]}</span>
      <span className="leading-none">{SUITS[card.s]}</span>
    </div>
  );
}

function Hand({ cards, hideHole, small }: { cards: Card[]; hideHole?: boolean; small?: boolean }) {
  return (
    <div className="flex gap-1">
      {cards.map((c, i) => (
        <CardView key={i} card={c} hidden={hideHole && i === 1} small={small} />
      ))}
    </div>
  );
}

export default function BlackjackGame({ difficulty = 'medium' }: GameProps) {
  const { t } = useTranslation();
  const { shareMsg, doShare } = useShareMsg();
  const rules = RULES[difficulty];

  const [phase, setPhase] = useState<Phase>('bet');
  const [round, setRound] = useState(1);
  const [chips, setChips] = useState<number[]>(() => new Array(SEATS).fill(START_CHIPS));
  const [bets, setBets] = useState<number[]>(() => new Array(SEATS).fill(0));
  const [hands, setHands] = useState<Card[][]>(() => Array.from({ length: SEATS }, () => []));
  const [dealer, setDealer] = useState<Card[]>([]);
  const [holeHidden, setHoleHidden] = useState(true);
  const [bet, setBet] = useState(MIN_BET);
  const [results, setResults] = useState<number[] | null>(null);
  const [levelUp, setLevelUp] = useState<string | null>(null);

  const rngRef = useRef<() => number>(makeRng((Date.now() ^ Math.floor(Math.random() * 1e9)) >>> 0));
  const shoeRef = useRef<{ cards: Card[]; idx: number }>({ cards: [], idx: 0 });
  const timers = useRef<number[]>([]);
  const recordedRef = useRef(false);
  const after = (ms: number, fn: () => void) => timers.current.push(window.setTimeout(fn, ms));
  useEffect(() => () => timers.current.forEach((id) => clearTimeout(id)), []);

  const draw = (): Card => shoeRef.current.cards[shoeRef.current.idx++];

  // ---- a round --------------------------------------------------------------
  const deal = () => {
    const myBet = Math.min(bet, chips[0]);
    shoeRef.current = { cards: makeShoe(rules.decks, rngRef.current), idx: 0 };
    const newBets = chips.map((c, i) => (i === 0 ? myBet : Math.min(c, 50)));
    const newHands: Card[][] = Array.from({ length: SEATS }, () => [draw(), draw()]);
    const newDealer = [draw(), draw()];
    setBets(newBets);
    setHands(newHands);
    setDealer(newDealer);
    setHoleHidden(true);
    setResults(null);
    haptics.tick();
    // Human acts first — unless dealt a natural / 21.
    if (handValue(newHands[0]).total >= 21) after(450, () => finishHuman(newHands));
    else setPhase('player');
  };

  const finishHuman = useCallback((curHands: Card[][]) => {
    setPhase('resolve');
    // Bots play their hands (instant), then we reveal + run the dealer.
    const next = curHands.map((h) => h.slice());
    for (let s = 1; s < SEATS; s++) {
      // eslint-disable-next-line no-constant-condition
      while (true) {
        if (isBust(next[s]) || handValue(next[s]).total >= 21) break;
        const a = botAction(next[s], dealer[0], next[s].length === 2, difficulty, rngRef.current);
        if (a === 'stand') break;
        next[s].push(draw());
        if (a === 'double') break;
      }
    }
    setHands(next);
    after(550, () => {
      // Reveal the hole card and run the dealer to completion.
      const dd = dealer.slice();
      while (dealerShouldHit(dd, rules.hitSoft17)) dd.push(draw());
      setHoleHidden(false);
      setDealer(dd);
      after(700, () => settleRound(next, dd));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dealer, difficulty, rules.hitSoft17]);

  const settleRound = (finalHands: Card[][], finalDealer: Card[]) => {
    const deltas = finalHands.map((h, i) => settle(h, finalDealer, bets[i], rules.blackjackPays));
    const newChips = chips.map((c, i) => Math.max(0, c + deltas[i]));
    setChips(newChips);
    setResults(deltas);
    setPhase('settle');
    if (deltas[0] > 0) fx.correct({ streak: 2 });
    else if (deltas[0] < 0) haptics.bump();
  };

  const nextRound = () => {
    if (chips[0] <= 0 || round >= ROUNDS) {
      setPhase('over');
      return;
    }
    setRound((r) => r + 1);
    setBet((b) => Math.min(Math.max(MIN_BET, b), chips[0]));
    setPhase('bet');
  };

  // Human actions.
  const hit = () => {
    if (phase !== 'player') return;
    const next = hands.map((h, i) => (i === 0 ? [...h, draw()] : h));
    setHands(next);
    haptics.tick();
    if (handValue(next[0]).total >= 21) after(350, () => finishHuman(next));
  };
  const stand = () => {
    if (phase !== 'player') return;
    finishHuman(hands);
  };
  const double = () => {
    if (phase !== 'player' || hands[0].length !== 2 || chips[0] < bets[0] * 2) return;
    const next = hands.map((h, i) => (i === 0 ? [...h, draw()] : h));
    setBets((b) => b.map((x, i) => (i === 0 ? x * 2 : x)));
    setHands(next);
    haptics.tick();
    after(350, () => finishHuman(next));
  };

  // Record once when the session ends.
  useEffect(() => {
    if (phase !== 'over' || recordedRef.current) return;
    recordedRef.current = true;
    const maxChips = Math.max(...chips);
    const won = chips[0] === maxChips && chips[0] > 0;
    void submitScore('blackjack', difficulty, chips[0], { chips: chips[0] });
    const quality = won ? difficultyQuality(difficulty, 0.85) : clamp01((chips[0] / START_CHIPS) * 0.4);
    const res = recordPlay({ gameId: 'blackjack', axes: AXES, quality, weight: XP_WEIGHT[difficulty] });
    setLevelUp(won && res.leveledUp ? t('synapse.levelUp', { n: res.newLevel }) : null);
  }, [phase, chips, difficulty, t]);

  const newSession = () => {
    timers.current.forEach((id) => clearTimeout(id));
    timers.current = [];
    rngRef.current = makeRng((Date.now() ^ Math.floor(Math.random() * 1e9)) >>> 0);
    recordedRef.current = false;
    setChips(new Array(SEATS).fill(START_CHIPS));
    setBets(new Array(SEATS).fill(0));
    setHands(Array.from({ length: SEATS }, () => []));
    setDealer([]);
    setResults(null);
    setRound(1);
    setBet(MIN_BET);
    setLevelUp(null);
    setPhase('bet');
  };

  const seatName = (i: number) => (i === 0 ? t('blackjack.you') : t('blackjack.bot', { n: i }));
  const humanWon = chips[0] === Math.max(...chips) && chips[0] > 0;
  const dealerVal = holeHidden && dealer.length ? handValue([dealer[0]]).total : handValue(dealer).total;

  return (
    <div className="relative flex h-full w-full flex-col bg-[radial-gradient(120%_100%_at_50%_0%,#0f3d2e_0%,#0b1020_62%,#070a16_100%)] text-white">
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 pb-1 pt-3 text-sm">
        <span className="font-dot rounded-lg px-2 py-1 text-xs font-bold" style={{ backgroundColor: DIFFICULTY_STYLE[difficulty as Difficulty].color }}>
          {t(difficultyKey(difficulty))}
        </span>
        <span className="font-semibold text-white/85">{t('blackjack.round', { n: round, total: ROUNDS })}</span>
        <span className="text-xs font-bold tabular-nums text-amber-300">🪙 {chips[0]}</span>
      </div>

      <div className="flex flex-1 flex-col items-center justify-between overflow-y-auto px-3 py-2">
        {/* Dealer */}
        <div className="flex flex-col items-center gap-1">
          <span className="text-[11px] uppercase tracking-wide text-white/50">
            {t('blackjack.dealer')} {dealer.length > 0 && <span className="text-white/80">· {dealerVal}{holeHidden ? '+' : ''}</span>}
          </span>
          <Hand cards={dealer} hideHole={holeHidden} />
        </div>

        {/* Bots */}
        <div className="flex w-full items-start justify-around">
          {[1, 2, 3].map((s) => {
            const v = hands[s].length ? handValue(hands[s]).total : 0;
            const r = results?.[s];
            return (
              <div key={s} className="flex flex-col items-center gap-0.5">
                <Hand cards={hands[s]} small />
                <span className="text-[10px] text-white/55">
                  {seatName(s)} {v > 0 && `· ${v}${isBust(hands[s]) ? '💥' : ''}`}
                </span>
                <span className="text-[10px] font-bold tabular-nums text-amber-300/80">🪙{chips[s]}</span>
                {r != null && <span className={`text-[10px] font-bold ${r > 0 ? 'text-emerald-400' : r < 0 ? 'text-rose-400' : 'text-white/50'}`}>{r > 0 ? `+${r}` : r}</span>}
              </div>
            );
          })}
        </div>

        {/* Human */}
        <div className="flex flex-col items-center gap-1">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-accent-cyan">{t('blackjack.you')}</span>
            {hands[0].length > 0 && (
              <span className="text-sm font-bold tabular-nums">
                {handValue(hands[0]).total}
                {isBlackjack(hands[0]) && <span className="ml-1 text-amber-300">BJ!</span>}
                {isBust(hands[0]) && <span className="ml-1 text-rose-400">{t('blackjack.bust')}</span>}
              </span>
            )}
            {results?.[0] != null && (
              <span className={`text-sm font-bold ${results[0] > 0 ? 'text-emerald-400' : results[0] < 0 ? 'text-rose-400' : 'text-white/60'}`}>
                {results[0] > 0 ? `+${results[0]}` : results[0]}
              </span>
            )}
          </div>
          <Hand cards={hands[0]} />
        </div>
      </div>

      {/* Controls */}
      <div className="px-4 pb-5 pt-1">
        {phase === 'bet' && (
          <div className="flex flex-col items-center gap-2">
            <div className="flex items-center gap-2">
              <span className="text-xs text-white/60">{t('blackjack.bet')}:</span>
              {BET_STEPS.map((s) => (
                <button
                  key={s}
                  onClick={() => setBet(Math.min(s, chips[0]))}
                  className={`rounded-lg px-3 py-1.5 text-sm font-bold tabular-nums transition active:scale-95 ${
                    bet === Math.min(s, chips[0]) ? 'bg-accent-cyan text-slate-900' : 'bg-white/10 text-white'
                  }`}
                >
                  {s}
                </button>
              ))}
              <button onClick={() => setBet(chips[0])} className={`rounded-lg px-3 py-1.5 text-sm font-bold transition active:scale-95 ${bet === chips[0] ? 'bg-accent-cyan text-slate-900' : 'bg-white/10 text-white'}`}>
                {t('blackjack.allIn')}
              </button>
            </div>
            <button
              onClick={deal}
              className="w-full max-w-xs rounded-2xl bg-gradient-to-r from-primary to-accent-cyan py-3 text-base font-bold text-white shadow-premium active:scale-95"
            >
              {t('blackjack.deal')} · 🪙{Math.min(bet, chips[0])}
            </button>
          </div>
        )}

        {phase === 'player' && (
          <div className="flex justify-center gap-2">
            <ActBtn onClick={hit}>{t('blackjack.hit')}</ActBtn>
            <ActBtn onClick={stand}>{t('blackjack.stand')}</ActBtn>
            <ActBtn onClick={double} disabled={hands[0].length !== 2 || chips[0] < bets[0] * 2}>
              {t('blackjack.double')}
            </ActBtn>
          </div>
        )}

        {phase === 'resolve' && <p className="text-center text-sm text-white/50">{t('blackjack.dealerPlays')}</p>}

        {phase === 'settle' && (
          <button
            onClick={nextRound}
            className="mx-auto block w-full max-w-xs rounded-2xl bg-gradient-to-r from-primary to-accent-cyan py-3 text-base font-bold text-white shadow-premium active:scale-95"
          >
            {chips[0] <= 0 || round >= ROUNDS ? t('blackjack.seeResult') : t('blackjack.nextRound')}
          </button>
        )}
      </div>

      {phase === 'over' && (
        <GameResultScreen
          gameId="blackjack"
          emoji={humanWon ? '🏆' : '🪙'}
          title={humanWon ? t('blackjack.youWin') : t('blackjack.youLose')}
          celebrate={humanWon}
          levelUp={levelUp}
          stats={[
            { value: `🪙${chips[0]}`, label: t('blackjack.you') },
            { value: `🪙${Math.max(...chips)}`, label: t('blackjack.top') },
          ]}
          actions={[
            { label: t('blackjack.again'), onClick: newSession, variant: 'primary' },
            {
              label: t('blackjack.share'),
              onClick: () => doShare(`BrainClub · ${t('games.blackjack.name')} (${t(difficultyKey(difficulty))})\n🪙 ${chips[0]}\n${window.location.origin}`),
              variant: 'secondary',
            },
          ]}
          shareMsg={shareMsg}
        />
      )}
    </div>
  );
}

function ActBtn({ children, onClick, disabled }: { children: React.ReactNode; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`min-w-[88px] rounded-2xl py-3 text-base font-bold shadow-premium transition active:scale-95 ${
        disabled ? 'cursor-not-allowed bg-white/[0.06] text-white/40' : 'bg-white/[0.1] text-white ring-1 ring-white/15 hover:bg-white/[0.18]'
      }`}
    >
      {children}
    </button>
  );
}
