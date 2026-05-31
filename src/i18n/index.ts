import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './en.json';
import ja from './ja.json';
import { getSetting } from '../lib/storage';

// English-first (primary market). Japanese available. Detect saved preference,
// else browser language, else English.
function initialLang(): string {
  const saved = getSetting<string | null>('lang', null);
  if (saved) return saved;
  if (typeof navigator !== 'undefined' && navigator.language.startsWith('ja')) return 'ja';
  return 'en';
}

i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    ja: { translation: ja },
  },
  lng: initialLang(),
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
});

export default i18n;
