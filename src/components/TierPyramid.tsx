import { useTranslation } from 'react-i18next';
import { TIERS, tierForScore, tierProgress } from '../lib/tiers';

// A stacked pyramid of the tier ladder: narrow Master rung on top, wide Novice
// at the base. Your current rung is filled with its tier color and glows; the
// rest are muted with a color dot. Below, a bar shows progress to the next tier.
export default function TierPyramid({ score }: { score: number }) {
  const { t } = useTranslation();
  const current = tierForScore(score);
  const { next, frac, toNext } = tierProgress(score);
  const rows = [...TIERS].reverse(); // master (top) → novice (bottom)

  return (
    <div className="rounded-3xl border border-slate-200 p-5 shadow-sm">
      <div className="flex flex-col items-center gap-1.5">
        {rows.map((tier, rowFromTop) => {
          const active = tier.id === current.id;
          const width = 46 + rowFromTop * 9; // % — widens toward the base
          return (
            <div key={tier.id} className="flex w-full justify-center">
              <div
                className={`relative flex items-center justify-center rounded-lg py-2 text-sm font-bold transition ${
                  active ? 'text-white' : 'text-slate-500'
                }`}
                style={{
                  width: `${width}%`,
                  background: active ? tier.color : '#f1f5f9',
                  boxShadow: active ? `0 0 0 2px #fff, 0 6px 18px ${tier.color}66` : undefined,
                }}
              >
                {!active && (
                  <span
                    className="absolute left-3 h-2.5 w-2.5 rounded-full"
                    style={{ background: tier.color }}
                    aria-hidden
                  />
                )}
                {t(tier.nameKey)}
                {active && (
                  <span className="absolute right-2.5 rounded-full bg-white/25 px-2 py-0.5 text-[11px] font-bold tabular-nums">
                    {Math.round(score)}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-5">
        {next ? (
          <>
            <div className="mb-1 flex items-center justify-between text-xs font-semibold text-slate-500">
              <span>{t(current.nameKey)}</span>
              <span className="tabular-nums">{t('tier.toNext', { n: toNext, tier: t(next.nameKey) })}</span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200">
              <div
                className="h-full rounded-full transition-all"
                style={{ width: `${Math.round(frac * 100)}%`, background: next.color }}
              />
            </div>
          </>
        ) : (
          <p className="text-center text-sm font-semibold" style={{ color: current.color }}>
            {t('tier.maxReached')}
          </p>
        )}
      </div>
    </div>
  );
}
