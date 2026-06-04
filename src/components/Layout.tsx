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

  return (
    <div
      data-theme={theme}
      data-skin={skin === 'default' ? undefined : skin}
      data-contrast={colorBlind ? 'high' : undefined}
      className="flex h-[100dvh] flex-col bg-white text-slate-900"
    >
      <header className="z-20 flex items-center justify-between border-b border-slate-200 px-3 py-2.5">
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
              className="h-9 w-9 !rounded-full !p-0 !text-slate-500"
            />
          ) : (
            <Link
              to="/profile"
              className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-300 text-slate-500 hover:bg-slate-100"
              aria-label={t('nav.profile')}
              title={t('nav.profile')}
            >
              <Icon name="user" className="h-5 w-5" />
            </Link>
          )}
        </div>

        <Link to="/" className="flex items-center gap-2 tracking-tight">
          <span className="text-lg">🧠</span>
          <span className="font-cyber text-lg">{t('app.name')}</span>
        </Link>

        {/* Right: game help (during play) or a Premium shortcut. */}
        <div className="flex w-16 items-center justify-end">
          {onPlay ? (
            playId && (
              <button
                onClick={() => h.open(playId)}
                className="flex h-9 w-9 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100"
                aria-label={t('howto.help')}
                title={t('howto.help')}
              >
                <Icon name="help" className="h-6 w-6" />
              </button>
            )
          ) : (
            <Link
              to="/premium"
              className="flex h-9 w-9 items-center justify-center rounded-full text-amber-500 hover:bg-amber-50"
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
