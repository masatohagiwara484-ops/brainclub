// FX orchestration — the ONE surface games call for juicy feedback.
//
// A game triggers feedback with a single import and a single line:
//   import { fx } from '../../lib/fx';
//   fx.correct({ streak });   // sound + escalating haptic (no screen motion)
//   fx.win();                 // confetti + win chime + success haptic
//   fx.wrong();               // red flash + screen shake + buzz
//
// This mirrors the existing `haptics` singleton pattern. Screen-level VISUAL
// effects are emitted on a tiny event bus that a single mounted <FxLayer/>
// subscribes to — so games never wire providers or drill props.
//
// Reduced-motion is enforced HERE (one place): visual motion is suppressed for
// users who ask for it, while sound + haptics still fire.

import { haptics } from './haptics';
import { sound } from './sound';

export type FxEvent =
  | { kind: 'confetti'; intensity: number }
  | { kind: 'flash'; color: string }
  | { kind: 'shake'; strength: 'sm' | 'md' };

type Listener = (e: FxEvent) => void;

let listeners: Listener[] = [];

/** Subscribe to visual FX events. Returns an unsubscribe function. */
export function subscribeFx(l: Listener): () => void {
  listeners.push(l);
  return () => {
    listeners = listeners.filter((x) => x !== l);
  };
}

function emit(e: FxEvent): void {
  for (const l of listeners) l(e);
}

export function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

export const fx = {
  /** Light UI tick (placing a piece, typing a letter). */
  tick() {
    haptics.tick();
    sound.playTick();
  },

  /** A correct/positive beat. Haptic escalates with the streak. */
  correct({ streak = 0 }: { streak?: number } = {}) {
    sound.playCorrect(streak);
    if (streak >= 8) haptics.success();
    else if (streak >= 3) haptics.bump();
    else haptics.tick();
  },

  /** A wrong/invalid beat — flash + shake + buzz. */
  wrong() {
    sound.playWrong();
    haptics.bump();
    if (!prefersReducedMotion()) {
      emit({ kind: 'shake', strength: 'md' });
      emit({ kind: 'flash', color: 'var(--fx-flash, rgba(239,68,68,0.45))' });
    }
  },

  /** A win — celebratory confetti + chime + success haptic. */
  win() {
    sound.playWin();
    haptics.success();
    if (!prefersReducedMotion()) emit({ kind: 'confetti', intensity: 1 });
  },

  /** A level-up — a slightly lighter celebration. */
  levelUp() {
    sound.playLevelUp();
    haptics.success();
    if (!prefersReducedMotion()) emit({ kind: 'confetti', intensity: 0.6 });
  },

  // ---- low-level escape hatches ----
  confetti(intensity = 1) {
    if (!prefersReducedMotion()) emit({ kind: 'confetti', intensity });
  },
  flash(color: string) {
    if (!prefersReducedMotion()) emit({ kind: 'flash', color });
  },
  shake(strength: 'sm' | 'md' = 'md') {
    if (!prefersReducedMotion()) emit({ kind: 'shake', strength });
  },
};
