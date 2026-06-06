import { Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { sound } from '../lib/sound';
import { Icon, type IconName } from './Icons';

// chess.com-style bottom tab bar: Home / Score / Subscription / Settings.
// Light, white-based to match the app; the active tab gets a brand-tinted pill
// behind its icon. Hidden during gameplay (/play/*) for an immersive screen —
// there the header's back chevron handles navigation.
const TABS: { to: string; key: string; icon: IconName }[] = [
  { to: '/', key: 'nav.home', icon: 'home' },
  { to: '/score', key: 'nav.score', icon: 'score' },
  { to: '/premium', key: 'nav.subscription', icon: 'subscription' },
  { to: '/settings', key: 'nav.settings', icon: 'settings' },
];

export default function BottomNav() {
  const { t } = useTranslation();
  const loc = useLocation();
  if (loc.pathname.startsWith('/play/')) return null;

  const isActive = (to: string) =>
    to === '/' ? loc.pathname === '/' : loc.pathname.startsWith(to);
  // On the immersive dark home, the tab bar blends into the hero; light pages
  // keep the frosted-white bar.
  const dark = loc.pathname === '/';

  return (
    <nav
      aria-label={t('nav.tabs')}
      className={`z-20 flex shrink-0 items-stretch justify-around border-t pb-[env(safe-area-inset-bottom)] backdrop-blur ${
        dark ? 'border-white/10 bg-slate-950/70' : 'border-slate-200 bg-white/95'
      }`}
    >
      {TABS.map((tab) => {
        const active = isActive(tab.to);
        const activeCls = active
          ? dark
            ? 'bg-white/15 text-white'
            : 'bg-brand/10 text-brand'
          : dark
            ? 'text-white/55'
            : 'text-slate-400';
        const labelCls = active ? (dark ? 'text-white' : 'text-brand') : dark ? 'text-white/55' : 'text-slate-400';
        return (
          <Link
            key={tab.to}
            to={tab.to}
            onClick={() => sound.playTab()}
            aria-current={active ? 'page' : undefined}
            className="flex flex-1 flex-col items-center gap-0.5 pb-1.5 pt-2"
          >
            <span className={`flex h-8 w-16 items-center justify-center rounded-full transition-colors ${activeCls}`}>
              <Icon name={tab.icon} className="h-6 w-6" />
            </span>
            <span className={`text-[11px] font-semibold leading-none transition-colors ${labelCls}`}>{t(tab.key)}</span>
          </Link>
        );
      })}
    </nav>
  );
}
