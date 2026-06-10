---
name: holo-design
description: BrainClub's HOLO 2.0 design language. MUST be read before writing or modifying ANY UI in this repo (pages, components, game HUDs, modals, result screens). Defines the tokens, utilities, components and hard rules that keep every screen looking like one premium product.
---

# HOLO 2.0 — BrainClub design language

The app's identity is **holographic premium**: deep-space darkness, frosted
glass surfaces, and one signature iridescent sweep (cyan → violet → magenta).
Every screen must read as the same product. When you touch UI, compose the
vocabulary below — never hand-roll new rgba() values, shadows, or fonts.

## Tokens (defined in `src/styles/index.css` :root, mapped in `tailwind.config.js`)

| Use | Tailwind | Value |
|---|---|---|
| Page void / app bg / surface / sheet | `bg-space-0/1/2/3` | #05060d → #161b36 |
| Iridescent accents | `text-iris-cyan / iris-violet / iris-magenta` | #22d3ee / #818cf8 / #e879f9 |
| Signature gradient | `bg-gradient-to-r from-iris-cyan via-iris-violet to-iris-magenta` | the hologram sweep |
| Glows | `shadow-glow-sm / glow / glow-lg` | iridescent halos |
| Status | `text-success / warning / danger` | semantic, themeable |

## CSS utilities (in `src/styles/index.css`)

- `.glass-panel` — THE surface for cards/chips/sheets (blur + border + inner highlight). Add `.glass-strong` for higher emphasis.
- `.text-iris` — iridescent gradient text for hero headings only (≤1 per screen).
- `.holo-border` — animated conic iridescent border; reserve for the single hero object of a screen.
- `.bg-aurora` — page backdrop for non-game pages (Layout already applies it).
- `.holo-halo` — drop-shadow glow under hero artwork.
- `.pt-safe / .pb-safe / .px-safe` — safe-area padding. EVERY fixed/absolute chrome element must respect notches and the home indicator.
- `.tap-target` — min 44×44px hit area. Required on every small control.
- `.transition-premium` — the standard easing for hover/active states.

## Typography

- Headings: `.font-display` (Space Grotesk 700). Hero headings may add `.text-iris`.
- Body/UI: Inter (default `font-sans`).
- `font-dot` / `font-cyber` (DotGothic16) are LEGACY — do not add new uses; remove when convenient.
- Minimum text size 11px; body ≥14px.

## Components (reuse, never duplicate)

- `components/Button.tsx` — variants `primary` (iridescent CTA), `secondary` (glass), `ghost`, `danger`; all ≥44px. Icon-only: `className="h-11 w-11 rounded-full p-0"`.
- `components/Icons.tsx` — `<Icon name=… />` backed by lucide-react. **Never use emoji as UI icons** (emoji allowed only as content, e.g. avatars). Add new lucide imports to the curated map rather than importing elsewhere.
- `components/Skeleton.tsx` — `Skeleton / SkeletonRow / SkeletonList` for ALL async loading; never show "…" or blank gaps.
- `lib/cn.ts` — `cn()` for className merging in any component accepting `className`.
- `components/GameShell.tsx` — in-game chrome; games must not invent their own HUD scaffolding.

## Hard rules

1. **No emoji as icons** in chrome/nav/buttons. Use `<Icon>`.
2. **≥44px touch targets** for everything tappable.
3. **Safe areas**: any element pinned to a screen edge uses the safe utilities.
4. **One hero per screen**: a single `.text-iris` heading and/or one `.holo-border` object; everything else stays quiet glass.
5. **reduced-motion**: every new animation must be disabled (or simplified to a static state) under `prefers-reduced-motion`.
6. **i18n**: all user-facing strings go through `t()` with keys in BOTH `src/i18n/en.json` and `ja.json`. No `defaultValue` left behind.
7. **Loading/empty states**: every async view gets a Skeleton AND a designed empty state (icon + one-line guidance), never a bare message.
8. Canvas games must read accent colors from `lib/gamePalette.ts` / CSS vars via `lib/theme.ts` `color()` — no new hard-coded hex in game HUD chrome.

## Verification

After UI changes: `npx tsc -b && npm run build` must pass. If you changed a
game with a `scripts/verify-<id>.mjs`, run it.
