import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMonetization } from '../lib/monetization';
import { useInventory } from '../lib/inventory';
import {
  PASS_TIERS,
  MAX_TIER,
  XP_PER_TIER,
  seasonId,
  useBrainPass,
  hasPremiumPass,
  buyPass,
  claimReward,
  type Reward,
} from '../lib/brainPass';
import { rarityMeta } from '../lib/rarity';
import { Icon } from '../components/Icons';
import RewardReveal from '../components/RewardReveal';
import { GAME_BG } from '../components/GameShell';
import { cn } from '../lib/cn';

// The Brain Pass — a two-track seasonal reward ladder (CR/BS Pass). Horizontal
// scroll of tier columns: FREE row on top, PREMIUM row below. Tap a reached,
// unclaimed reward to claim it with a chest-style reveal. A new season every
// month. Drives the daily-play loop AND the premium-pass purchase.
export default function BrainPass() {
  const { t, i18n } = useTranslation();
  const m = useMonetization();
  useInventory(); // re-render when items are granted
  const plan = m.getPlan();
  const { data, tier, xpInTier } = useBrainPass();
  const premium = hasPremiumPass(plan);
  const [reveal, setReveal] = useState<Reward | null>(null);

  const seasonName = new Date(seasonId() + '-01').toLocaleDateString(
    i18n.language === 'ja' ? 'ja-JP' : 'en-US',
    { year: 'numeric', month: 'long' },
  );

  const claim = (tTier: number, track: 'free' | 'premium') => {
    const r = claimReward(tTier, track, plan);
    if (r) setReveal(r);
  };

  return (
    <div className="h-full overflow-y-auto text-white" style={{ background: GAME_BG }}>
      <div className="mx-auto max-w-2xl px-4 py-6 pb-12">
        {/* header */}
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="font-display text-2xl text-iris">{t('pass.title')}</h1>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-white/45">{seasonName}</p>
          </div>
          <div className="flex items-center gap-1.5 rounded-full bg-white/[0.06] px-3 py-1.5">
            <Icon name="ticket" className="h-4 w-4 text-iris-violet" />
            <span className="text-sm font-extrabold tabular-nums">{t('pass.tier', { n: tier })}</span>
          </div>
        </div>

        {/* tier progress */}
        <div className="mt-3 glass-panel rounded-panel p-4">
          <div className="flex items-center justify-between text-xs">
            <span className="font-bold text-white/70">{t('pass.tier', { n: tier })}</span>
            <span className="tabular-nums text-white/45">
              {tier >= MAX_TIER ? t('pass.maxed') : `${xpInTier} / ${XP_PER_TIER} XP`}
            </span>
          </div>
          <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full bg-gradient-to-r from-iris-cyan via-iris-violet to-iris-magenta transition-all"
              style={{ width: `${tier >= MAX_TIER ? 100 : (xpInTier / XP_PER_TIER) * 100}%` }}
            />
          </div>
          <p className="mt-2 text-[11px] text-white/40">{t('pass.earnHint')}</p>
        </div>

        {/* premium pass CTA */}
        {!premium && (
          <button
            onClick={() => buyPass()}
            className="btn-chunky mt-3 flex w-full items-center justify-center gap-2 bg-gradient-to-r from-amber-400 to-amber-600 px-5 py-3.5 text-base"
          >
            <Icon name="crown" className="h-5 w-5" />
            {t('pass.unlockPremium')}
          </button>
        )}

        {/* track labels */}
        <div className="mt-5 flex flex-col gap-1 text-[10px] font-bold uppercase tracking-wide">
          <span className="text-white/45">{t('pass.freeTrack')}</span>
        </div>

        {/* the ladder — horizontal scroll of tier columns */}
        <div className="-mx-4 mt-1 overflow-x-auto px-4 pb-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <div className="flex gap-2">
            {PASS_TIERS.map((pt) => {
              const reached = tier >= pt.tier;
              return (
                <div key={pt.tier} className="flex w-[76px] shrink-0 flex-col items-center gap-1.5">
                  <RewardCell
                    reward={pt.free}
                    reached={reached}
                    claimed={data.claimedFree.includes(pt.tier)}
                    locked={false}
                    onClaim={() => claim(pt.tier, 'free')}
                  />
                  {/* tier marker */}
                  <div
                    className={cn(
                      'grid h-6 w-6 place-items-center rounded-full text-[11px] font-black tabular-nums ring-2',
                      reached ? 'bg-iris-violet text-white ring-iris-violet/40' : 'bg-white/[0.06] text-white/40 ring-white/10',
                    )}
                  >
                    {pt.tier}
                  </div>
                  <RewardCell
                    reward={pt.premium}
                    reached={reached}
                    claimed={data.claimedPremium.includes(pt.tier)}
                    locked={!premium}
                    onClaim={() => claim(pt.tier, 'premium')}
                  />
                </div>
              );
            })}
          </div>
        </div>
        <div className="mt-1 text-[10px] font-bold uppercase tracking-wide text-amber-300/80">
          <Icon name="crown" className="mr-1 inline h-3 w-3" />
          {t('pass.premiumTrack')}
        </div>
      </div>

      {reveal && <RewardReveal reward={reveal} onClose={() => setReveal(null)} />}
    </div>
  );
}

function RewardCell({
  reward,
  reached,
  claimed,
  locked,
  onClaim,
}: {
  reward: Reward;
  reached: boolean;
  claimed: boolean;
  locked: boolean;
  onClaim: () => void;
}) {
  const meta = rarityMeta(reward.rarity);
  const claimable = reached && !claimed && !locked;
  return (
    <button
      onClick={claimable ? onClaim : undefined}
      disabled={!claimable}
      aria-label={reward.nameKey}
      style={{ ['--rar' as string]: meta.gradient }}
      className={cn(
        'rarity-tile relative grid h-[68px] w-[68px] place-items-center',
        reward.rarity === 'legendary' || reward.rarity === 'mythic' ? 'rarity-shine' : '',
        claimable && 'animate-[pulse_1.6s_ease-in-out_infinite]',
        !reached && 'opacity-45 grayscale',
      )}
    >
      <Icon name={reward.icon} className="h-7 w-7" style={{ color: reached ? meta.color : '#64748b' }} />
      {claimed && (
        <span className="absolute inset-0 grid place-items-center rounded-[inherit] bg-black/55">
          <Icon name="check" className="h-6 w-6 text-emerald-400" />
        </span>
      )}
      {locked && !claimed && (
        <span className="absolute right-1 top-1 grid h-4 w-4 place-items-center rounded-full bg-black/70">
          <Icon name="lock" className="h-2.5 w-2.5 text-amber-300" />
        </span>
      )}
      {claimable && (
        <span className="absolute -bottom-1 rounded-full bg-emerald-500 px-1.5 text-[8px] font-black uppercase text-white shadow">
          !
        </span>
      )}
    </button>
  );
}
