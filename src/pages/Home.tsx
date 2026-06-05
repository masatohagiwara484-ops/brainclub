import { lazy, Suspense } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { getStreak } from '../lib/storage';
import { GAMES } from '../games/registry';
import BrainFieldBg from '../components/BrainFieldBg';

// The home screen is built around the 3D rotating-door game selector as its
// hero: a floating "brain field" backdrop sets the mood the instant the app
// opens, the wheel dominates the center, and a large premium PLAY slab sits at
// its base. Drag/swipe the wheel to browse every game, then tap PLAY (or pick a
// daily favorite below). The heavy 3D stack (three/drei/framer-motion) stays
// lazy-loaded so the landing — backdrop included — paints instantly and the
// wheel swaps in.
const Rotating3DGameSelector = lazy(() => import('../components/Rotating3DGameSelector'));

const BG = 'radial-gradient(120% 90% at 50% 8%, #1e1b4b 0%, #0b1020 58%, #070a14 100%)';

// Daily-favorites quick picks — the must-have core, one tap straight into play.
const FAVORITES = GAMES.filter((g) => g.category === 'must-have' && g.available);

export default function Home() {
  const { t } = useTranslation();
  const nav = useNavigate();
  const streak = getStreak();

  return (
    <div className="relative flex h-full w-full flex-col overflow-hidden" style={{ background: BG }}>
      {/* Instant, lightweight mood-setter behind everything. */}
      <BrainFieldBg />

      {/* Daily-ritual streak — floating glass chip over the scene. */}
      {streak > 0 && (
        <div className="pointer-events-none absolute left-4 top-4 z-20 inline-flex items-center gap-2 rounded-2xl border border-amber-300/40 bg-amber-500/15 px-3 py-1.5 shadow-lg backdrop-blur-md">
          <span
            className={`text-lg leading-none ${streak >= 3 ? 'animate-[pulse_2s_ease-in-out_infinite]' : ''}`}
            aria-hidden
          >
            🔥
          </span>
          <span className="flex items-baseline gap-1">
            <span className="text-base font-extrabold leading-none text-amber-200">{streak}</span>
            <span className="text-[10px] font-semibold uppercase tracking-wide text-amber-200/80">
              {t('home.streak')}
            </span>
          </span>
        </div>
      )}

      {/* Hero: the 3D rotating selector + its big PLAY slab dominate the screen. */}
      <div className="relative z-10 min-h-0 flex-1">
        <Suspense
          fallback={
            <div className="flex h-full w-full items-center justify-center">
              <div className="animate-[pulse_2s_ease-in-out_infinite] font-display text-sm text-white/70">
                {t('selector.loading', { defaultValue: 'Loading…' })}
              </div>
            </div>
          }
        >
          <Rotating3DGameSelector embedded />
        </Suspense>
      </div>

      {/* Daily favorites — a slim quick-pick strip tucked under the hero. */}
      <div className="relative z-10 shrink-0 px-4 pb-3 pt-1">
        <div className="mb-1.5 px-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-white/45">
          {t('home.sections.must-have')}
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {FAVORITES.map((g) => (
            <button
              key={g.id}
              onClick={() => nav(g.route)}
              className="flex shrink-0 items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-left backdrop-blur-md transition-premium hover:border-white/20 hover:bg-white/10 active:scale-95"
            >
              <span className="text-xl leading-none">{g.emoji}</span>
              <span className="whitespace-nowrap text-xs font-semibold text-white/80">{t(g.nameKey)}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
