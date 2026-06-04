import { useTranslation } from 'react-i18next';
import SynapsePanel from '../components/SynapsePanel';
import AccountPanel from '../components/AccountPanel';
import { getStreak } from '../lib/storage';

// The growth dashboard: the Synapse radar (memory / logic / reflex), level and
// XP progress, total plays, and the daily streak. All client-side, no login.
export default function Profile() {
  const { t } = useTranslation();
  const streak = getStreak();

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-md px-5 py-6">
        <h1 className="font-cyber text-2xl">{t('synapse.title')}</h1>
        <p className="mt-1 text-sm text-slate-500">{t('synapse.play')}</p>

        <div className="mt-5">
          <AccountPanel />
        </div>

        <div className="mt-5">
          <SynapsePanel />
        </div>

        {streak > 0 && (
          <div className="mt-4 flex items-center justify-center gap-2 rounded-2xl bg-slate-50 py-3 text-sm text-slate-700">
            🔥 <span className="font-semibold">{streak}</span>
            <span className="text-slate-400">{t('home.streak')}</span>
          </div>
        )}

        <p className="mt-8 text-center text-xs text-slate-300">
          {t('app.name')} · {t('app.tagline')}
        </p>
      </div>
    </div>
  );
}
