import { useTranslation } from 'react-i18next';
import { setSetting } from '../lib/storage';
import { useSettings } from '../lib/settings';
import { useMonetization } from '../lib/monetization';
import { Icon, type IconName } from '../components/Icons';
import { GAME_BG } from '../components/GameShell';

// A labeled on/off switch row. The track turns to the iridescent sweep when on.
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
        <div className="font-semibold text-white">{label}</div>
        {note && <p className="mt-0.5 text-xs leading-snug text-white/45">{note}</p>}
      </div>
      <button
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={() => onChange(!checked)}
        className={`tap-target relative h-7 w-12 shrink-0 rounded-full transition-colors ${
          checked ? 'bg-gradient-to-r from-iris-cyan via-iris-violet to-iris-magenta' : 'bg-white/20'
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

// A section header with an icon — gives each settings group a clear identity.
function SectionHeader({ icon, label }: { icon: IconName; label: string }) {
  return (
    <h2 className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-white/40">
      <Icon name={icon} className="h-4 w-4" />
      {label}
    </h2>
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
    <div className="h-full overflow-y-auto text-white" style={{ background: GAME_BG }}>
      <div className="mx-auto max-w-md px-5 py-6 pb-12">
        <h1 className="font-display text-2xl text-iris">{t('settings.title')}</h1>

        {/* Language */}
        <section className="glass-panel mt-6 rounded-panel p-4">
          <SectionHeader icon="language" label={t('settings.language')} />
          <div className="flex gap-2">
            {(['en', 'ja'] as const).map((lang) => {
              const active = lang === 'ja' ? isJa : !isJa;
              return (
                <button
                  key={lang}
                  onClick={() => setLang(lang)}
                  className={`min-h-[44px] flex-1 rounded-xl px-4 py-2 text-sm font-semibold transition ${
                    active
                      ? 'bg-gradient-to-r from-iris-cyan via-iris-violet to-iris-magenta text-white shadow-glow-sm'
                      : 'bg-white/[0.06] text-white/80 hover:bg-white/12'
                  }`}
                >
                  {lang === 'ja' ? '日本語' : 'English'}
                </button>
              );
            })}
          </div>
        </section>

        {/* Sound */}
        <section className="glass-panel mt-4 rounded-panel p-4">
          <SectionHeader icon="sound" label={t('settings.sound')} />
          <div className="divide-y divide-white/10">
            <Toggle
              label={t('settings.soundEffects')}
              note={t('settings.soundNote')}
              checked={s.isSound()}
              onChange={(v) => s.setSound(v)}
            />
            <Toggle
              label={t('settings.bgm')}
              note={t('settings.bgmNote')}
              checked={s.isBgm()}
              onChange={(v) => s.setBgm(v)}
            />
            <div className="py-3.5">
              <div className="flex items-center justify-between gap-4">
                <div className="font-semibold text-white">{t('settings.volume')}</div>
                <div className="text-xs tabular-nums text-white/45">{Math.round(s.getVolume() * 100)}</div>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                value={Math.round(s.getVolume() * 100)}
                onChange={(e) => s.setVolume(Number(e.target.value) / 100)}
                aria-label={t('settings.volume')}
                className="mt-2 w-full accent-iris-violet"
              />
            </div>
          </div>
        </section>

        {/* Feedback & accessibility */}
        <section className="glass-panel mt-4 rounded-panel p-4">
          <SectionHeader icon="sparkles" label={t('settings.feedback')} />
          <div className="divide-y divide-white/10">
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
          </div>
        </section>

        {/* Cosmetics */}
        <section className="glass-panel mt-4 rounded-panel p-4">
          <SectionHeader icon="sparkles" label={t('monet.shopTitle')} />
          <button
            onClick={() => m.openShop()}
            className="tap-target flex w-full items-center justify-between rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-left hover:bg-white/10"
          >
            <span className="font-semibold text-white">{t('monet.shopTitle')}</span>
            <Icon name="arrowRight" className="h-4 w-4 text-white/40" />
          </button>
        </section>

        <p className="mt-8 text-center text-xs text-white/30">
          {t('app.name')} · {t('app.tagline')}
        </p>
      </div>
    </div>
  );
}
