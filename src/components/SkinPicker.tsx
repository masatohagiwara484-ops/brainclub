import { useTranslation } from 'react-i18next';
import { BOARD_THEMES, themeUnlocked, getGameSkin, setGameSkin } from '../lib/gameSkins';
import { useMonetization } from '../lib/monetization';
import { Icon } from './Icons';
import { cn } from '../lib/cn';

// In-game skin selector: one horizontal row of theme swatches (board colors +
// the two piece tints). Locked tiers show a lock badge and open the paywall —
// this is the storefront moment for Plus/Pro, so it must look desirable, not
// disabled. ≥44px touch targets.
export default function SkinPicker({ gameId, className }: { gameId: string; className?: string }) {
  const { t } = useTranslation();
  const m = useMonetization();
  const plan = m.getPlan();
  const selected = getGameSkin(gameId);

  return (
    <div className={cn('flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden', className)}>
      {BOARD_THEMES.map((th) => {
        const unlocked = themeUnlocked(th, plan);
        const active = selected === th.id;
        return (
          <button
            key={th.id}
            onClick={() => (unlocked ? setGameSkin(gameId, th.id) : m.openPaywall())}
            aria-label={t(th.nameKey)}
            title={t(th.nameKey)}
            className={cn(
              'tap-target relative flex shrink-0 flex-col items-center gap-1 rounded-xl px-2 py-1.5 transition',
              active ? 'bg-white/12 ring-1 ring-iris-violet shadow-glow-sm' : 'bg-white/[0.05] hover:bg-white/10',
            )}
          >
            <span
              className="relative h-8 w-12 overflow-hidden rounded-md ring-1 ring-white/20"
              style={{ background: `linear-gradient(135deg, ${th.boardA} 50%, ${th.boardB} 50%)` }}
            >
              <span className="absolute left-1.5 top-1.5 h-3 w-3 rounded-full" style={{ background: `radial-gradient(circle at 35% 30%, ${th.light[0]}, ${th.light[1]})` }} />
              <span className="absolute bottom-1.5 right-1.5 h-3 w-3 rounded-full" style={{ background: `radial-gradient(circle at 35% 30%, ${th.dark[0]}, ${th.dark[1]})` }} />
              {!unlocked && (
                <span className="absolute inset-0 grid place-items-center bg-black/45">
                  <Icon name={th.tier === 'pro' ? 'crown' : 'diamond'} className="h-3.5 w-3.5 text-amber-300" />
                </span>
              )}
            </span>
            <span className={cn('text-[9px] font-semibold leading-none', active ? 'text-white' : 'text-white/55')}>
              {t(th.nameKey)}
            </span>
          </button>
        );
      })}
    </div>
  );
}
