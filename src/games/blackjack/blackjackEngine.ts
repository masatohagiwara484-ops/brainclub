// Blackjack — pure rules + a basic-strategy AI for the bot seats.
//
// A four-seat table (seat 0 = human, 1..3 = AI bots) plays against a shared
// dealer over a fixed session; whoever has the most chips at the end wins. The
// human plays their own hand against the dealer; the bots play basic strategy
// (with difficulty-scaled mistakes), so a sharper table is harder to out-earn.
// Everything here is pure and mirrored in scripts/verify-blackjack.mjs.

import type { Difficulty } from '../../lib/difficulty';

export type Card = { r: number; s: number }; // r: 1..13 (1 = Ace, 11/12/13 = J/Q/K), s: 0..3 suit
export type Action = 'hit' | 'stand' | 'double';

// House rules per difficulty: tougher levels hit soft 17 and pay blackjack worse.
export type Rules = { decks: number; hitSoft17: boolean; blackjackPays: number };
export const RULES: Record<Difficulty, Rules> = {
  easy: { decks: 1, hitSoft17: false, blackjackPays: 1.5 },
  medium: { decks: 2, hitSoft17: false, blackjackPays: 1.5 },
  hard: { decks: 4, hitSoft17: true, blackjackPays: 1.5 },
  expert: { decks: 6, hitSoft17: true, blackjackPays: 1.2 },
};
// How often a bot deviates from basic strategy (lower = stronger play).
export const BOT_ERROR: Record<Difficulty, number> = { easy: 0.4, medium: 0.2, hard: 0.06, expert: 0 };

export function makeShoe(decks: number, rng: () => number): Card[] {
  const shoe: Card[] = [];
  for (let d = 0; d < decks; d++)
    for (let s = 0; s < 4; s++) for (let r = 1; r <= 13; r++) shoe.push({ r, s });
  for (let i = shoe.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [shoe[i], shoe[j]] = [shoe[j], shoe[i]];
  }
  return shoe;
}

/** Base value of a rank: Ace = 11 (soft), face cards = 10. */
export function cardValue(r: number): number {
  if (r === 1) return 11;
  return r >= 10 ? 10 : r;
}

/** Best hand total plus whether an ace is still counted as 11 (a "soft" hand). */
export function handValue(cards: Card[]): { total: number; soft: boolean } {
  let total = 0;
  let aces = 0;
  for (const c of cards) {
    total += cardValue(c.r);
    if (c.r === 1) aces++;
  }
  while (total > 21 && aces > 0) {
    total -= 10; // count an ace as 1 instead of 11
    aces--;
  }
  return { total, soft: aces > 0 };
}

export const isBust = (cards: Card[]): boolean => handValue(cards).total > 21;
export const isBlackjack = (cards: Card[]): boolean => cards.length === 2 && handValue(cards).total === 21;

/** Dealer policy: hit to 17, optionally hitting a soft 17. */
export function dealerShouldHit(cards: Card[], hitSoft17: boolean): boolean {
  const { total, soft } = handValue(cards);
  if (total < 17) return true;
  return total === 17 && soft && hitSoft17;
}

/** Basic strategy (no split): the textbook hit/stand/double for this spot. */
export function basicAction(cards: Card[], dealerUp: Card, canDouble: boolean): Action {
  const { total, soft } = handValue(cards);
  const up = cardValue(dealerUp.r); // 11 for an ace
  const dbl = (want: boolean): Action => (want && canDouble ? 'double' : 'hit');

  if (soft) {
    // Soft totals (an ace counts as 11).
    if (total >= 19) return 'stand';
    if (total === 18) {
      if (up >= 9 || up === 11) return 'hit';
      if (up >= 3 && up <= 6) return dbl(true);
      return 'stand'; // vs 2,7,8
    }
    if (total === 17) return up >= 3 && up <= 6 ? dbl(true) : 'hit';
    if (total === 16 || total === 15) return up >= 4 && up <= 6 ? dbl(true) : 'hit';
    return up >= 5 && up <= 6 ? dbl(true) : 'hit'; // soft 13/14
  }

  // Hard totals.
  if (total >= 17) return 'stand';
  if (total >= 13) return up >= 2 && up <= 6 ? 'stand' : 'hit';
  if (total === 12) return up >= 4 && up <= 6 ? 'stand' : 'hit';
  if (total === 11) return dbl(up <= 10);
  if (total === 10) return dbl(up >= 2 && up <= 9);
  if (total === 9) return dbl(up >= 3 && up <= 6);
  return 'hit'; // 8 or less
}

/** A bot's action: basic strategy, but with a difficulty-scaled chance of error. */
export function botAction(
  cards: Card[],
  dealerUp: Card,
  canDouble: boolean,
  difficulty: Difficulty,
  rng: () => number,
): Action {
  const best = basicAction(cards, dealerUp, canDouble);
  if (rng() >= BOT_ERROR[difficulty]) return best;
  // A loose, plausible mistake: stand instead of hit (or vice-versa).
  const { total } = handValue(cards);
  if (best === 'hit') return total >= 12 ? 'stand' : 'hit';
  if (best === 'double') return 'hit';
  return total <= 16 ? 'hit' : 'stand';
}

/** Net chip change for a `bet` given the final player and dealer hands. */
export function settle(player: Card[], dealer: Card[], bet: number, blackjackPays: number): number {
  const pBust = isBust(player);
  const dBust = isBust(dealer);
  const pBJ = isBlackjack(player);
  const dBJ = isBlackjack(dealer);
  if (pBJ || dBJ) {
    if (pBJ && dBJ) return 0; // both blackjack: push
    return pBJ ? Math.round(bet * blackjackPays) : -bet;
  }
  if (pBust) return -bet;
  if (dBust) return bet;
  const p = handValue(player).total;
  const d = handValue(dealer).total;
  if (p > d) return bet;
  if (p < d) return -bet;
  return 0; // push
}
