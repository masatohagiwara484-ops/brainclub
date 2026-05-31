import { useTranslation } from 'react-i18next';
import { GAMES, type GameCategory } from '../games/registry';
import GameCard from '../components/GameCard';
import { getStreak } from '../lib/storage';

const SECTIONS: GameCategory[] = ['must-have', 'recommended', 'innovative'];

export default function Home() {
  const { t } = useTranslation();
  const streak = getStreak();

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-3xl px-4 py-6">
        <section className="mb-8 text-center">
          <h1 className="text-2xl font-extrabold leading-tight sm:text-3xl">{t('home.hero')}</h1>
          <p className="mt-2 text-white/60">{t('home.sub')}</p>
          {streak > 0 && (
            <div className="mt-4 inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-sm">
              🔥 <span className="font-semibold">{streak}</span>
              <span className="text-white/60">{t('home.streak')}</span>
            </div>
          )}
        </section>

        {SECTIONS.map((cat) => {
          const items = GAMES.filter((g) => g.category === cat);
          if (!items.length) return null;
          return (
            <section key={cat} className="mb-8">
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-white/50">
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

        <footer className="py-6 text-center text-xs text-white/30">
          {t('app.name')} · {t('app.tagline')}
        </footer>
      </div>
    </div>
  );
}
