import { useTranslation } from 'react-i18next';
import { setSetting } from '../lib/storage';
import { useSettings } from '../lib/settings';
import { useMonetization } from '../lib/monetization';

// A labeled on/off switch row.
function Toggle({
  label,
  note,
  checked,
  onChange,
}: {
  label: string;
  note?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-3.5">
      <div className="min-w-0">
        <div className="font-semibold text-slate-800">{label}</div>
        {note && <p className="mt-0.5 text-xs leading-snug text-slate-400">{note}</p>}
      </div>
      <button
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={() => onChange(!checked)}
        className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${
          checked ? 'bg-brand' : 'bg-slate-300'
        }`}
      >
        <span
          className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-transform ${
            checked ? 'translate-x-[22px]' : 'translate-x-0.5'
          }`}
        />
      </button>
    </div>
  );
}

export default function Settings() {
  const { t, i18n } = useTranslation();
  const s = useSettings();
  const m = useMonetization();
  const isJa = i18n.language.startsWith('ja');

  const setLang = (lang: 'en' | 'ja') => {
    i18n.changeLanguage(lang);
    setSetting('lang', lang);
  };

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-md px-5 py-6">
        <h1 className="font-cyber text-2xl">{t('settings.title')}</h1>

        {/* Language */}
        <section className="mt-6">
          <h2 className="font-dot mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">
            {t('settings.language')}
          </h2>
          <div className="flex gap-2 py-2">
            {(['en', 'ja'] as const).map((lang) => {
              const active = lang === 'ja' ? isJa : !isJa;
              return (
                <button
                  key={lang}
                  onClick={() => setLang(lang)}
                  className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${
                    active ? 'bg-brand text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  {lang === 'ja' ? '日本語' : 'English'}
                </button>
              );
            })}
          </div>
        </section>

        {/* Visual style */}
        <section className="mt-5">
          <h2 className="font-dot mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">
            {t('controls.theme')}
          </h2>
          <p className="mb-2 text-xs leading-snug text-slate-400">{t('settings.themeNote')}</p>
          <div className="grid grid-cols-2 gap-2 py-1">
            {(['zen', 'arcade'] as const).map((th) => {
              const active = s.getTheme() === th;
              return (
                <button
                  key={th}
                  onClick={() => s.setTheme(th)}
                  className={`rounded-2xl border-2 px-4 py-3 text-left transition ${
                    active ? 'border-brand bg-blue-50' : 'border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <div className="text-lg">{th === 'zen' ? '🧘 ' : '🎆 '}{t(`controls.${th}`)}</div>
                  <div className="mt-0.5 text-xs text-slate-400">
                    {t(`settings.${th === 'zen' ? 'zenNote' : 'arcadeNote'}`)}
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        {/* Feedback & accessibility */}
        <section className="mt-5 divide-y divide-slate-100">
          <h2 className="font-dot pb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">
            {t('settings.feedback')}
          </h2>
          <Toggle
            label={t('controls.sound')}
            note={t('settings.soundNote')}
            checked={s.isSound()}
            onChange={(v) => s.setSound(v)}
          />
          <Toggle
            label={t('settings.haptics')}
            note={t('settings.hapticsNote')}
            checked={s.isHaptics()}
            onChange={(v) => s.setHaptics(v)}
          />
          <Toggle
            label={t('settings.reduceMotion')}
            note={t('settings.reduceMotionNote')}
            checked={s.isReduceMotion()}
            onChange={(v) => s.setReduceMotion(v)}
          />
          <Toggle
            label={t('settings.colorBlind')}
            note={t('settings.colorBlindNote')}
            checked={s.isColorBlind()}
            onChange={(v) => s.setColorBlind(v)}
          />
        </section>

        {/* Cosmetics */}
        <section className="mt-5">
          <h2 className="font-dot mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">
            {t('monet.shopTitle')}
          </h2>
          <button
            onClick={() => m.openShop()}
            className="mt-1 flex w-full items-center justify-between rounded-2xl border border-slate-200 px-4 py-3 text-left hover:bg-slate-50"
          >
            <span className="font-semibold text-slate-800">🎨 {t('monet.shopTitle')}</span>
            <span className="text-sm text-slate-400">›</span>
          </button>
        </section>

        <p className="mt-8 text-center text-xs text-slate-300">
          {t('app.name')} · {t('app.tagline')}
        </p>
      </div>
    </div>
  );
}
