// Composes the Synapse radar with the headline numbers: Synapse Score, level,
// XP-to-next progress, and (full mode) total plays. Reads the live profile via
// the reactive store so it updates the instant a play is recorded.
//
//   <SynapsePanel compact />  → a tight row for the result modal
//   <SynapsePanel />          → the full card for the Profile page
//
// Returns null in compact mode when there's nothing to show yet (no plays),
// and an encouraging hint in full mode.

import { useTranslation } from 'react-i18next';
import { useSynapse, synapseScore, levelProgress } from '../lib/synapse';
import SynapseRadar from './SynapseRadar';

export default function SynapsePanel({ compact = false }: { compact?: boolean }) {
  const { t } = useTranslation();
  const profile = useSynapse();

  if (profile.plays === 0) {
    if (compact) return null;
    return <p className="py-8 text-center text-sm text-white/50">{t('synapse.play')}</p>;
  }

  const score = synapseScore(profile);
  const { frac } = levelProgress(profile);
  const pct = Math.round(frac * 100);

  if (compact) {
    return (
      <div className="mt-4 flex items-center justify-center gap-4 rounded-2xl bg-white/[0.06] p-3">
        <SynapseRadar profile={profile} radius={50} />
        <div className="text-left">
          <div className="font-dot text-[10px] font-semibold uppercase tracking-wide text-white/40">
            {t('synapse.score')}
          </div>
          <div className="text-3xl font-black leading-none tabular-nums text-accent-cyan">{score}</div>
          <div className="mt-2 inline-flex items-center gap-1 rounded-full bg-success/15 px-2 py-0.5 text-xs font-bold text-success">
            ⚡ {t('synapse.level')} {profile.level}
          </div>
          <div className="mt-1.5 h-1.5 w-24 overflow-hidden rounded-full bg-white/15">
            <div className="h-full rounded-full bg-success transition-all" style={{ width: `${pct}%` }} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-3xl border border-white/10 bg-white/[0.05] p-5 shadow-elevated">
      <div className="flex justify-center">
        <SynapseRadar profile={profile} radius={92} />
      </div>
      <div className="mt-5 grid grid-cols-3 gap-3 text-center">
        <div>
          <div className="text-2xl font-black tabular-nums text-accent-cyan">{score}</div>
          <div className="text-[10px] leading-tight text-white/40">{t('synapse.score')}</div>
        </div>
        <div>
          <div className="text-2xl font-black tabular-nums text-success">{profile.level}</div>
          <div className="text-[10px] leading-tight text-white/40">{t('synapse.level')}</div>
        </div>
        <div>
          <div className="text-2xl font-black tabular-nums text-white">{profile.plays}</div>
          <div className="text-[10px] leading-tight text-white/40">{t('synapse.plays')}</div>
        </div>
      </div>
      <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-white/15">
        <div className="h-full rounded-full bg-success transition-all" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
