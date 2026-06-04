import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { GAMES, type GameCategory } from '../games/registry';
import GameCard from '../components/GameCard';
import AdSlot from '../components/AdSlot';
import { getStreak } from '../lib/storage';

const SECTIONS: GameCategory[] = ['must-have', 'recommended', 'innovative'];

export default function Home() {
  const { t } = useTranslation();
  const streak = getStreak();

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-3xl px-4 py-6">
        <section className="mb-8 text-center">
          <h1 className="font-cyber text-2xl leading-tight sm:text-3xl">{t('home.hero')}</h1>
          <p className="mt-2 text-slate-500">{t('home.sub')}</p>
          {streak > 0 && (
            <div className="mt-5 inline-flex items-center gap-3 rounded-2xl border border-amber-200 bg-gradient-to-r from-amber-50 to-yellow-50 px-5 py-3 text-left shadow-sm">
              <span
                className={`text-3xl leading-none ${
                  streak >= 3 ? 'animate-[pulse_2s_ease-in-out_infinite]' : ''
                }`}
                aria-hidden
              >
                🔥
              </span>
              <span className="flex flex-col">
                <span className="text-2xl font-extrabold leading-none text-amber-900">{streak}</span>
                <span className="mt-1 text-xs font-semibold uppercase tracking-wide text-amber-600">
                  {t('home.streak')}
                </span>
              </span>
            </div>
          )}
        </section>

        {SECTIONS.map((cat) => {
          const items = GAMES.filter((g) => g.category === cat);
          if (!items.length) return null;
          return (
            <section key={cat} className="mb-8">
              <h2 className="font-dot mb-3 border-l-[3px] border-brand pl-2.5 text-sm font-bold uppercase tracking-wider text-slate-500">
                {t(`home.sections.${cat}`)}
              </h2>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {items.map((g) => (
                  <GameCard key={g.id} game={g} />
                ))}
              </div>
            </section>
          );
        })}

        <AdSlot className="mb-6" />

        <Link
          to="/premium"
          className="group relative mb-6 flex items-center justify-between gap-3 overflow-hidden rounded-2xl bg-gradient-to-r from-amber-400 via-orange-500 to-pink-500 px-5 py-4 text-white shadow-md ring-1 ring-white/10 transition-all duration-200 ease-out hover:-translate-y-0.5 hover:shadow-xl active:scale-[0.99]"
        >
          {/* Diagonal "shine" that sweeps across on hover — pure Tailwind, no JS. */}
          <span
            aria-hidden
            className="pointer-events-none absolute inset-y-0 -left-1/3 w-1/3 -skew-x-12 bg-white/25 blur-md transition-transform duration-700 ease-out group-hover:translate-x-[450%]"
          />
          <span className="relative flex items-center gap-2 text-base font-bold">
            ✨ {t('monet.premiumTitle')}
          </span>
          <span className="relative inline-flex items-center gap-1 text-sm font-semibold opacity-95">
            {t('monet.learnMore')} <span aria-hidden>›</span>
          </span>
        </Link>

        <footer className="py-6 text-center text-xs text-slate-300">
          {t('app.name')} · {t('app.tagline')}
        </footer>
      </div>
    </div>
  );
}
