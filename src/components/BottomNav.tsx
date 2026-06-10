import { Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { sound } from '../lib/sound';
import { Icon, type IconName } from './Icons';
import { cn } from '../lib/cn';

// HOLO 2.0 bottom tab bar: five tabs on a frosted-glass dock. The active tab
// lifts with an iridescent pill + glow so "where am I" reads at a glance; every
// tab is a full-height ≥44px touch target. Hidden during gameplay (/play/*,
// /online/*) for an immersive screen — there the header's back chevron handles
// navigation. Bottom safe-area padding keeps it clear of the home indicator.
const TABS: { to: string; key: string; icon: IconName }[] = [
  { to: '/', key: 'nav.home', icon: 'home' },
  { to: '/score', key: 'nav.score', icon: 'score' },
  { to: '/leaderboard', key: 'nav.leaderboard', icon: 'trophy' },
  { to: '/premium', key: 'nav.subscription', icon: 'subscription' },
  { to: '/settings', key: 'nav.settings', icon: 'settings' },
];

export default function BottomNav() {
  const { t } = useTranslation();
  const loc = useLocation();
  if (loc.pathname.startsWith('/play/') || loc.pathname.startsWith('/online/')) return null;

  const isActive = (to: string) =>
    to === '/' ? loc.pathname === '/' : loc.pathname.startsWith(to);

  return (
    <nav
      aria-label={t('nav.tabs')}
      className="z-20 shrink-0 border-t border-white/10 bg-space-1/85 pb-safe backdrop-blur-xl"
    >
      <div className="flex items-stretch justify-around px-safe">
        {TABS.map((tab) => {
          const active = isActive(tab.to);
          return (
            <Link
              key={tab.to}
              to={tab.to}
              onClick={() => sound.playTab()}
              aria-current={active ? 'page' : undefined}
              className="tap-target flex flex-1 flex-col items-center gap-1 pb-2 pt-2.5"
            >
              <span
                className={cn(
                  'flex h-8 w-14 items-center justify-center rounded-full transition-all duration-200',
                  active
                    ? 'bg-gradient-to-r from-iris-cyan/25 via-iris-violet/25 to-iris-magenta/25 text-white shadow-glow-sm'
                    : 'text-white/45',
                )}
              >
                <Icon name={tab.icon} className="h-[22px] w-[22px]" />
              </span>
              <span
                className={cn(
                  'text-[11px] font-semibold leading-none transition-colors',
                  active ? 'text-white' : 'text-white/45',
                )}
              >
                {t(tab.key)}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
