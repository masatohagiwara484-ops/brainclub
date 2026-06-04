// The canonical, reactive settings store (Mission 2).
//
// All user preferences live here behind a tiny pub/sub so any component — the
// header quick-toggles, the Settings page, and games — sees the same value and
// re-renders together when one changes. Persistence delegates to:
//   • sound.ts  / haptics.ts  (they own their own setting.* keys), and
//   • storage's getSetting/setSetting for theme / reduceMotion / colorBlind.
// fx.ts reads `reduceMotion` straight from storage to avoid an import cycle.

import { useEffect, useReducer } from 'react';
import { getSetting, setSetting } from './storage';
import { sound } from './sound';
import { haptics } from './haptics';

// The app is locked to the calm "zen" look (the Arcade theme was retired). The
// type and token remain so FX/CSS keep reading [data-theme="zen"] unchanged.
export type Theme = 'zen';

type Listener = () => void;
let listeners: Listener[] = [];
function emit(): void {
  for (const l of listeners) l();
}
export function subscribeSettings(l: Listener): () => void {
  listeners.push(l);
  return () => {
    listeners = listeners.filter((x) => x !== l);
  };
}

export const settings = {
  getTheme(): Theme {
    return 'zen';
  },

  isSound(): boolean {
    return sound.isEnabled();
  },
  setSound(v: boolean): void {
    sound.setEnabled(v);
    if (v) sound.unlock(); // arm audio from within the click gesture
    emit();
  },

  // Background music (separate from SFX) + master volume.
  isBgm(): boolean {
    return sound.isBgm();
  },
  setBgm(v: boolean): void {
    sound.setBgm(v);
    if (v) sound.unlock(); // arm audio from within the click gesture
    emit();
  },
  getVolume(): number {
    return sound.getVolume();
  },
  setVolume(v: number): void {
    sound.setVolume(v);
    emit();
  },

  isHaptics(): boolean {
    return haptics.isEnabled();
  },
  setHaptics(v: boolean): void {
    haptics.setEnabled(v);
    if (v) haptics.tick(); // a tiny buzz confirms it's on (Android)
    emit();
  },

  isReduceMotion(): boolean {
    return getSetting<boolean>('reduceMotion', false);
  },
  setReduceMotion(v: boolean): void {
    setSetting('reduceMotion', v);
    emit();
  },

  isColorBlind(): boolean {
    return getSetting<boolean>('colorBlind', false);
  },
  setColorBlind(v: boolean): void {
    setSetting('colorBlind', v);
    emit();
  },
};

/** Subscribe a component to settings changes (returns the shared store). */
export function useSettings(): typeof settings {
  const [, force] = useReducer((x: number) => x + 1, 0);
  useEffect(() => subscribeSettings(force), []);
  return settings;
}
