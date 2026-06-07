import { useTranslation } from 'react-i18next';
import { useSynapse, synapseScore, levelProgress, AXES } from '../lib/synapse';
import { tierForScore } from '../lib/tiers';
import SynapseRadar from '../components/SynapseRadar';
import TierPyramid from '../components/TierPyramid';
import { GAME_BG } from '../components/GameShell';

// The Score tab: a headline (Synapse Score + tier badge + level), the tier
// pyramid showing where your thinking level sits, and — once you've played —
// the 3-axis radar with a per-axis breakdown.
export default function Score() {
  const { t } = useTranslation();
  const profile = useSynapse();
  const score = synapseScore(profile);
  const tier = tierForScore(score);
  const pct = Math.round(levelProgress(profile).frac * 100);
  const hasPlays = profile.plays > 0;

  return (
    <div className="h-full overflow-y-auto text-white" style={{ background: GAME_BG }}>
      <div className="mx-auto max-w-md px-5 py-6">
        <h1 className="font-cyber text-2xl">{t('score.title')}</h1>
        <p className="mt-1 text-sm text-white/60">{t('score.sub')}</p>

        {/* Headline: score + tier + level */}
        <div className="mt-5 rounded-3xl border border-white/10 bg-white/[0.05] p-5 shadow-elevated">
          <div className="flex items-end justify-between">
            <div>
              <div className="font-dot text-[10px] font-semibold uppercase tracking-wide text-white/40">
                {t('synapse.score')}
              </div>
              <div className="text-5xl font-black leading-none tabular-nums text-accent-cyan">{score}</div>
              <span
                className="mt-2 inline-flex items-center rounded-full px-2.5 py-1 text-xs font-bold text-white"
                style={{ background: tier.color }}
              >
                {t(tier.nameKey)}
              </span>
            </div>
            <div className="text-right">
              <div className="inline-flex items-center gap-1 rounded-full bg-success/15 px-2.5 py-1 text-sm font-bold text-success">
                ⚡ {t('synapse.level')} {profile.level}
              </div>
              <div className="ml-auto mt-2 h-1.5 w-28 overflow-hidden rounded-full bg-white/15">
                <div className="h-full rounded-full bg-success transition-all" style={{ width: `${pct}%` }} />
              </div>
              <div className="mt-1 text-[11px] tabular-nums text-white/40">
                {profile.plays} {t('synapse.plays')}
              </div>
            </div>
          </div>
        </div>

        {/* Tier pyramid */}
        <div className="mt-4">
          <TierPyramid score={score} />
        </div>

        {/* Radar + per-axis breakdown */}
        {hasPlays ? (
          <div className="mt-4 rounded-3xl border border-white/10 bg-white/[0.05] p-5 shadow-elevated">
            <div className="flex justify-center">
              <SynapseRadar profile={profile} radius={92} />
            </div>
            <div className="mt-4 space-y-2.5">
              {AXES.map((a) => (
                <div key={a} className="flex items-center gap-3">
                  <span className="w-16 text-xs font-semibold text-white/70">{t(`synapse.${a}`)}</span>
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-white/15">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{ width: `${Math.round(profile[a])}%`, background: 'var(--fx-accent, #6366f1)' }}
                    />
                  </div>
                  <span className="w-8 text-right text-xs font-bold tabular-nums text-white">
                    {Math.round(profile[a])}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <p className="mt-6 text-center text-sm text-white/50">{t('synapse.play')}</p>
        )}

        <p className="mt-6 text-center text-[11px] leading-snug text-white/30">{t('score.disclaimer')}</p>
      </div>
    </div>
  );
}
