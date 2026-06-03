// Lightweight haptic feedback wrapper.
//
// Works on Android (Chrome/Firefox) via the Vibration API.
// NOTE: iOS Safari does NOT support navigator.vibrate — Apple blocks web
// haptics, so these calls are silently ignored on iPhone/iPad (no error,
// just no buzz). There is currently no reliable web workaround on iOS.

import { getSetting, setSetting } from './storage';

function canVibrate(): boolean {
  return typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function';
}

// Persisted under setting.haptics (default ON) so the choice survives reloads.
let enabled = getSetting<boolean>('haptics', true);

export const haptics = {
  setEnabled(v: boolean) {
    enabled = v;
    setSetting('haptics', v);
  },
  isEnabled() {
    return enabled;
  },
  /** Tiny tick — e.g. a single slice turn. */
  tick() {
    if (enabled && canVibrate()) navigator.vibrate(10);
  },
  /** Slightly stronger — e.g. snapping into place. */
  bump() {
    if (enabled && canVibrate()) navigator.vibrate(18);
  },
  /** Success pattern — e.g. solving the puzzle. */
  success() {
    if (enabled && canVibrate()) navigator.vibrate([24, 40, 24, 40, 60]);
  },
};
