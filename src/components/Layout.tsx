import type { ReactNode } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { setSetting } from '../lib/storage';

// Universal layout: the brand, language toggle and back/settings live in the
// SAME place on every screen (a core UX requirement from the strategy doc).
export default function Layout({ children }: { children: ReactNode }) {
  const { t, i18n } = useTranslation();
  const loc = useLocation();
  const nav = useNavigate();
  const onHome = loc.pathname === '/';

  const toggleLang = () => {
    const next = i18n.language.startsWith('ja') ? 'en' : 'ja';
    i18n.changeLanguage(next);
    setSetting('lang', next);
  };

  return (
    <div className="flex h-[100dvh] flex-col bg-ink text-white">
      <header className="z-20 flex items-center justify-between border-b border-white/10 px-4 py-3">
        <div className="flex items-center gap-2">
          {!onHome && (
            <button
              onClick={() => nav('/')}
              className="rounded-lg px-2 py-1 text-white/70 hover:text-white"
              aria-label={t('nav.back')}
            >
              ‹
            </button>
          )}
          <Link to="/" className="flex items-center gap-2 font-bold tracking-tight">
            <span className="text-lg">🧠</span>
            <span>{t('app.name')}</span>
          </Link>
        </div>
        <button
          onClick={toggleLang}
          className="rounded-lg border border-white/15 px-2.5 py-1 text-xs font-semibold text-white/80 hover:bg-white/10"
        >
          {i18n.language.startsWith('ja') ? '日本語' : 'EN'}
        </button>
      </header>
      <main className="relative flex-1 overflow-hidden">{children}</main>
    </div>
  );
}
