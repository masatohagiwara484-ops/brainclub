// Textless "how to play" store (Mission 9).
//
// The tutorial is purely visual — an animated finger demonstrates each game's
// core gesture (tap, tap-then-tap, or swipe), so it needs ZERO translation and
// works for kids and every language. This tiny reactive singleton (same shape as
// the monetization modal store) owns which game's overlay is open, so it can be
// popped imperatively from anywhere: the header "?" button, or automatically the
// first time a game is opened. "Seen" state persists per game in localStorage so
// the auto-tutorial shows exactly once; the "?" button always replays it.

import { useEffect, useReducer } from 'react';
import { getSetting, setSetting } from './storage';

type Listener = () => void;
let listeners: Listener[] = [];
function emit(): void {
  for (const l of listeners) l();
}
export function subscribeHowto(l: Listener): () => void {
  listeners.push(l);
  return () => {
    listeners = listeners.filter((x) => x !== l);
  };
}

let openId: string | null = null;

export const howto = {
  /** The game id whose tutorial is open, or null. */
  openId(): string | null {
    return openId;
  },
  open(gameId: string): void {
    openId = gameId;
    emit();
  },
  close(): void {
    openId = null;
    emit();
  },

  /** Has the auto-tutorial already been shown for this game? */
  hasSeen(gameId: string): boolean {
    return getSetting<boolean>(`howto.${gameId}`, false);
  },
  markSeen(gameId: string): void {
    setSetting(`howto.${gameId}`, true);
  },
  /** Open the tutorial once, the first time a game is played. */
  autoOpen(gameId: string): void {
    if (this.hasSeen(gameId)) return;
    this.markSeen(gameId);
    this.open(gameId);
  },
};

/** Subscribe a component to howto changes (returns the shared store). */
export function useHowto(): typeof howto {
  const [, force] = useReducer((x: number) => x + 1, 0);
  useEffect(() => subscribeHowto(force), []);
  return howto;
}
