import type { ReactNode } from 'react';
import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { getSetting, setSetting } from '../lib/storage';
import { sound } from '../lib/sound';
import FxLayer from './FxLayer';

type Theme = 'zen' | 'arcade';

// Universal layout: the brand, language toggle and back/settings live in the
// SAME place on every screen (a core UX requirement from the strategy doc).
export default function Layout({ children }: { children: ReactNode }) {
  const { t, i18n } = useTranslation();
  const loc = useLocation();
  const nav = useNavigate();
  const onHome = loc.pathname === '/';

  // Zen (simple) vs Arcade (flashy) is a [data-theme] token on this root, so
  // the whole FX system reskins live with no game-code changes. Lets the user
  // compare both designs locally (per Mission 1) before we commit to one.
  const [theme, setTheme] = useState<Theme>(() => getSetting<Theme>('theme', 'arcade'));
  const [muted, setMuted] = useState<boolean>(() => !sound.isEnabled());

  const toggleLang = () => {
    const next = i18n.language.startsWith('ja') ? 'en' : 'ja';
    i18n.changeLanguage(next);
    setSetting('lang', next);
  };

  const toggleTheme = () => {
    const next: Theme = theme === 'arcade' ? 'zen' : 'arcade';
    setTheme(next);
    setSetting('theme', next);
  };

  const toggleSound = () => {
    const next = !muted;
    setMuted(next);
    sound.setEnabled(!next);
    if (!next) sound.unlock(); // arm + give an audible confirmation chime
  };

  return (
    <div data-theme={theme} className="flex h-[100dvh] flex-col bg-white text-slate-900">
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
          <Link to="/" className="flex items-center gap-2 tracking-tight">
            <span className="text-lg">🧠</span>
            <span className="font-cyber text-lg">{t('app.name')}</span>
          </Link>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            onClick={toggleTheme}
            className="rounded-lg border border-slate-300 px-2.5 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-100"
            aria-label={t('controls.theme')}
            title={t('controls.theme')}
          >
            {theme === 'arcade' ? `🎆 ${t('controls.arcade')}` : `🧘 ${t('controls.zen')}`}
          </button>
          <button
            onClick={toggleSound}
            className="rounded-lg border border-slate-300 px-2 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-100"
            aria-label={t('controls.sound')}
            aria-pressed={!muted}
            title={t('controls.sound')}
          >
            {muted ? '🔇' : '🔊'}
          </button>
          <button
            onClick={toggleLang}
            className="rounded-lg border border-slate-300 px-2.5 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-100"
          >
            {i18n.language.startsWith('ja') ? '日本語' : 'EN'}
          </button>
        </div>
      </header>
      <main className="relative flex-1 overflow-hidden">
        {children}
        <FxLayer />
      </main>
    </div>
  );
}
