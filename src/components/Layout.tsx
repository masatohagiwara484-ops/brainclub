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
    <div className="flex h-[100dvh] flex-col bg-white text-slate-900">
      <header className="z-20 flex items-center justify-between border-b border-slate-200 px-4 py-3">
        <div className="flex items-center gap-2">
          {!onHome && (
            <button
              onClick={() => nav('/')}
              className="rounded-lg px-2 py-1 text-slate-400 hover:text-slate-800"
              aria-label={t('nav.back')}
            >
              ‹
            </button>
          )}
          <Link to="/" className="flex items-center gap-2 font-bold tracking-tight text-slate-900">
            <span className="text-lg">🧠</span>
            <span>{t('app.name')}</span>
          </Link>
        </div>
        <button
          onClick={toggleLang}
          className="rounded-lg border border-slate-300 px-2.5 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-100"
        >
          {i18n.language.startsWith('ja') ? '日本語' : 'EN'}
        </button>
      </header>
      <main className="relative flex-1 overflow-hidden">{children}</main>
    </div>
  );
}
