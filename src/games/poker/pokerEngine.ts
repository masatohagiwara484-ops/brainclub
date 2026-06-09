// No-Limit Texas Hold'em — pure game/betting engine + a heuristic AI.
//
// Four players (0 = human, 1..3 = AI) play a knockout tournament: blinds, two
// hole cards each, four betting rounds (preflop/flop/turn/river), then a showdown
// with correct side pots. A player busts at zero chips; last one standing wins.
// State is a plain object; the React layer drives turns (human via buttons, AI
// via aiDecide) and reads the result. The side-pot splitter is exported pure and
// checked in scripts/verify-poker.mjs.

import type { Difficulty } from '../../lib/difficulty';
import { type Card, evaluate7, compare, fullDeck, shuffle, holeStrength } from './pokerEval';

export type Stage = 'preflop' | 'flop' | 'turn' | 'river' | 'showdown' | 'handover';

export type Player = {
  id: number;
  stack: number;
  hole: Card[];
  committed: number; // chips in this betting round
  total: number; // chips in this whole hand (for side pots)
  folded: boolean;
  allIn: boolean;
  acted: boolean; // has acted since the last raise this round
  out: boolean; // eliminated from the tournament
};

export type Award = { potIndex: number; amount: number; winners: number[] };

export type State = {
  players: Player[];
  community: Card[];
  deck: Card[];
  button: number;
  toAct: number;
  stage: Stage;
  currentBet: number; // highest `committed` this round
  minRaise: number; // minimum legal raise increment
  bb: number;
  awards: Award[]; // filled at showdown / hand end
  reveal: boolean; // show everyone's hole cards (showdown)
  lastAction: string | null;
};

export type ActionType = 'fold' | 'check' | 'call' | 'raise';
export type Action = { type: ActionType; amount?: number }; // amount = total `committed` to reach (raise-to)

const active = (p: Player): boolean => !p.folded && !p.out; // still has a live hand
const canAct = (p: Player): boolean => active(p) && !p.allIn;

export function createGame(rng: () => number, startStack = 1000, bb = 20): State {
  const players: Player[] = [0, 1, 2, 3].map((id) => ({
    id,
    stack: startStack,
    hole: [],
    committed: 0,
    total: 0,
    folded: false,
    allIn: false,
    acted: false,
    out: false,
  }));
  const s: State = {
    players,
    community: [],
    deck: [],
    button: Math.floor(rng() * 4),
    toAct: 0,
    stage: 'handover',
    currentBet: 0,
    minRaise: bb,
    bb,
    awards: [],
    reveal: false,
    lastAction: null,
  };
  return s;
}

const nextSeat = (s: State, from: number, pred: (p: Player) => boolean): number => {
  for (let k = 1; k <= 4; k++) {
    const i = (from + k) % 4;
    if (pred(s.players[i])) return i;
  }
  return from;
};

/** Begin a new hand: rotate the button, post blinds, deal, open preflop betting. */
export function startHand(s: State, rng: () => number): State {
  const alive = s.players.filter((p) => !p.out).length;
  s.button = nextSeat(s, s.button, (p) => !p.out);
  for (const p of s.players) {
    p.hole = [];
    p.committed = 0;
    p.total = 0;
    p.folded = p.out;
    p.allIn = false;
    p.acted = false;
  }
  s.community = [];
  s.awards = [];
  s.reveal = false;
  s.lastAction = null;
  s.currentBet = 0;
  s.minRaise = s.bb;
  s.stage = 'preflop';

  const deck = shuffle(fullDeck(), rng);
  let d = 0;
  for (let r = 0; r < 2; r++) for (const p of s.players) if (!p.out) p.hole.push(deck[d++]);
  s.deck = deck.slice(d);

  // Blinds: heads-up posts SB on the button; otherwise SB is left of the button.
  const sbSeat = alive === 2 ? s.button : nextSeat(s, s.button, (p) => !p.out);
  const bbSeat = nextSeat(s, sbSeat, (p) => !p.out);
  postBlind(s, sbSeat, Math.floor(s.bb / 2));
  postBlind(s, bbSeat, s.bb);
  s.currentBet = s.bb;
  s.minRaise = s.bb;
  for (const p of s.players) p.acted = false; // blinds are not "acting"
  s.toAct = nextSeat(s, bbSeat, canAct);
  return s;
}

function postBlind(s: State, seat: number, amount: number): void {
  const p = s.players[seat];
  const pay = Math.min(amount, p.stack);
  p.stack -= pay;
  p.committed += pay;
  p.total += pay;
  if (p.stack === 0) p.allIn = true;
}

/** What `seat` may legally do right now. */
export function legalActions(s: State, seat: number) {
  const p = s.players[seat];
  const toCall = Math.max(0, s.currentBet - p.committed);
  const canCheck = toCall === 0;
  const callAmount = Math.min(toCall, p.stack);
  const maxTo = p.committed + p.stack; // all-in raise-to
  const minTo = s.currentBet + s.minRaise;
  const canRaise = p.stack > toCall; // has chips beyond a call
  return {
    canFold: true,
    canCheck,
    canCall: toCall > 0 && p.stack > 0,
    callAmount,
    canRaise,
    minRaiseTo: Math.min(Math.max(minTo, s.currentBet + s.bb), maxTo),
    maxRaiseTo: maxTo,
    toCall,
  };
}

/** Apply `seat`'s action and advance the hand (deal streets / showdown as needed). */
export function applyAction(s: State, seat: number, action: Action): State {
  const p = s.players[seat];
  if (action.type === 'fold') {
    p.folded = true;
    p.acted = true;
    s.lastAction = 'fold';
  } else if (action.type === 'check') {
    p.acted = true;
    s.lastAction = 'check';
  } else if (action.type === 'call') {
    const pay = Math.min(s.currentBet - p.committed, p.stack);
    commit(p, pay);
    p.acted = true;
    s.lastAction = 'call';
  } else {
    // raise: amount is the total committed to reach this round.
    const target = Math.min(Math.max(action.amount ?? 0, s.currentBet + s.bb), p.committed + p.stack);
    const inc = target - p.committed;
    commit(p, inc);
    const raiseSize = target - s.currentBet;
    if (raiseSize >= s.minRaise) s.minRaise = raiseSize; // legal full raise resets the bar
    s.currentBet = Math.max(s.currentBet, target);
    for (const q of s.players) if (canAct(q) && q.id !== p.id) q.acted = false; // re-open action
    p.acted = true;
    s.lastAction = 'raise';
  }

  // Everyone folded but one → award immediately.
  const live = s.players.filter(active);
  if (live.length === 1) {
    awardUncontested(s, live[0]);
    return s;
  }

  // Does the round continue?
  const needsAction = s.players.filter((q) => canAct(q) && (!q.acted || q.committed < s.currentBet));
  if (needsAction.length > 0) {
    s.toAct = nextSeat(s, seat, (q) => canAct(q) && (!q.acted || q.committed < s.currentBet));
    return s;
  }

  // Betting round complete → next street (or run it out if no one else can bet).
  advanceStreet(s);
  return s;
}

function commit(p: Player, amount: number): void {
  const pay = Math.min(amount, p.stack);
  p.stack -= pay;
  p.committed += pay;
  p.total += pay;
  if (p.stack === 0) p.allIn = true;
}

function advanceStreet(s: State): void {
  for (const p of s.players) {
    p.committed = 0;
    p.acted = false;
  }
  s.currentBet = 0;
  s.minRaise = s.bb;

  // If at most one player can still bet, deal the remaining streets and show down.
  const canStillBet = s.players.filter(canAct).length;
  const runOut = canStillBet <= 1;

  const deal = (n: number) => {
    for (let i = 0; i < n; i++) s.community.push(s.deck.shift()!);
  };
  const order: Stage[] = ['preflop', 'flop', 'turn', 'river', 'showdown'];
  let idx = order.indexOf(s.stage);
  const step = () => {
    idx++;
    s.stage = order[idx];
    if (s.stage === 'flop') deal(3);
    else if (s.stage === 'turn' || s.stage === 'river') deal(1);
  };
  step();
  if (runOut) {
    while (s.stage !== 'showdown') step();
    settleShowdown(s);
    return;
  }
  if (s.stage === 'showdown') {
    settleShowdown(s);
    return;
  }
  s.toAct = nextSeat(s, s.button, canAct);
}

function awardUncontested(s: State, winner: Player): void {
  const pot = s.players.reduce((sum, p) => sum + p.total, 0);
  winner.stack += pot;
  s.awards = [{ potIndex: 0, amount: pot, winners: [winner.id] }];
  s.stage = 'handover';
}

function settleShowdown(s: State): void {
  s.reveal = true;
  s.stage = 'showdown';
  const payouts = settlePots(s.players, s.community);
  s.awards = payouts.awards;
  for (let i = 0; i < s.players.length; i++) s.players[i].stack += payouts.gains[i];
  s.stage = 'handover';
}

/**
 * Split the pot into side pots by contribution level and award each to the best
 * eligible (non-folded) hand. Pure — exported for the verify script.
 */
export function settlePots(
  players: Player[],
  community: Card[],
): { gains: number[]; awards: Award[] } {
  const gains = players.map(() => 0);
  const awards: Award[] = [];
  const levels = [...new Set(players.filter((p) => p.total > 0).map((p) => p.total))].sort((a, b) => a - b);
  let prev = 0;
  let potIndex = 0;
  const score = new Map<number, number[]>();
  for (const p of players) if (!p.folded) score.set(p.id, evaluate7([...p.hole, ...community]));

  for (const level of levels) {
    let amount = 0;
    for (const p of players) amount += Math.max(0, Math.min(p.total, level) - prev);
    const eligible = players.filter((p) => !p.folded && p.total >= level);
    if (amount > 0 && eligible.length > 0) {
      let best: number[] | null = null;
      for (const p of eligible) {
        const sc = score.get(p.id)!;
        if (!best || compare(sc, best) > 0) best = sc;
      }
      const winners = eligible.filter((p) => compare(score.get(p.id)!, best!) === 0).map((p) => p.id);
      const share = Math.floor(amount / winners.length);
      let rem = amount - share * winners.length;
      for (const id of winners) {
        gains[id] += share + (rem > 0 ? 1 : 0); // odd chip to earliest winners
        if (rem > 0) rem--;
      }
      awards.push({ potIndex, amount, winners });
      potIndex++;
    }
    prev = level;
  }
  return { gains, awards };
}

// ---- AI ----------------------------------------------------------------------

// Rough 0..1 strength of `seat`'s current hand (preflop heuristic, postflop by
// made-hand category with a little kicker nuance).
function strength(s: State, seat: number): number {
  const p = s.players[seat];
  if (s.community.length === 0) return holeStrength(p.hole[0], p.hole[1]);
  const score = evaluate7([...p.hole, ...s.community]);
  const cat = score[0]; // 0..8
  return Math.min(1, cat / 8 + 0.06);
}

export function aiDecide(s: State, seat: number, difficulty: Difficulty, rng: () => number): Action {
  const la = legalActions(s, seat);
  const p = s.players[seat];
  const pot = s.players.reduce((sum, q) => sum + q.total, 0);
  let str = strength(s, seat);

  // Difficulty shapes tightness, aggression and bluffing.
  const cfg = {
    easy: { call: 0.28, raise: 0.82, bluff: 0.04, aggro: 0.45 },
    medium: { call: 0.34, raise: 0.72, bluff: 0.07, aggro: 0.6 },
    hard: { call: 0.36, raise: 0.66, bluff: 0.1, aggro: 0.75 },
    expert: { call: 0.38, raise: 0.62, bluff: 0.14, aggro: 0.9 },
  }[difficulty];

  const potOdds = la.toCall > 0 ? la.toCall / (pot + la.toCall) : 0;
  const bluff = rng() < cfg.bluff;

  // Strong hand → bet/raise.
  if ((str > cfg.raise || bluff) && la.canRaise && rng() < cfg.aggro) {
    const size = Math.round((0.5 + rng() * 0.6) * Math.max(pot, s.bb));
    const target = Math.min(la.maxRaiseTo, Math.max(la.minRaiseTo, p.committed + size));
    return { type: 'raise', amount: target };
  }
  // No bet to call → check (occasionally a small probe raise with a decent hand).
  if (la.canCheck) {
    if (str > cfg.raise && la.canRaise && rng() < 0.5) {
      const target = Math.min(la.maxRaiseTo, Math.max(la.minRaiseTo, p.committed + Math.round(0.5 * Math.max(pot, s.bb))));
      return { type: 'raise', amount: target };
    }
    return { type: 'check' };
  }
  // Facing a bet → call when the hand justifies the price, else fold.
  if (str > cfg.call + potOdds * 0.5 || (str > 0.3 && potOdds < 0.2)) {
    return { type: 'call' };
  }
  return { type: 'fold' };
}

export function isGameOver(s: State): boolean {
  return s.players.filter((p) => !p.out).length <= 1;
}

/** Mark busted players out; returns the winner id when the tournament is over. */
export function reckon(s: State): number | null {
  for (const p of s.players) if (p.stack <= 0) p.out = true;
  const alive = s.players.filter((p) => !p.out);
  return alive.length <= 1 ? (alive[0]?.id ?? -1) : null;
}
