// Monetization store (Mission 8) — UI MOCK ONLY, no payment processing.
//
// Three revenue pillars from the strategy doc, all simulated client-side:
//   • Premium subscription  — removes ads, unlocks every cosmetic, "pro" stats.
//   • Cosmetics (skins)     — recolor the whole app via a [data-skin] token on
//                             the Layout root. Owned skins persist in localStorage.
//   • Ads (free tier)       — placeholder slots shown only while NOT premium.
//
// Playing every game stays 100% free; cosmetics and subscription touch only the
// look and comfort (never pay-to-win). Like settings.ts this is a tiny reactive
// pub/sub singleton so the header, Shop, Paywall and AdSlots all see one state
// and re-render together. It also owns the open/close state of the Shop and
// Paywall so any component can trigger them imperatively (monet.openShop()).
//
// The pure ownership/skin rules live in plain functions (canApply / nextOwned)
// so scripts/verify-monetization.mjs can mirror and assert them without a TS
// runtime — same discipline as synapse.ts.

import { useEffect, useReducer } from 'react';
import { getSetting, setSetting } from './storage';

export type SkinId = 'default' | 'sunset' | 'ocean' | 'forest' | 'aurora' | 'mono';

export type SkinDef = {
  id: SkinId;
  /** Swatch gradient endpoints (mirror of the CSS [data-skin] tokens). */
  c1: string;
  c2: string;
  /** Display price label for the mock shop (no real charge ever happens). */
  price: string;
  /** Premium-only cosmetics unlock automatically with a subscription. */
  premium?: boolean;
};

// The catalog. `default` is always owned and free. Swatch colors here MUST mirror
// the [data-skin='…'] blocks in styles/index.css (kept in sync by hand).
export const SKINS: SkinDef[] = [
  { id: 'default', c1: '#6366f1', c2: '#a5b4fc', price: '' },
  { id: 'sunset', c1: '#fb7185', c2: '#f59e0b', price: '$1.99' },
  { id: 'ocean', c1: '#06b6d4', c2: '#3b82f6', price: '$1.99' },
  { id: 'forest', c1: '#22c55e', c2: '#84cc16', price: '$1.99' },
  { id: 'aurora', c1: '#a855f7', c2: '#ec4899', price: '$2.99', premium: true },
  { id: 'mono', c1: '#475569', c2: '#94a3b8', price: '$2.99', premium: true },
];

const DEFAULT_OWNED: SkinId[] = ['default'];

// The Premium pitch, shared by the Paywall modal and the /premium landing page
// (i18n keys under `monet.perks.*`) so the two never drift apart.
export const PREMIUM_PERK_KEYS = ['noAds', 'allSkins', 'proStats', 'support'] as const;

// ---- Subscription plans (F3) --------------------------------------------------
// Two paid tiers stack on top of the free tier. Higher rank ⊇ lower rank, so a
// feature is granted when your plan's rank meets the feature's minimum. UI mock
// only — `subscribe(plan)` just records the tier; no billing ever happens.

export type Plan = 'free' | 'plus' | 'pro';
export const PLAN_RANK: Record<Plan, number> = { free: 0, plus: 1, pro: 2 };

export type PlanFeature =
  | 'noAds'
  | 'allSkins'
  | 'themes'
  | 'proStats'
  | 'exclusiveThemes'
  | 'earlyAccess';

// Minimum plan rank that unlocks each feature (1 = Plus+, 2 = Pro only).
export const FEATURE_MIN_RANK: Record<PlanFeature, number> = {
  noAds: 1,
  allSkins: 1,
  themes: 1,
  proStats: 2,
  exclusiveThemes: 2,
  earlyAccess: 2,
};

/** Does a plan grant a feature? (pure — mirrored by verify-monetization.mjs) */
export function planHas(plan: Plan, feature: PlanFeature): boolean {
  return PLAN_RANK[plan] >= FEATURE_MIN_RANK[feature];
}
/** Any paid tier (drives ad removal + cosmetic unlocks). */
export function isPaid(plan: Plan): boolean {
  return PLAN_RANK[plan] > 0;
}

export type PlanId = Exclude<Plan, 'free'>;
export type PlanDef = {
  id: PlanId;
  /** i18n key prefix, e.g. monet.plans.plus.{name,price,per,tagline} */
  i18n: string;
  /** Perks listed on the card (in order). */
  perks: PlanFeature[];
  /** Accent color for the card border / CTA. */
  accent: string;
  /** The headline tier gets a "popular" ribbon. */
  featured?: boolean;
};

// Plus (entry) on the left, Pro (featured) on the right.
export const PLANS: PlanDef[] = [
  { id: 'plus', i18n: 'monet.plans.plus', perks: ['noAds', 'allSkins', 'themes'], accent: '#3b82f6' },
  {
    id: 'pro',
    i18n: 'monet.plans.pro',
    perks: ['noAds', 'allSkins', 'themes', 'proStats', 'exclusiveThemes', 'earlyAccess'],
    accent: '#a855f7',
    featured: true,
  },
];

// All features in display order for the comparison table.
export const ALL_FEATURES: PlanFeature[] = [
  'noAds',
  'allSkins',
  'themes',
  'proStats',
  'exclusiveThemes',
  'earlyAccess',
];

// ---- Pure rules (mirrored by verify-monetization.mjs) -------------------------

/** Skins a user effectively owns = explicitly bought ∪ (all, if premium). */
export function effectiveOwned(owned: SkinId[], premium: boolean): SkinId[] {
  if (premium) return SKINS.map((s) => s.id);
  const set = new Set<SkinId>([...DEFAULT_OWNED, ...owned]);
  return SKINS.map((s) => s.id).filter((id) => set.has(id));
}

/** A skin can be applied only if it is (effectively) owned. */
export function canApply(skin: SkinId, owned: SkinId[], premium: boolean): boolean {
  return effectiveOwned(owned, premium).includes(skin);
}

/** Buying adds the skin to the owned list (idempotent, order-stable). */
export function nextOwned(owned: SkinId[], skin: SkinId): SkinId[] {
  return owned.includes(skin) ? owned : [...owned, skin];
}

// ---- Reactive store -----------------------------------------------------------

type Listener = () => void;
let listeners: Listener[] = [];
function emit(): void {
  for (const l of listeners) l();
}
export function subscribeMonetization(l: Listener): () => void {
  listeners.push(l);
  return () => {
    listeners = listeners.filter((x) => x !== l);
  };
}

// Transient (non-persisted) modal state.
let shopOpen = false;
let paywallOpen = false;

export const monet = {
  // --- Subscription plan (mock) ---
  /** The active tier. Falls back to the legacy `premium` boolean (→ Pro). */
  getPlan(): Plan {
    const p = getSetting<Plan | null>('plan', null);
    if (p === 'free' || p === 'plus' || p === 'pro') return p;
    return getSetting<boolean>('premium', false) ? 'pro' : 'free';
  },
  /** Any paid tier — drives ad removal and cosmetic unlocks. */
  isPremium(): boolean {
    return isPaid(this.getPlan());
  },
  isPro(): boolean {
    return this.getPlan() === 'pro';
  },
  /** Does the active plan grant a given feature? */
  hasFeature(feature: PlanFeature): boolean {
    return planHas(this.getPlan(), feature);
  },
  /** Mock "subscribe" to a tier — records the plan, no real billing. */
  subscribe(plan: PlanId = 'pro'): void {
    setSetting('plan', plan);
    setSetting('premium', true); // keep the legacy flag in sync
    paywallOpen = false;
    emit();
  },
  /** Mock "cancel" — back to the free tier so ads return. */
  cancel(): void {
    setSetting('plan', 'free');
    setSetting('premium', false);
    emit();
  },

  // --- Ads (free tier only) ---
  showAds(): boolean {
    return !this.isPremium();
  },

  // --- Cosmetics ---
  getSkin(): SkinId {
    return getSetting<SkinId>('skin', 'default');
  },
  ownedSkins(): SkinId[] {
    return getSetting<SkinId[]>('ownedSkins', DEFAULT_OWNED);
  },
  isOwned(skin: SkinId): boolean {
    return canApply(skin, this.ownedSkins(), this.isPremium());
  },
  /** Mock "buy" — unlocks and immediately applies the skin. */
  buy(skin: SkinId): void {
    setSetting('ownedSkins', nextOwned(this.ownedSkins(), skin));
    setSetting('skin', skin);
    emit();
  },
  /** Apply an owned skin; silently ignored if not owned (guarded in UI too). */
  setSkin(skin: SkinId): void {
    if (!this.isOwned(skin)) return;
    setSetting('skin', skin);
    emit();
  },

  // --- Modal orchestration (imperative, like the FX bus) ---
  isShopOpen(): boolean {
    return shopOpen;
  },
  openShop(): void {
    shopOpen = true;
    emit();
  },
  closeShop(): void {
    shopOpen = false;
    emit();
  },
  isPaywallOpen(): boolean {
    return paywallOpen;
  },
  openPaywall(): void {
    paywallOpen = true;
    emit();
  },
  closePaywall(): void {
    paywallOpen = false;
    emit();
  },
};

/** Subscribe a component to monetization changes (returns the shared store). */
export function useMonetization(): typeof monet {
  const [, force] = useReducer((x: number) => x + 1, 0);
  useEffect(() => subscribeMonetization(force), []);
  return monet;
}
