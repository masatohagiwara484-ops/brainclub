import { lazy, Suspense } from 'react';
import { useTranslation } from 'react-i18next';
import { GAMES, type GameCategory } from '../games/registry';
import BrainFieldBg from '../components/BrainFieldBg';
import ErrorBoundary from '../components/ErrorBoundary';
import { Link } from 'react-router-dom';
import DailyRitual from '../components/DailyRitual';
import GameTile from '../components/GameTile';
import { Skeleton } from '../components/Skeleton';
import { Icon } from '../components/Icons';
import { useBrainPass, MAX_TIER } from '../lib/brainPass';

// Home 2.0 — a structured, scrollable landing built on two pillars:
//   1. HERO: the holographic card deck (swipe → tap → play) as the emotional
//      showcase, in a fixed-height band so it can never crowd the rest out.
//   2. STRUCTURE: the daily-ritual band (the habit core) and category grids of
//      GameTiles are ALWAYS present below — browsing no longer depends on the
//      hero, so a GPU/shader failure just hides the showcase instead of
//      degrading the whole screen to an emoji wall.
const HolographicCardSelector = lazy(() => import('../components/HolographicCardSelector'));

const SECTIONS: GameCategory[] = ['must-have', 'recommended', 'innovative'];

export default function Home() {
  const { t } = useTranslation();

  return (
    <div className="relative h-full w-full overflow-y-auto overscroll-contain">
      {/* Instant, lightweight mood-setter behind everything. */}
      <BrainFieldBg />

      <div className="relative z-10 mx-auto flex max-w-2xl flex-col gap-5 pb-8">
        {/* Hero band: the holo deck. Fails/loads gracefully — structure below
            is independent. */}
        <section className="h-[46vh] min-h-[340px] max-h-[460px] shrink-0">
          <ErrorBoundary fallback={<HeroFallback />}>
            <Suspense fallback={<HeroSkeleton />}>
              <HolographicCardSelector />
            </Suspense>
          </ErrorBoundary>
        </section>

        {/* Brain Pass banner — the season reward hook. */}
        <PassBanner />

        {/* The daily ritual — the habit loop front and center. */}
        <DailyRitual />

        {/* Category grids: every game, always reachable, one visual system. */}
        {SECTIONS.map((cat) => {
          const games = GAMES.filter((g) => g.category === cat);
          if (games.length === 0) return null;
          return (
            <section key={cat} className="px-4">
              <h2 className="mb-2.5 px-1 font-display text-sm uppercase tracking-[0.16em] text-white/55">
                {t(`home.sections.${cat}`)}
              </h2>
              <div className="grid grid-cols-3 gap-2.5">
                {games.map((g) => (
                  <GameTile key={g.id} game={g} />
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}

// The Brain Pass entry banner — season tier + a one-tap route into the ladder.
function PassBanner() {
  const { t } = useTranslation();
  const { tier } = useBrainPass();
  return (
    <Link
      to="/pass"
      className="mx-4 flex items-center gap-3 overflow-hidden rounded-panel bg-gradient-to-r from-amber-500/20 via-iris-violet/20 to-iris-magenta/20 p-3 ring-1 ring-white/15 transition active:scale-[0.98]"
    >
      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 shadow-glow-sm">
        <Icon name="ticket" className="h-6 w-6 text-white" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="font-display text-sm text-white">{t('pass.banner')}</div>
        <div className="truncate text-[11px] text-white/55">{t('pass.bannerSub')}</div>
      </div>
      <span className="shrink-0 rounded-full bg-white/10 px-2.5 py-1 text-xs font-extrabold tabular-nums text-white">
        {t('pass.tier', { n: tier })}/{MAX_TIER}
      </span>
      <Icon name="chevronRight" className="h-5 w-5 shrink-0 text-white/50" />
    </Link>
  );
}

// While the deck's chunk loads: a card-shaped shimmer where the hero will be.
function HeroSkeleton() {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-4">
      <Skeleton className="aspect-[5/7] w-[min(64vw,240px)] rounded-[1.25rem]" />
      <Skeleton className="h-14 w-64 rounded-3xl" />
    </div>
  );
}

// If WebGL/CSS-3D rendering throws, the hero quietly steps aside — the grid
// below already covers browsing, so no emoji wall, no dead end.
function HeroFallback() {
  const { t } = useTranslation();
  return (
    <div className="flex h-full items-center justify-center px-8">
      <p className="text-center text-sm text-white/45">{t('home.heroUnavailable')}</p>
    </div>
  );
}
