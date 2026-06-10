import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { GAMES } from '../games/registry';
import { dailySeed, makeRng } from '../lib/daily';
import { useQuests, applyStreakShield } from '../lib/quests';
import { useMonetization, isPaid } from '../lib/monetization';
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
  const m = useMonetization();
  const paid = isPaid(m.getPlan());
  const { quests, progress, perfect, streak } = useQuests();
  // Streak Shield: bridge a single missed day for paid players (once per mount).
  useMemo(() => applyStreakShield(paid), [paid]);

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

        {/* Today's three quests — clear all three for a Perfect Day (banks the streak). */}
        <div className="mt-3 space-y-1.5">
          {quests.map((q) => {
            const done = (progress[q.id] ?? 0) >= q.target;
            const cur = Math.min(progress[q.id] ?? 0, q.target);
            const game = q.gameId ? t(`games.${q.gameId}.name`) : '';
            return (
              <div key={q.id} className="flex items-center gap-2.5 rounded-xl bg-white/[0.04] px-3 py-2">
                <span className={`grid h-5 w-5 shrink-0 place-items-center rounded-full text-[10px] font-black ${done ? 'bg-gradient-to-r from-iris-cyan via-iris-violet to-iris-magenta text-white' : 'bg-white/10 text-white/40'}`}>
                  {done ? '✓' : cur}
                </span>
                <span className={`min-w-0 flex-1 truncate text-xs font-semibold ${done ? 'text-white/45 line-through' : 'text-white/85'}`}>
                  {t(q.nameKey, { n: q.target, game })}
                </span>
                <span className="shrink-0 text-[10px] tabular-nums text-white/35">{cur}/{q.target}</span>
              </div>
            );
          })}
          {perfect && (
            <div className="rounded-xl bg-gradient-to-r from-iris-cyan/15 via-iris-violet/15 to-iris-magenta/15 px-3 py-2 text-center text-xs font-bold text-iris-cyan">
              {t('quests.perfect')}
            </div>
          )}
          {paid && (
            <p className="px-1 text-[10px] text-white/30">{t('quests.shield')}</p>
          )}
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
