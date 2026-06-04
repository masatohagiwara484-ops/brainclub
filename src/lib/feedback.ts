// Element-level "game feel" — the tiny helper any game can call to make a
// specific element react to an outcome. This complements the screen-level `fx`
// bus (lib/fx.ts): `fx` celebrates the whole screen (confetti/shake/flash),
// while `feedback` punches a single element (a board, a tile, a card).
//
//   import { triggerSolveFeedback } from '../../lib/feedback';
//   triggerSolveFeedback(boardRef.current);
//
// Implementation is deliberately featherweight: toggle one CSS class that owns a
// single keyframe (defined in styles/index.css), then self-clean on
// `animationend`. No per-frame JS, no layout thrash beyond one reflow to allow
// re-triggering the same animation back-to-back. Reduced-motion is honored here
// (one place) by reusing the shared preference check.

import { prefersReducedMotion } from './fx';

type Feel = { className: string; duration: number };

const CORRECT: Feel = { className: 'fb-correct', duration: 180 };
const INCORRECT: Feel = { className: 'fb-incorrect', duration: 420 };
const SOLVE: Feel = { className: 'fb-solve', duration: 650 };

function play(el: HTMLElement | null | undefined, feel: Feel): void {
  if (!el || prefersReducedMotion()) return;

  // Clear any in-flight feel and force a reflow so the same animation can be
  // re-triggered immediately (e.g. two rejected guesses in a row).
  el.classList.remove(CORRECT.className, INCORRECT.className, SOLVE.className);
  void el.offsetWidth;
  el.classList.add(feel.className);

  const cleanup = () => el.classList.remove(feel.className);
  el.addEventListener('animationend', cleanup, { once: true });
  // Safety net if animationend is missed (e.g. element unmounts mid-animation).
  window.setTimeout(cleanup, feel.duration + 120);
}

/** Quick scale pop + green flash — a positive, accepted beat. */
export function triggerCorrectFeedback(el: HTMLElement | null | undefined): void {
  play(el, CORRECT);
}

/** Horizontal shake + red flash — a rejected/invalid beat. */
export function triggerIncorrectFeedback(el: HTMLElement | null | undefined): void {
  play(el, INCORRECT);
}

/** Bigger pop + soft success glow that fades out — a solved/win beat. */
export function triggerSolveFeedback(el: HTMLElement | null | undefined): void {
  play(el, SOLVE);
}
