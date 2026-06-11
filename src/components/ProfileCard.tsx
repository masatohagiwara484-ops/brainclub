import { useTranslation } from 'react-i18next';
import { useCloud } from '../lib/cloud';
import { useSynapse, synapseScore } from '../lib/synapse';
import { getStreak } from '../lib/storage';
import { tierForScore } from '../lib/tiers';
import { eloRank, isPlacement, PLACEMENT_GAMES } from '../lib/elo';
import { getEquippedFrame, badges } from '../lib/cosmetics';
import { useEquippedPlate } from '../lib/nameplates';
import { useEquippedTitle, getTitle } from '../lib/titles';
import { rarityMeta } from '../lib/rarity';
import { Icon, type IconName } from './Icons';
import CosmeticLocker from './CosmeticLocker';
import { cn } from '../lib/cn';

// The identity card (chess.com / Clash-Royale style): framed avatar, name,
// rank chip, a 6-stat grid, and the badge wall. The frame row doubles as the
// cosmetics storefront — locked frames open the paywall.
export default function ProfileCard() {
  const { t } = useTranslation();
  const cloud = useCloud();
  const profile = useSynapse();

  const acc = cloud.account;
  const name = acc?.username ?? t('cosmetics.guest');
  const avatar = acc?.avatar ?? '🧠';
  const score = synapseScore(profile);
  const tier = tierForScore(score);
  const streak = getStreak();
  const frame = getEquippedFrame();
  const plate = useEquippedPlate();
  const equippedTitle = getTitle(useEquippedTitle());
  const games = (acc?.wins ?? 0) + (acc?.losses ?? 0);
  const wall = badges(acc ? { wins: acc.wins, losses: acc.losses } : undefined);

  const stats: Array<{ icon: IconName; label: string; value: string }> = [
    { icon: 'score', label: t('synapse.score'), value: String(score) },
    { icon: 'zap', label: t('synapse.level'), value: String(profile.level) },
    { icon: 'flame', label: t('home.streak'), value: String(streak) },
    { icon: 'play', label: t('synapse.plays'), value: String(profile.plays) },
    {
      icon: 'swords',
      label: t('cosmetics.record'),
      value: acc ? `${acc.wins}-${acc.losses}` : '—',
    },
    {
      icon: 'trophy',
      label: t('leaderboard.ranked'),
      value: acc
        ? isPlacement(games)
          ? t('online.placement', { n: games, total: PLACEMENT_GAMES })
          : `${t(`online.rank.${eloRank(acc.elo).id}`)} ${acc.elo}`
        : '—',
    },
  ];

  return (
    <div className="glass-panel overflow-hidden rounded-panel">
      {/* banner = equipped name plate */}
      <div className="h-20" style={{ background: plate.bg }}>
        <span aria-hidden className="block h-full w-full bg-gradient-to-b from-white/15 to-transparent" />
      </div>
      <div className="-mt-10 px-4 pb-4">
        {/* framed avatar */}
        <div
          className="grid h-[76px] w-[76px] place-items-center rounded-full p-[3px]"
          style={{ background: frame.ring, boxShadow: frame.glow ? `0 0 22px ${frame.glow}` : undefined }}
        >
          <span className="grid h-full w-full place-items-center rounded-full bg-space-2 text-4xl">{avatar}</span>
        </div>
        <div className="mt-2 flex items-center gap-2">
          <h2 className="font-display truncate text-xl text-white">{name}</h2>
          <span
            className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-extrabold uppercase text-white"
            style={{ background: tier.color }}
          >
            {t(tier.nameKey)}
          </span>
        </div>
        {equippedTitle && (
          <div className="mt-0.5 text-xs font-bold" style={{ color: rarityMeta(equippedTitle.rarity).color }}>
            {t(equippedTitle.nameKey)}
          </div>
        )}

        {/* stat grid */}
        <div className="mt-3 grid grid-cols-3 gap-2">
          {stats.map((s) => (
            <div key={s.label} className="rounded-xl bg-white/[0.05] px-2 py-2 text-center ring-1 ring-white/10">
              <Icon name={s.icon} className="mx-auto h-4 w-4 text-iris-violet" />
              <div className="mt-1 truncate text-sm font-extrabold tabular-nums text-white">{s.value}</div>
              <div className="truncate text-[9px] uppercase tracking-wide text-white/40">{s.label}</div>
            </div>
          ))}
        </div>

        {/* cosmetics locker (plates / titles / frames) */}
        <div className="mt-4">
          <div className="mb-1.5 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-white/40">
            <Icon name="sparkles" className="h-3.5 w-3.5" /> {t('locker.title')}
          </div>
          <CosmeticLocker avatar={avatar} />
        </div>

        {/* badge wall */}
        <div className="mt-3">
          <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-white/40">
            {t('cosmetics.badges')}
          </div>
          <div className="grid grid-cols-4 gap-2">
            {wall.map((b) => (
              <div
                key={b.id}
                title={t(b.nameKey)}
                className={cn(
                  'flex flex-col items-center gap-1 rounded-xl px-1 py-2 ring-1',
                  b.earned ? 'bg-iris-violet/10 ring-iris-violet/40' : 'bg-white/[0.03] ring-white/10 opacity-40',
                )}
              >
                <Icon name={b.icon as IconName} className={cn('h-5 w-5', b.earned ? 'text-iris-cyan' : 'text-white/30')} />
                <span className="line-clamp-1 text-center text-[8px] font-semibold leading-tight text-white/60">
                  {t(b.nameKey)}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
