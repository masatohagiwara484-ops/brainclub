// Paywall / subscription prompt (F3) — UI mock, no billing.
//
// The in-the-moment nudge (opened via monet.openPaywall() from AdSlots, the
// Shop, etc.). It pitches the two tiers compactly with quick subscribe buttons
// and a link to the full comparison at /premium. Plan state flows through
// useMonetization, so subscribing here removes ads / unlocks cosmetics at once.

import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useMonetization, PLANS } from '../lib/monetization';

export default function PaywallOverlay() {
  const { t } = useTranslation();
  const nav = useNavigate();
  const m = useMonetization();
  if (!m.isPaywallOpen()) return null;

  const seeAllPlans = () => {
    m.closePaywall();
    nav('/premium');
  };

  return (
    <div
      className="absolute inset-0 z-40 flex items-center justify-center bg-slate-900/50 p-5 backdrop-blur-sm"
      onClick={() => m.closePaywall()}
    >
      <div
        className="w-full max-w-sm overflow-hidden rounded-3xl bg-white text-slate-900 shadow-2xl ring-1 ring-black/5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="bg-gradient-to-br from-amber-400 to-pink-500 px-6 py-7 text-center text-white">
          <div className="text-4xl">✨</div>
          <h2 className="font-cyber mt-2 text-2xl">{t('monet.premiumTitle')}</h2>
          <p className="mt-1 text-sm text-white/90">{t('monet.premiumTagline')}</p>
        </div>

        <div className="px-6 py-5">
          <div className="flex flex-col gap-2.5">
            {PLANS.map((p) => (
              <button
                key={p.id}
                onClick={() => m.subscribe(p.id)}
                className="flex items-center justify-between rounded-2xl border-2 px-4 py-3 text-left transition hover:bg-slate-50"
                style={{ borderColor: p.accent }}
              >
                <span className="flex items-center gap-2">
                  <span className="text-sm font-black" style={{ color: p.accent }}>
                    {t(`${p.i18n}.name`)}
                  </span>
                  {p.featured && (
                    <span
                      className="rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-white"
                      style={{ background: p.accent }}
                    >
                      {t('monet.popular')}
                    </span>
                  )}
                </span>
                <span className="text-right">
                  <span className="block text-sm font-black tabular-nums text-slate-900">
                    {t(`${p.i18n}.price`)}
                  </span>
                  <span className="block text-[10px] text-slate-400">{t(`${p.i18n}.per`)}</span>
                </span>
              </button>
            ))}
          </div>

          <button onClick={seeAllPlans} className="mt-4 w-full text-xs font-semibold text-brand hover:underline">
            {t('monet.compare')} ›
          </button>
          <p className="mt-2 text-center text-[11px] text-slate-400">{t('monet.mockNote')}</p>

          <button onClick={() => m.closePaywall()} className="mt-3 w-full text-xs text-slate-400 underline">
            {t('monet.maybeLater')}
          </button>
        </div>
      </div>
    </div>
  );
}
