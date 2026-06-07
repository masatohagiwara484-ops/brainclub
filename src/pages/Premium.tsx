// Subscription page (F3) — UI mock, no billing.
//
// Two paid tiers (Plus / Pro) sit side by side at the top; Pro is featured. Each
// card lists its perks and a mock subscribe button. Below, a comparison table
// spells out what each tier unlocks. The active plan is highlighted and can be
// cancelled (demo) back to free. Plan state lives in useMonetization (getPlan /
// subscribe / cancel) so ads and cosmetic unlocks react instantly.

import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useMonetization, PLANS, ALL_FEATURES, planHas } from '../lib/monetization';
import { GAME_BG } from '../components/GameShell';

export default function Premium() {
  const { t } = useTranslation();
  const nav = useNavigate();
  const m = useMonetization();
  const plan = m.getPlan();
  const paid = plan !== 'free';

  return (
    <div className="h-full overflow-y-auto text-white" style={{ background: GAME_BG }}>
      <div className="mx-auto max-w-md px-5 py-6">
        <div className="text-center">
          <div className="text-4xl">✨</div>
          <h1 className="font-cyber mt-1 text-2xl">{t('monet.premiumTitle')}</h1>
          <p className="mt-1 text-sm text-white/60">{t('monet.premiumTagline')}</p>
        </div>

        {/* Two plan cards, side by side (Plus left, Pro right). */}
        <div className="mt-5 grid grid-cols-2 gap-3">
          {PLANS.map((p) => {
            const current = plan === p.id;
            return (
              <div
                key={p.id}
                className="relative flex flex-col rounded-3xl border-2 bg-white/[0.05] p-4 shadow-elevated"
                style={{ borderColor: current || p.featured ? p.accent : 'rgba(255,255,255,0.12)' }}
              >
                {p.featured && (
                  <span
                    className="absolute -top-2.5 left-1/2 -translate-x-1/2 rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white"
                    style={{ background: p.accent }}
                  >
                    {t('monet.popular')}
                  </span>
                )}
                <div className="text-center">
                  <div className="text-sm font-black" style={{ color: p.accent }}>
                    {t(`${p.i18n}.name`)}
                  </div>
                  <div className="mt-1 text-2xl font-black tabular-nums text-white">
                    {t(`${p.i18n}.price`)}
                  </div>
                  <div className="text-[11px] text-white/40">{t(`${p.i18n}.per`)}</div>
                </div>

                <ul className="mt-3 flex flex-1 flex-col gap-1.5">
                  {p.perks.map((perk) => (
                    <li key={perk} className="flex items-start gap-1.5 text-[12px] leading-snug text-white/75">
                      <span className="mt-0.5 shrink-0" style={{ color: p.accent }}>
                        ✔
                      </span>
                      <span>{t(`monet.perks.${perk}`)}</span>
                    </li>
                  ))}
                </ul>

                <button
                  disabled={current}
                  onClick={() => m.subscribe(p.id)}
                  className="mt-4 w-full rounded-xl px-3 py-2.5 text-sm font-bold text-white shadow disabled:opacity-60"
                  style={{ background: current ? '#94a3b8' : p.accent }}
                >
                  {current ? t('monet.currentPlan') : t('monet.choose', { plan: t(`${p.i18n}.name`) })}
                </button>
              </div>
            );
          })}
        </div>

        {paid ? (
          <div className="mt-4 text-center">
            <div className="rounded-2xl bg-success/15 px-4 py-3 text-sm font-bold text-success">
              🎉 {t('monet.thanks')}
            </div>
            <button onClick={() => m.cancel()} className="mt-3 text-xs text-white/45 underline">
              {t('monet.cancelDemo')}
            </button>
          </div>
        ) : (
          <p className="mt-3 text-center text-[11px] text-white/40">{t('monet.mockNote')}</p>
        )}

        {/* Comparison table */}
        <h2 className="font-dot mt-7 mb-2 text-xs font-semibold uppercase tracking-wide text-white/40">
          {t('monet.compare')}
        </h2>
        <div className="overflow-hidden rounded-2xl border border-white/10">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-white/[0.05] text-xs text-white/50">
                <th className="px-3 py-2 text-left font-semibold">{t('monet.feature')}</th>
                {PLANS.map((p) => (
                  <th key={p.id} className="px-2 py-2 text-center font-semibold" style={{ color: p.accent }}>
                    {t(`${p.i18n}.name`)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ALL_FEATURES.map((f) => (
                <tr key={f} className="border-t border-white/10">
                  <td className="px-3 py-2 text-left text-white/80">{t(`monet.perks.${f}`)}</td>
                  {PLANS.map((p) => (
                    <td key={p.id} className="px-2 py-2 text-center">
                      {planHas(p.id, f) ? (
                        <span style={{ color: p.accent }}>✔</span>
                      ) : (
                        <span className="text-white/25">–</span>
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <button
          onClick={() => m.openShop()}
          className="mt-6 w-full rounded-xl bg-white/[0.08] px-4 py-2.5 font-semibold text-white ring-1 ring-white/10 hover:bg-white/15"
        >
          🎨 {t('monet.shopTitle')}
        </button>

        <button onClick={() => nav('/')} className="mt-3 w-full text-xs text-white/45 underline">
          {t('nav.home')}
        </button>
      </div>
    </div>
  );
}
