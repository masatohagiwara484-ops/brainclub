// Subscription page (F3) — UI mock, no billing.
//
// Two paid tiers (Plus / Pro) sit side by side at the top; Pro is featured. Each
// card lists its perks and a mock subscribe button. Below, a comparison table
// spells out what each tier unlocks. The active plan is highlighted and can be
// cancelled (demo) back to free. Plan state lives in useMonetization (getPlan /
// subscribe / cancel) so ads and cosmetic unlocks react instantly.

import { useTranslation } from 'react-i18next';
import { useNavigate, Link } from 'react-router-dom';
import { useMonetization, PLANS, ALL_FEATURES, planHas } from '../lib/monetization';
import { Icon } from '../components/Icons';
import { GAME_BG } from '../components/GameShell';

export default function Premium() {
  const { t } = useTranslation();
  const nav = useNavigate();
  const m = useMonetization();
  const plan = m.getPlan();
  const paid = plan !== 'free';

  return (
    <div className="h-full overflow-y-auto text-white" style={{ background: GAME_BG }}>
      <div className="mx-auto max-w-md px-5 py-6 pb-12">
        <div className="flex flex-col items-center text-center">
          <span className="holo-halo flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-iris-cyan via-iris-violet to-iris-magenta">
            <Icon name="diamond" className="h-8 w-8 text-white" />
          </span>
          <h1 className="font-display mt-3 text-2xl text-iris">{t('monet.premiumTitle')}</h1>
          <p className="mt-1 text-sm text-white/60">{t('monet.premiumTagline')}</p>
        </div>

        {/* Two plan cards, side by side (Plus left, Pro right). */}
        <div className="mt-6 grid grid-cols-2 gap-3">
          {PLANS.map((p) => {
            const current = plan === p.id;
            return (
              <div
                key={p.id}
                className={`glass-panel relative flex flex-col rounded-panel p-4 ${p.featured ? 'holo-border' : ''}`}
                style={p.featured ? undefined : current ? { boxShadow: `inset 0 0 0 1.5px ${p.accent}` } : undefined}
              >
                {p.featured && (
                  <span
                    className="absolute -top-2.5 left-1/2 -translate-x-1/2 rounded-full bg-gradient-to-r from-iris-cyan via-iris-violet to-iris-magenta px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white shadow-glow-sm"
                  >
                    {t('monet.popular')}
                  </span>
                )}
                <div className="text-center">
                  <div className="font-display text-sm" style={{ color: p.accent }}>
                    {t(`${p.i18n}.name`)}
                  </div>
                  <div className="mt-1 font-display text-2xl tabular-nums text-white">
                    {t(`${p.i18n}.price`)}
                  </div>
                  <div className="text-[11px] text-white/40">{t(`${p.i18n}.per`)}</div>
                </div>

                <ul className="mt-3 flex flex-1 flex-col gap-1.5">
                  {p.perks.map((perk) => (
                    <li key={perk} className="flex items-start gap-1.5 text-[12px] leading-snug text-white/75">
                      <Icon name="check" className="mt-0.5 h-3.5 w-3.5 shrink-0" style={{ color: p.accent }} />
                      <span>{t(`monet.perks.${perk}`)}</span>
                    </li>
                  ))}
                </ul>

                <button
                  disabled={current}
                  onClick={() => m.subscribe(p.id)}
                  className="btn-chunky mt-4 min-h-[44px] w-full px-3 py-2.5 text-sm disabled:opacity-60"
                  style={{ background: current ? '#475569' : p.accent }}
                >
                  {current ? t('monet.currentPlan') : t('monet.choose', { plan: t(`${p.i18n}.name`) })}
                </button>
              </div>
            );
          })}
        </div>

        {paid ? (
          <div className="mt-4 text-center">
            <div className="flex items-center justify-center gap-2 rounded-2xl bg-success/15 px-4 py-3 text-sm font-bold text-success">
              <Icon name="sparkles" className="h-4 w-4" /> {t('monet.thanks')}
            </div>
            <button onClick={() => m.cancel()} className="mt-3 min-h-[44px] text-xs text-white/45 underline">
              {t('monet.cancelDemo')}
            </button>
          </div>
        ) : (
          <p className="mt-3 text-center text-[11px] text-white/40">{t('monet.mockNote')}</p>
        )}

        {/* Brain Pass cross-sell */}
        <Link
          to="/pass"
          className="mt-5 flex items-center gap-3 overflow-hidden rounded-panel bg-gradient-to-r from-amber-500/25 via-iris-violet/25 to-iris-magenta/25 p-3.5 ring-1 ring-white/15 transition active:scale-[0.98]"
        >
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 shadow-glow-sm">
            <Icon name="ticket" className="h-7 w-7 text-white" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="font-display text-base text-white">{t('pass.title')}</div>
            <div className="truncate text-xs text-white/55">{t('pass.bannerSub')}</div>
          </div>
          <Icon name="chevronRight" className="h-5 w-5 shrink-0 text-white/50" />
        </Link>

        {/* Comparison table */}
        <h2 className="font-display mt-7 mb-2 text-xs uppercase tracking-[0.16em] text-white/40">
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
                        <Icon name="check" className="mx-auto h-4 w-4" style={{ color: p.accent }} />
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
          className="mt-6 flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl bg-white/[0.08] px-4 py-2.5 font-semibold text-white ring-1 ring-white/10 hover:bg-white/15"
        >
          <Icon name="sparkles" className="h-4 w-4" /> {t('monet.shopTitle')}
        </button>

        <button onClick={() => nav('/')} className="mt-3 min-h-[44px] w-full text-xs text-white/45 underline">
          {t('nav.home')}
        </button>
      </div>
    </div>
  );
}
