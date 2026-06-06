import type { ReactNode } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useSettings } from '../lib/settings';
import { useMonetization } from '../lib/monetization';
import { useHowto } from '../lib/howto';
import FxLayer from './FxLayer';
import MonetizationLayer from './MonetizationLayer';
import HowToOverlay from './HowToOverlay';
import BottomNav from './BottomNav';
import BgmController from './BgmController';
import { Icon } from './Icons';
import Button from './Button';
import { useTheme } from '../lib/theme';
import { DARK_GAMES } from './darkGames';

// Universal layout (chess.com-style shell): a slim header with the profile on
// the left, brand in the center, and a Premium shortcut on the right, plus a
// persistent bottom tab bar. The many quick-toggles that used to live up here
// (theme / sound / language / shop) now live on the Settings tab, keeping the
// header uncluttered. On a game screen the header swaps to back + help and the
// tab bar hides for an immersive view.
export default function Layout({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  const loc = useLocation();
  const nav = useNavigate();

  // Activate the premium theme (sets data-theme="premium" on <html>).
  useTheme();

  // [data-theme] (Zen/Arcade) and [data-contrast] (color-blind) come from the
  // reactive settings store; [data-skin] (cosmetics) from monetization. They
  // recolor FX/UI with no game-code changes.
  const s = useSettings();
  const theme = s.getTheme();
  const colorBlind = s.isColorBlind();
  const m = useMonetization();
  const skin = m.getSkin();

  // On a game screen (/play/:id[/:difficulty]) the header shows a "?" that
  // replays the textless gesture tutorial for that game (Mission 9).
  const h = useHowto();
  const onPlay = loc.pathname.startsWith('/play/');
  const playId = onPlay ? loc.pathname.split('/')[2] : null;
  // Dark chrome on the immersive home and on any game already migrated to the
  // dark premium GameShell — so the shared header + root blend in rather than
  // clashing as a white strip. Light pages (and not-yet-migrated games) keep the
  // frosted-white chrome. As each game is converted (added to DARK_GAMES) its
  // header darkens automatically.
  const darkChrome = loc.pathname === '/' || (onPlay && !!playId && DARK_GAMES.has(playId));

  return (
    <div
      data-theme={theme}
      data-skin={skin === 'default' ? undefined : skin}
      data-contrast={colorBlind ? 'high' : undefined}
      className={`flex h-[100dvh] flex-col ${darkChrome ? 'bg-[#0b1020] text-white' : 'bg-white text-slate-900'}`}
    >
      <header
        className={`z-20 flex items-center justify-between border-b px-3 py-2.5 ${
          darkChrome
            ? 'border-white/10 bg-transparent'
            : 'border-slate-200/80 backdrop-blur-md supports-[backdrop-filter]:bg-white/80'
        }`}
      >
        {/* Left: profile avatar (or back chevron during a game). Fixed width keeps the brand centered. */}
        <div className="flex w-16 items-center">
          {onPlay ? (
            // Proof of concept for the shared <Button>: ghost variant already
            // supplies hover:bg-slate-100; the !overrides pin it to the original
            // round, icon-only header look (h-9 w-9, slate-500, no padding).
            <Button
              onClick={() => nav('/')}
              variant="ghost"
              aria-label={t('nav.back')}
              leftIcon="back"
              iconClassName="h-6 w-6"
              className={`h-9 w-9 !rounded-full !p-0 ${darkChrome ? '!text-white/80 hover:!bg-white/10' : '!text-slate-500'}`}
            />
          ) : (
            <Link
              to="/profile"
              className={`flex h-9 w-9 items-center justify-center rounded-full border ${
                darkChrome ? 'border-white/25 text-white/80 hover:bg-white/10' : 'border-slate-300 text-slate-500 hover:bg-slate-100'
              }`}
              aria-label={t('nav.profile')}
              title={t('nav.profile')}
            >
              <Icon name="user" className="h-5 w-5" />
            </Link>
          )}
        </div>

        <Link to="/" className="group flex items-center gap-2 tracking-tight">
          <span className="text-xl transition-premium group-hover:scale-110 group-hover:drop-shadow-[0_0_10px_rgba(99,102,241,0.55)]">
            🧠
          </span>
          {/* Premium wordmark: Inter display weight with an indigo→cyan→pink gradient. */}
          <span className="bg-gradient-to-r from-primary via-accent-cyan to-accent-pink bg-clip-text font-display text-xl text-transparent">
            {t('app.name')}
          </span>
        </Link>

        {/* Right: game help (during play) or a Premium shortcut. */}
        <div className="flex w-16 items-center justify-end">
          {onPlay ? (
            playId && (
              <button
                onClick={() => h.open(playId)}
                className={`flex h-9 w-9 items-center justify-center rounded-full ${
                  darkChrome ? 'text-white/80 hover:bg-white/10' : 'text-slate-500 hover:bg-slate-100'
                }`}
                aria-label={t('howto.help')}
                title={t('howto.help')}
              >
                <Icon name="help" className="h-6 w-6" />
              </button>
            )
          ) : (
            <Link
              to="/premium"
              className={`flex h-9 w-9 items-center justify-center rounded-full ${
                darkChrome ? 'text-amber-300 hover:bg-white/10' : 'text-amber-500 hover:bg-amber-50'
              }`}
              aria-label={t('monet.premiumTitle')}
              title={t('monet.premiumTitle')}
            >
              <Icon name="diamond" className="h-6 w-6" />
            </Link>
          )}
        </div>
      </header>

      <main className="relative flex-1 overflow-hidden">
        {children}
        <FxLayer />
        <MonetizationLayer />
        <HowToOverlay />
      </main>

      <BgmController />
      <BottomNav />
    </div>
  );
}
