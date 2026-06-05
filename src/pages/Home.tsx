import { lazy, Suspense } from 'react';
import { useTranslation } from 'react-i18next';
import { getStreak } from '../lib/storage';

// The home screen IS the 3D rotating-door game selector now: drag/swipe the
// wheel left-right to browse every game and tap Play. The old panel/grid
// selection has been removed in favor of this immersive experience. The 3D
// stack (three/drei/framer-motion) is still lazy-loaded so the landing paints
// instantly and then swaps in the wheel.
const Rotating3DGameSelector = lazy(() => import('../components/Rotating3DGameSelector'));

const BG = 'radial-gradient(120% 90% at 50% 8%, #1e1b4b 0%, #0b1020 58%, #070a14 100%)';

export default function Home() {
  const { t } = useTranslation();
  const streak = getStreak();

  return (
    <div className="relative h-full w-full overflow-hidden">
      <Suspense
        fallback={
          <div className="flex h-full w-full items-center justify-center" style={{ background: BG }}>
            <div className="animate-[pulse_2s_ease-in-out_infinite] font-display text-sm text-white/70">
              {t('selector.loading', { defaultValue: 'Loading…' })}
            </div>
          </div>
        }
      >
        <Rotating3DGameSelector />
      </Suspense>

      {/* Daily-ritual streak — floating glass chip over the 3D scene. */}
      {streak > 0 && (
        <div className="pointer-events-none absolute left-4 top-4 z-10 inline-flex items-center gap-2 rounded-2xl border border-amber-300/40 bg-amber-500/15 px-3 py-1.5 shadow-lg backdrop-blur-md">
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
    </div>
  );
}
