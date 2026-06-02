// Klondike solitaire — pure game logic.
//
// State is treated as immutable: every action returns a NEW Game (or null when
// the action is illegal), which makes undo a simple snapshot stack in the UI.
//
// Suits: 0=♠ spades, 1=♥ hearts, 2=♦ diamonds, 3=♣ clubs. Hearts/diamonds are red.
// Ranks: 1=A … 13=K.

import type { Difficulty } from '../../lib/difficulty';

export type Suit = 0 | 1 | 2 | 3;
export type Card = { suit: Suit; rank: number; faceUp: boolean; id: number };
export type Pile = Card[];

export type Game = {
  stock: Pile;
  waste: Pile;
  foundations: [Pile, Pile, Pile, Pile];
  tableau: Pile[]; // 7 columns
  drawCount: number;
  /** Remaining stock recycles; -1 means unlimited. */
  redealsLeft: number;
};

export const isRed = (s: Suit): boolean => s === 1 || s === 2;
export const SUIT_CHAR = ['♠', '♥', '♦', '♣'] as const;
export const RANK_CHAR = ['', 'A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

type DiffConfig = { draw: number; redeals: number };
export const SOLITAIRE_CONFIG: Record<Difficulty, DiffConfig> = {
  easy: { draw: 1, redeals: -1 },
  medium: { draw: 1, redeals: 3 },
  hard: { draw: 3, redeals: -1 },
  expert: { draw: 3, redeals: 1 },
};

// ---- locations (UI tells the logic what was tapped) ----
export type Loc =
  | { kind: 'waste' }
  | { kind: 'tableau'; col: number; idx: number }
  | { kind: 'foundation'; i: number };

export type Target = { kind: 'tableau'; col: number } | { kind: 'foundation'; i: number };

// ---- helpers ----
function clone(game: Game): Game {
  return {
    stock: game.stock.slice(),
    waste: game.waste.slice(),
    foundations: game.foundations.map((f) => f.slice()) as [Pile, Pile, Pile, Pile],
    tableau: game.tableau.map((t) => t.slice()),
    drawCount: game.drawCount,
    redealsLeft: game.redealsLeft,
  };
}

const top = (pile: Pile): Card | null => (pile.length ? pile[pile.length - 1] : null);

function shuffle<T>(a: T[]): T[] {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ---- deal ----
export function deal(difficulty: Difficulty): Game {
  const cfg = SOLITAIRE_CONFIG[difficulty];
  const deck: Card[] = [];
  let id = 0;
  for (let s = 0 as Suit; s < 4; s = (s + 1) as Suit) {
    for (let r = 1; r <= 13; r++) deck.push({ suit: s, rank: r, faceUp: false, id: id++ });
  }
  shuffle(deck);

  const tableau: Pile[] = [[], [], [], [], [], [], []];
  let k = 0;
  for (let col = 0; col < 7; col++) {
    for (let n = 0; n <= col; n++) {
      const card = deck[k++];
      card.faceUp = n === col; // only the last card of each column is face up
      tableau[col].push(card);
    }
  }
  const stock = deck.slice(k); // remaining 24, all face down

  return {
    stock,
    waste: [],
    foundations: [[], [], [], []],
    tableau,
    drawCount: cfg.draw,
    redealsLeft: cfg.redeals,
  };
}

// ---- draw / recycle ----
export function draw(game: Game): Game | null {
  if (game.stock.length === 0) {
    // Recycle the waste back into the stock (face down), if allowed.
    if (game.waste.length === 0) return null;
    if (game.redealsLeft === 0) return null;
    const next = clone(game);
    next.stock = next.waste.reverse().map((c) => ({ ...c, faceUp: false }));
    next.waste = [];
    if (next.redealsLeft > 0) next.redealsLeft -= 1;
    return next;
  }
  const next = clone(game);
  const n = Math.min(next.drawCount, next.stock.length);
  for (let i = 0; i < n; i++) {
    const card = next.stock.pop()!;
    card.faceUp = true;
    next.waste.push(card);
  }
  return next;
}

export function canRecycle(game: Game): boolean {
  return game.stock.length === 0 && game.waste.length > 0 && game.redealsLeft !== 0;
}

// ---- validation ----
function canStackFoundation(card: Card, pile: Pile): boolean {
  const t = top(pile);
  if (!t) return card.rank === 1; // empty foundation accepts an Ace
  return t.suit === card.suit && card.rank === t.rank + 1;
}

function canStackTableau(card: Card, pile: Pile): boolean {
  const t = top(pile);
  if (!t) return card.rank === 13; // empty column accepts a King
  return isRed(t.suit) !== isRed(card.suit) && card.rank === t.rank - 1;
}

/** The cards that would move from a source location (or null if not movable). */
function movingCards(game: Game, src: Loc): Card[] | null {
  if (src.kind === 'waste') {
    const c = top(game.waste);
    return c ? [c] : null;
  }
  if (src.kind === 'foundation') {
    const c = top(game.foundations[src.i]);
    return c ? [c] : null;
  }
  const col = game.tableau[src.col];
  if (src.idx < 0 || src.idx >= col.length) return null;
  const run = col.slice(src.idx);
  if (run.some((c) => !c.faceUp)) return null; // can't move face-down cards
  return run;
}

function removeFrom(next: Game, src: Loc, count: number) {
  if (src.kind === 'waste') {
    next.waste.splice(next.waste.length - count, count);
  } else if (src.kind === 'foundation') {
    next.foundations[src.i].splice(next.foundations[src.i].length - count, count);
  } else {
    const col = next.tableau[src.col];
    col.splice(col.length - count, count);
    // Flip the newly exposed card.
    const t = top(col);
    if (t && !t.faceUp) t.faceUp = true;
  }
}

/** Attempt to move from src to target. Returns a new Game or null if illegal. */
export function move(game: Game, src: Loc, target: Target): Game | null {
  const cards = movingCards(game, src);
  if (!cards || cards.length === 0) return null;

  // No-op if moving onto itself.
  if (src.kind === 'tableau' && target.kind === 'tableau' && src.col === target.col) return null;
  if (src.kind === 'foundation' && target.kind === 'foundation' && src.i === target.i) return null;

  if (target.kind === 'foundation') {
    if (cards.length !== 1) return null; // foundations take one card at a time
    if (!canStackFoundation(cards[0], game.foundations[target.i])) return null;
    const next = clone(game);
    removeFrom(next, src, 1);
    next.foundations[target.i].push({ ...cards[0], faceUp: true });
    return next;
  }

  // target tableau
  if (!canStackTableau(cards[0], game.tableau[target.col])) return null;
  const next = clone(game);
  removeFrom(next, src, cards.length);
  for (const c of cards) next.tableau[target.col].push({ ...c, faceUp: true });
  return next;
}

/** Send the top card at `loc` to a matching foundation, if any. */
export function autoToFoundation(game: Game, loc: Loc): Game | null {
  const cards = movingCards(game, loc);
  if (!cards || cards.length !== 1) return null;
  for (let i = 0; i < 4; i++) {
    if (canStackFoundation(cards[0], game.foundations[i])) {
      return move(game, loc, { kind: 'foundation', i });
    }
  }
  return null;
}

export function isWon(game: Game): boolean {
  return game.foundations.every((f) => f.length === 13);
}
