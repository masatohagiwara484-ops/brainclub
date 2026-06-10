import { useTranslation } from 'react-i18next';
import SynapsePanel from '../components/SynapsePanel';
import AccountPanel from '../components/AccountPanel';
import ProfileCard from '../components/ProfileCard';
import { Icon } from '../components/Icons';
import { getStreak } from '../lib/storage';
import { GAME_BG } from '../components/GameShell';

// The growth dashboard: the Synapse radar (memory / logic / reflex), level and
// XP progress, total plays, and the daily streak. All client-side, no login.
export default function Profile() {
  const { t } = useTranslation();
  const streak = getStreak();

  return (
    <div className="h-full overflow-y-auto text-white" style={{ background: GAME_BG }}>
      <div className="mx-auto max-w-md px-5 py-6 pb-12">
        <h1 className="font-display text-2xl text-iris">{t('synapse.title')}</h1>
        <p className="mt-1 text-sm text-white/60">{t('synapse.play')}</p>

        <div className="mt-5">
          <ProfileCard />
        </div>

        <div className="mt-4">
          <AccountPanel />
        </div>

        <div className="mt-5">
          <SynapsePanel />
        </div>

        {streak > 0 && (
          <div className="glass-panel mt-4 flex items-center justify-center gap-2 rounded-panel py-3 text-sm text-white/80">
            <Icon name="flame" className="h-4 w-4 text-amber-300" />
            <span className="font-semibold">{streak}</span>
            <span className="text-white/40">{t('home.streak')}</span>
          </div>
        )}

        <p className="mt-8 text-center text-xs text-white/30">
          {t('app.name')} · {t('app.tagline')}
        </p>
      </div>
    </div>
  );
}
