import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useRewards, openChest, grantBoost, canWatchBoost, CHEST_XP, type ChestPrize } from '../lib/rewards';
import { rarityMeta } from '../lib/rarity';
import { Icon } from './Icons';
import { cn } from '../lib/cn';

// The 7-day chest calendar (CR/BS login loop) + the rewarded XP-boost slot.
// One band on Home: seven day-dots, a chunky OPEN button while today's chest
// is unopened, and a "watch ad → 2× XP" mock button (the future ad slot).
export default function DailyChest() {
  const { t } = useTranslation();
  const { chestReady, chestDay, boostActive, boostsLeft } = useRewards();
  const [prize, setPrize] = useState<ChestPrize | null>(null);
  const [adPhase, setAdPhase] = useState<'idle' | 'playing'>('idle');

  const open = () => {
    const p = openChest();
    if (p) setPrize(p);
  };

  // Mock ad player: 3s countdown, then grant. Swaps for a real rewarded ad later.
  const watchAd = () => {
    if (!canWatchBoost() || adPhase === 'playing') return;
    setAdPhase('playing');
    setTimeout(() => {
      grantBoost();
      setAdPhase('idle');
    }, 3000);
  };

  return (
    <section className="px-4">
      <div className="glass-panel rounded-panel p-4">
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-2 font-display text-base text-white">
            <Icon name="gift" className="h-4 w-4 text-amber-300" />
            {t('chest.title')}
          </h2>
          <span className="text-[11px] font-semibold text-white/45">{t('chest.day', { n: chestDay })}</span>
        </div>

        {/* the 7-day track */}
        <div className="mt-3 flex items-center justify-between gap-1">
          {CHEST_XP.map((xp, i) => {
            const day = i + 1;
            const isToday = day === chestDay && chestReady;
            const done = day < chestDay || (day === chestDay && !chestReady);
            return (
              <div key={day} className="flex flex-1 flex-col items-center gap-1">
                <div
                  className={cn(
                    'grid h-9 w-9 place-items-center rounded-xl text-[10px] font-black ring-1 transition',
                    done && 'bg-emerald-500/15 text-emerald-400 ring-emerald-500/40',
                    isToday && 'bg-gradient-to-br from-amber-400 to-amber-600 text-white ring-amber-300 shadow-glow-sm animate-[pulse_1.6s_ease-in-out_infinite]',
                    !done && !isToday && 'bg-white/[0.05] text-white/35 ring-white/10',
                  )}
                >
                  {done ? <Icon name="check" className="h-4 w-4" /> : day === 7 ? <Icon name="crown" className="h-4 w-4" /> : `+${xp}`}
                </div>
                <span className={cn('text-[8px] font-bold uppercase', isToday ? 'text-amber-300' : 'text-white/30')}>
                  {t('chest.dayShort', { n: day })}
                </span>
              </div>
            );
          })}
        </div>

        {chestReady && (
          <button
            onClick={open}
            className="btn-chunky mt-3 flex min-h-[48px] w-full items-center justify-center gap-2 bg-gradient-to-r from-amber-400 to-amber-600 text-base"
          >
            <Icon name="gift" className="h-5 w-5" />
            {t('chest.open')}
          </button>
        )}

        {/* rewarded boost slot */}
        <div className="mt-3 flex items-center gap-2.5 rounded-xl bg-white/[0.04] px-3 py-2.5">
          <Icon name="zap" className={cn('h-4 w-4 shrink-0', boostActive ? 'text-emerald-400' : 'text-iris-violet')} />
          <span className="min-w-0 flex-1 truncate text-xs font-semibold text-white/75">
            {boostActive ? t('boost.active') : t('boost.pitch')}
          </span>
          {!boostActive && (
            <button
              onClick={watchAd}
              disabled={!canWatchBoost() || adPhase === 'playing'}
              className="tap-target shrink-0 rounded-lg bg-iris-violet/25 px-3 py-1.5 text-[11px] font-bold text-iris-violet ring-1 ring-iris-violet/40 transition hover:bg-iris-violet/35 disabled:opacity-40"
            >
              {adPhase === 'playing' ? t('boost.playing') : t('boost.watch', { n: boostsLeft })}
            </button>
          )}
        </div>
      </div>

      {/* prize reveal */}
      {prize && (
        <div
          className="fixed inset-0 z-[60] grid place-items-center bg-space-0/80 backdrop-blur-md"
          onClick={() => setPrize(null)}
          role="dialog"
        >
          <div
            className="reward-rays pointer-events-none absolute h-[140vmin] w-[140vmin] opacity-60"
            style={{
              background: 'repeating-conic-gradient(rgba(251,191,36,0.6) 0deg 8deg, transparent 8deg 16deg)',
              maskImage: 'radial-gradient(circle, #000 0%, transparent 62%)',
              WebkitMaskImage: 'radial-gradient(circle, #000 0%, transparent 62%)',
            }}
          />
          <div className="reward-pop relative flex flex-col items-center gap-3">
            <div className="text-[11px] font-black uppercase tracking-[0.3em] text-amber-300">
              {t('chest.day', { n: prize.day })}
            </div>
            <div className="grid h-32 w-32 place-items-center rounded-3xl bg-gradient-to-br from-amber-400 to-amber-600 shadow-glow-lg">
              <span className="font-display text-3xl text-white">+{prize.xp}</span>
            </div>
            <div className="font-display text-lg text-white">{t('chest.xpReward', { n: prize.xp })}</div>
            {prize.bonus && (
              <div
                className="rarity-tile rarity-shine flex items-center gap-2 px-4 py-2"
                style={{ ['--rar' as string]: rarityMeta(prize.bonus.rarity).gradient }}
              >
                <Icon name={prize.bonus.icon} className="h-5 w-5" style={{ color: rarityMeta(prize.bonus.rarity).color }} />
                <span className="text-sm font-bold text-white">{t(prize.bonus.nameKey)}</span>
              </div>
            )}
            <div className="rounded-full bg-white/10 px-4 py-1.5 text-xs font-bold text-white/70">{t('pass.tapToClose')}</div>
          </div>
        </div>
      )}
    </section>
  );
}
