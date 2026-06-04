import { useTranslation } from 'react-i18next';
import { TIERS, tierForScore, tierProgress } from '../lib/tiers';

// A stacked pyramid of the tier ladder: narrow Master rung on top, wide Novice
// at the base. Reached rungs wear their tier's metallic gradient; your CURRENT
// rung is lifted, ringed and glows in its tier color; higher rungs are dimmed so
// they read as something to climb toward. Below, a bar shows progress + the
// exact points to the next tier.
//
// `score` defaults to a mock so the component previews standalone; the Score tab
// passes the real Synapse score. No data wiring lives here.
export default function TierPyramid({ score = 52 }: { score?: number }) {
  const { t } = useTranslation();
  const current = tierForScore(score);
  const { next, frac, toNext } = tierProgress(score);
  const rows = [...TIERS].reverse(); // master (top) → novice (bottom)

  return (
    <div className="rounded-3xl border border-slate-200 p-5 shadow-game">
      <div className="flex flex-col items-center gap-2">
        {rows.map((tier, rowFromTop) => {
          const active = tier.id === current.id;
          const reached = score >= tier.min;
          const width = 46 + rowFromTop * 9; // % — widens toward the base

          return (
            <div key={tier.id} className="flex w-full justify-center">
              <div
                style={{
                  width: `${width}%`,
                  boxShadow: active
                    ? `0 8px 22px ${tier.color}59, 0 0 0 1px ${tier.color}40`
                    : reached
                      ? '0 1px 2px rgba(15,23,42,0.10)'
                      : undefined,
                }}
                className={`relative flex items-center justify-center overflow-hidden rounded-xl py-2.5 text-sm font-bold transition-all duration-200 ease-out ${
                  reached
                    ? `bg-gradient-to-br ${tier.gradient} ${tier.text}`
                    : 'bg-slate-100 text-slate-400'
                } ${active ? 'scale-[1.035] ring-2 ring-white' : ''}`}
              >
                {/* Glossy top sheen — the metallic highlight on reached rungs. */}
                {reached && (
                  <span
                    aria-hidden
                    className="pointer-events-none absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-white/30 to-transparent"
                  />
                )}
                {/* Color dot hints a locked rung's identity. */}
                {!reached && (
                  <span
                    aria-hidden
                    className="absolute left-3 h-2.5 w-2.5 rounded-full opacity-70"
                    style={{ background: tier.color }}
                  />
                )}
                <span className="relative tracking-wide">{t(tier.nameKey)}</span>
                {active && (
                  <span className="absolute right-2.5 rounded-full bg-black/15 px-2 py-0.5 text-[11px] font-extrabold tabular-nums backdrop-blur-sm">
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
            <div className="mb-1.5 flex items-center justify-between text-xs font-semibold">
              <span style={{ color: current.color }}>{t(current.nameKey)}</span>
              <span className="tabular-nums text-slate-600">
                {t('tier.toNext', { n: toNext, tier: t(next.nameKey) })}
              </span>
            </div>
            <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-200">
              <div
                className="h-full rounded-full bg-gradient-to-r transition-all duration-500 ease-out"
                style={{
                  width: `${Math.round(frac * 100)}%`,
                  backgroundImage: `linear-gradient(to right, ${current.color}, ${next.color})`,
                }}
              />
            </div>
          </>
        ) : (
          <p className="text-center text-sm font-bold" style={{ color: current.color }}>
            {t('tier.maxReached')}
          </p>
        )}
      </div>
    </div>
  );
}
