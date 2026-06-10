import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { GAMES } from '../games/registry';
import { dailySeed, makeRng } from '../lib/daily';
import { getStreak } from '../lib/storage';
import { sound } from '../lib/sound';
import { Icon } from './Icons';
import GameArt from './GameArt';

// The daily-ritual band (the NYT-Games habit core): today's date, the streak
// flame, and three "Today's Training" challenges — Word Guess and Yacht run
// true global dailies (same seed for everyone), plus one deterministic rotating
// pick so the line-up feels fresh every day. One tap goes straight to play.
const DAILY_FIXED = ['wordle', 'yacht'];

export default function DailyRitual() {
  const { t, i18n } = useTranslation();
  const streak = getStreak();

  const games = useMemo(() => {
    const fixed = DAILY_FIXED.map((id) => GAMES.find((g) => g.id === id)).filter(
      (g): g is NonNullable<typeof g> => !!g && g.available,
    );
    // Rotating third slot: deterministic from today's seed, never a duplicate.
    const pool = GAMES.filter((g) => g.available && !DAILY_FIXED.includes(g.id));
    const rng = makeRng(dailySeed('home-rotation'));
    const pick = pool[Math.floor(rng() * pool.length)];
    return pick ? [...fixed, pick] : fixed;
  }, []);

  const today = new Date().toLocaleDateString(i18n.language === 'ja' ? 'ja-JP' : 'en-US', {
    month: 'short',
    day: 'numeric',
    weekday: 'short',
  });

  return (
    <section className="px-4">
      <div className="glass-panel rounded-panel p-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-display text-base text-white">{t('home.dailyTitle')}</h2>
            <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-white/45">
              {today}
            </p>
          </div>
          <div
            className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 ${
              streak > 0 ? 'bg-amber-400/15 text-amber-300' : 'bg-white/[0.06] text-white/40'
            }`}
            title={t('home.streak')}
          >
            <Icon name="flame" className="h-4 w-4" />
            <span className="text-sm font-extrabold leading-none">{streak}</span>
            <span className="text-[10px] font-semibold uppercase tracking-wide opacity-80">
              {t('home.streak')}
            </span>
          </div>
        </div>

        <div className="mt-3 grid grid-cols-3 gap-2">
          {games.map((g, i) => (
            <Link
              key={g.id}
              to={g.route}
              onClick={() => sound.playSelectGame()}
              className="tap-target group relative flex flex-col items-center gap-1.5 rounded-2xl border border-white/10 bg-white/[0.04] px-2 py-3 transition-all duration-200 hover:border-white/25 hover:bg-white/[0.08] active:scale-[0.97]"
            >
              {i < DAILY_FIXED.length && (
                <span className="absolute -top-1.5 rounded-full bg-gradient-to-r from-iris-cyan via-iris-violet to-iris-magenta px-2 py-0.5 text-[8px] font-black uppercase tracking-widest text-white shadow-glow-sm">
                  {t('home.dailyBadge')}
                </span>
              )}
              <GameArt id={g.id} className="h-9 w-9 text-white/95 transition-transform duration-200 group-hover:scale-110" />
              <span className="max-w-full truncate text-[11px] font-semibold text-white/85">
                {t(g.nameKey)}
              </span>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
