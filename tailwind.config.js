/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // ---- Core palette (unchanged — kept literal so existing screens and
        // any opacity modifiers like `bg-brand/50` stay pixel-identical). ----
        ink: '#0f172a', // primary text on white
        panel: '#ffffff', // cards / modals
        brand: '#2563eb', // primary blue (boxes, buttons)
        brandDark: '#1d4ed8',
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
