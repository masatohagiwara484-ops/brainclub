import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useCloud } from '../lib/cloud';
import { useMonetization } from '../lib/monetization';
import { isUnlocked } from '../lib/inventory';
import { rarityMeta } from '../lib/rarity';
import { NAMEPLATES, getEquippedPlate, equipPlate } from '../lib/nameplates';
import { TITLES, getEquippedTitleId, equipTitle, titleEarned } from '../lib/titles';
import { FRAMES, frameUnlocked, getEquippedFrame, equipFrame } from '../lib/cosmetics';
import RarityTile from './RarityTile';
import NamePlate from './NamePlate';
import { Icon } from './Icons';
import { cn } from '../lib/cn';

type Tab = 'plates' | 'titles' | 'frames';

// The cosmetics locker (Clash-Royale "collection"): tabbed pickers for name
// plates, titles and avatar frames, each tile in the shared rarity language.
// Locked items open the paywall. Equipping persists immediately.
export default function CosmeticLocker({ avatar }: { avatar: string }) {
  const { t } = useTranslation();
  const cloud = useCloud();
  const m = useMonetization();
  const plan = m.getPlan();
  const [tab, setTab] = useState<Tab>('plates');
  const [, bump] = useState(0);
  const force = () => bump((x) => x + 1);
  const ctx = { elo: cloud.account?.elo ?? 1000, wins: cloud.account?.wins ?? 0 };

  const plate = getEquippedPlate();
  const frame = getEquippedFrame();
  const titleId = getEquippedTitleId();

  return (
    <div>
      {/* tab bar */}
      <div className="mb-2 flex gap-1 rounded-xl bg-white/[0.05] p-1">
        {(['plates', 'titles', 'frames'] as const).map((tb) => (
          <button
            key={tb}
            onClick={() => setTab(tb)}
            className={cn(
              'min-h-[36px] flex-1 rounded-lg text-xs font-bold transition',
              tab === tb ? 'bg-gradient-to-r from-iris-cyan via-iris-violet to-iris-magenta text-white' : 'text-white/50',
            )}
          >
            {t(`locker.${tb}`)}
          </button>
        ))}
      </div>

      {tab === 'plates' && (
        <div className="grid grid-cols-2 gap-2">
          {NAMEPLATES.map((p) => {
            const unlocked = isUnlocked(p.unlock, plan, p.id);
            const sel = plate.id === p.id;
            return (
              <RarityTile
                key={p.id}
                rarity={p.rarity}
                selected={sel}
                locked={!unlocked}
                ariaLabel={t(p.nameKey)}
                onClick={() => {
                  if (!unlocked) return m.openPaywall();
                  equipPlate(p.id);
                  force();
                }}
                className="!p-1"
              >
                <NamePlate name={t(p.nameKey)} plateId={p.id} size="sm" className="w-full" />
              </RarityTile>
            );
          })}
        </div>
      )}

      {tab === 'titles' && (
        <div className="grid grid-cols-2 gap-2">
          {/* "none" option */}
          <button
            onClick={() => { equipTitle(''); force(); }}
            className={cn('tap-target rounded-xl bg-white/[0.04] text-xs font-semibold text-white/60', titleId === '' && 'ring-2 ring-white/80')}
          >
            {t('locker.noTitle')}
          </button>
          {TITLES.map((ti) => {
            const unlocked = ti.unlock ? isUnlocked(ti.unlock, plan, ti.id) : titleEarned(ti, ctx);
            const sel = titleId === ti.id;
            const meta = rarityMeta(ti.rarity);
            return (
              <RarityTile
                key={ti.id}
                rarity={ti.rarity}
                selected={sel}
                locked={!unlocked}
                ariaLabel={t(ti.nameKey)}
                onClick={() => {
                  if (!unlocked) return ti.unlock ? m.openPaywall() : undefined;
                  equipTitle(ti.id);
                  force();
                }}
                className="min-h-[44px]"
              >
                <span className="px-1 text-center text-[11px] font-bold leading-tight" style={{ color: meta.color }}>
                  {t(ti.nameKey)}
                </span>
              </RarityTile>
            );
          })}
        </div>
      )}

      {tab === 'frames' && (
        <div className="grid grid-cols-4 gap-2">
          {FRAMES.map((f) => {
            const unlocked = frameUnlocked(f, plan);
            const sel = frame.id === f.id;
            return (
              <button
                key={f.id}
                onClick={() => {
                  if (!unlocked) return m.openPaywall();
                  equipFrame(f.id);
                  force();
                }}
                aria-label={t(f.nameKey)}
                className={cn('tap-target relative grid h-14 w-14 place-items-center rounded-full p-[3px] transition', sel && 'ring-2 ring-iris-violet')}
                style={{ background: f.ring }}
              >
                <span className="grid h-full w-full place-items-center rounded-full bg-space-2 text-lg">{avatar}</span>
                {!unlocked && (
                  <span className="absolute inset-0 grid place-items-center rounded-full bg-black/50">
                    <Icon name="lock" className="h-4 w-4 text-white/90" />
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
