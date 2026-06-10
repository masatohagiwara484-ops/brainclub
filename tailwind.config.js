/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // ---- Core palette ----
        // `brand` is now the premium indigo (#6366F1) and is var-driven via an
        // RGB-channel custom property so opacity modifiers (bg-brand/10, etc.)
        // keep working. Re-point it in ONE place (src/styles/index.css) to
        // re-skin every brand-colored surface across the app at once.
        ink: '#0f172a', // primary text on white
        panel: '#ffffff', // cards / modals
        brand: 'rgb(var(--brand-rgb) / <alpha-value>)',
        brandDark: 'rgb(var(--brand-dark-rgb) / <alpha-value>)',
        accent: '#16a34a', // success / streak

        // ---- Semantic tokens (NEW, additive) ----
        // Var-driven so themes / high-contrast can re-skin them from one place
        // (see :root + [data-contrast='high'] in src/styles/index.css). The
        // CSS-var DEFAULTS mirror the existing palette exactly, so adopting a
        // token is a no-op visually:
        //   success → #16a34a (green-600)   warning → #d97706 (amber-600)
        //   danger  → #dc2626 (red-600)     surface → #ffffff  surface-2 → #f1f5f9
        success: 'var(--success)',
        warning: 'var(--warning)',
        danger: 'var(--danger)',
        surface: 'var(--surface)', // base sheet bg — white by default; the
        // `premium` theme re-points it to a deep #0F172A for dark premium modals.
        'surface-2': 'var(--surface-2)', // subtle inset / muted background (slate-100 today)

        // ---- Premium overhaul palette (NEW, additive) ----
        // Cygames-inspired deep & vibrant accents. Var-driven so the `premium`
        // theme (styles/index.css → [data-theme='premium'] on <html>, set by
        // lib/theme.ts) is the single place that controls the look. Defaults
        // live in :root so the tokens resolve even before the theme attaches.
        primary: 'var(--primary)', // #6366F1 indigo — the new lead accent
        'accent-cyan': 'var(--accent-cyan)', // #67E8F9
        'accent-pink': 'var(--accent-pink)', // #F472B6

        // ---- HOLO 2.0 palette (the overhaul's vocabulary) ----
        // Deep-space bases + the iridescent accent ramp; tokens live in
        // styles/index.css :root. Use space-* for page/surface backgrounds and
        // iris-* for the signature cyan→violet→magenta hologram sweep.
        'space-0': 'var(--space-0)',
        'space-1': 'var(--space-1)',
        'space-2': 'var(--space-2)',
        'space-3': 'var(--space-3)',
        'iris-cyan': 'var(--iris-cyan)',
        'iris-violet': 'var(--iris-violet)',
        'iris-magenta': 'var(--iris-magenta)',
      },

      // ---- Elevation tokens (NEW, additive) ----
      // Softer, layered shadows for a chess.com-style depth. Opt-in only; no
      // existing element references these, so nothing changes until used.
      boxShadow: {
        game: '0 2px 6px rgba(15, 23, 42, 0.08), 0 8px 20px rgba(15, 23, 42, 0.06)',
        elevated: '0 10px 30px rgba(15, 23, 42, 0.14), 0 2px 8px rgba(15, 23, 42, 0.08)',
        // Indigo-tinted "expensive" glow for hero CTAs / premium surfaces.
        premium:
          '0 18px 40px -12px rgba(99, 102, 241, 0.45), 0 6px 16px -8px rgba(15, 23, 42, 0.25)',
        // ---- HOLO 2.0 glows ----
        // Iridescent halos in three intensities; glow-active marks the selected
        // nav tab / focused control with the violet signature.
        'glow-sm': '0 0 12px -2px rgba(129, 140, 248, 0.45)',
        glow: '0 0 24px -4px rgba(129, 140, 248, 0.55), 0 0 48px -12px rgba(34, 211, 238, 0.35)',
        'glow-lg':
          '0 0 40px -6px rgba(129, 140, 248, 0.65), 0 0 80px -16px rgba(232, 121, 249, 0.4)',
      },

      // ---- Refined radius scale (NEW, additive) ----
      // `card` is a semantic alias of the existing `2xl` (1rem) so cards/controls
      // can share one named radius; `panel` is a slightly larger radius for
      // sheets/modals. Both are additive — existing `rounded-*` utilities are
      // untouched.
      borderRadius: {
        card: '1rem',
        panel: '1.25rem',
      },

      fontFamily: {
        // Inter leads the stack now (loaded in index.html) for a premium, modern
        // feel with a wide weight range; system-ui is the swap fallback. The
        // `.font-display` heading class is defined in styles/index.css (it adds
        // the heavy weight + tight tracking), so no `display` key is needed here.
        sans: ['Inter', 'system-ui', 'Avenir', 'Helvetica', 'Arial', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
