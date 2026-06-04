import { useTranslation } from 'react-i18next';
import SynapsePanel from '../components/SynapsePanel';

// The Score tab: your Synapse score, level and 3-axis radar. The tier pyramid
// (Bronze → Master, with your rung highlighted) lands here in F2.
export default function Score() {
  const { t } = useTranslation();

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-md px-5 py-6">
        <h1 className="font-cyber text-2xl">{t('score.title')}</h1>
        <p className="mt-1 text-sm text-slate-500">{t('score.sub')}</p>

        <div className="mt-5">
          <SynapsePanel />
        </div>

        <p className="mt-6 text-center text-[11px] leading-snug text-slate-300">{t('score.disclaimer')}</p>
      </div>
    </div>
  );
}
