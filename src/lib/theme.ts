// Premium design-system tokens + the hook that activates the premium theme.
//
// The CSS custom properties in styles/index.css remain the runtime source of
// truth (so theming stays in ONE place and supports data-theme switching); the
// typed `palette` here is the convenient, autocomplete-friendly mirror for TS
// code that needs a raw hex (e.g. canvas / Three.js / canvas-confetti, none of
// which can read CSS vars).

import { useEffect } from 'react';

/** Canonical premium palette. Mirrors the [data-theme='premium'] CSS vars. */
export const palette = {
  primary: '#6366F1', // indigo — lead accent
  accentCyan: '#67E8F9',
  accentPink: '#F472B6',
  success: '#34D399',
  surface: '#0F172A', // deep slate — dark premium surfaces/modals
  brand: '#6366F1', // brand == premium indigo (re-skinned from the old #2563EB)
} as const;

export type ThemeToken = keyof typeof palette;

/** Resolve a token to its hex value (typed). */
export function color(token: ThemeToken): string {
  return palette[token];
}

export const THEME_ATTR = 'data-theme';
export const PREMIUM_THEME = 'premium';

/**
 * Flag the document as the premium theme by setting data-theme="premium" on the
 * <html> element. We deliberately target <html> (documentElement) rather than
 * the Layout root, because that root already carries data-theme="zen" for the
 * FX engine — the premium vars live one level up and cascade down, so the two
 * theming systems coexist without clobbering each other.
 *
 * Returns the typed palette for ergonomic use at the call site.
 */
export function useTheme(): typeof palette {
  useEffect(() => {
    document.documentElement.setAttribute(THEME_ATTR, PREMIUM_THEME);
  }, []);
  return palette;
}
