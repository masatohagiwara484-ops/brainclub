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
        surface: 'var(--surface)', // base card/sheet background (white today)
        'surface-2': 'var(--surface-2)', // subtle inset / muted background (slate-100 today)
      },

      // ---- Elevation tokens (NEW, additive) ----
      // Softer, layered shadows for a chess.com-style depth. Opt-in only; no
      // existing element references these, so nothing changes until used.
      boxShadow: {
        game: '0 2px 6px rgba(15, 23, 42, 0.08), 0 8px 20px rgba(15, 23, 42, 0.06)',
        elevated: '0 10px 30px rgba(15, 23, 42, 0.14), 0 2px 8px rgba(15, 23, 42, 0.08)',
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
        display: ['system-ui', 'Avenir', 'Helvetica', 'Arial', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
