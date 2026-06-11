import { useTranslation } from 'react-i18next';
import { rarityMeta } from '../lib/rarity';
import type { Reward } from '../lib/brainPass';
import { Icon } from './Icons';

// The juicy claim moment (CR/BS chest reveal): rays + a rarity card that pops
// up with the reward. Tap anywhere to dismiss. Reduced-motion shows it static.
export default function RewardReveal({ reward, onClose }: { reward: Reward; onClose: () => void }) {
  const { t } = useTranslation();
  const meta = rarityMeta(reward.rarity);
  return (
    <div
      className="fixed inset-0 z-[60] grid place-items-center bg-space-0/80 backdrop-blur-md"
      onClick={onClose}
      role="dialog"
      aria-label={t(reward.nameKey)}
    >
      {/* radiant rays behind the card */}
      <div
        className="reward-rays pointer-events-none absolute h-[140vmin] w-[140vmin] opacity-60"
        style={{
          background: `repeating-conic-gradient(${meta.glow} 0deg 8deg, transparent 8deg 16deg)`,
          maskImage: 'radial-gradient(circle, #000 0%, transparent 62%)',
          WebkitMaskImage: 'radial-gradient(circle, #000 0%, transparent 62%)',
        }}
      />
      <div className="reward-pop relative flex flex-col items-center gap-3">
        <div className="text-[11px] font-black uppercase tracking-[0.3em]" style={{ color: meta.color }}>
          {t(meta.nameKey)}
        </div>
        <div
          className="rarity-tile rarity-shine grid h-36 w-28 place-items-center rounded-2xl"
          style={{ ['--rar' as string]: meta.gradient, boxShadow: `0 0 50px ${meta.glow}` }}
        >
          <Icon name={reward.icon} className="h-14 w-14" style={{ color: meta.color }} />
        </div>
        <div className="font-display text-xl text-white">{t(reward.nameKey)}</div>
        <div className="rounded-full bg-white/10 px-4 py-1.5 text-xs font-bold text-white/70">
          {t('pass.tapToClose')}
        </div>
      </div>
    </div>
  );
}
