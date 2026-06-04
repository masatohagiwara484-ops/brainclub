// Paywall / subscription prompt (Mission 8) — UI mock, no billing.
//
// A focused overlay that pitches BrainClub Premium and lets the user "subscribe"
// (which just flips a local flag, removing ads and unlocking every cosmetic).
// Opened imperatively via monet.openPaywall() from AdSlots, the Shop, etc.
// The fuller marketing page lives at /premium; this is the in-the-moment nudge.

import { useTranslation } from 'react-i18next';
import { useMonetization, PREMIUM_PERK_KEYS } from '../lib/monetization';

export default function PaywallOverlay() {
  const { t } = useTranslation();
  const m = useMonetization();
  if (!m.isPaywallOpen()) return null;

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
          <ul className="flex flex-col gap-2.5">
            {PREMIUM_PERK_KEYS.map((k) => (
              <li key={k} className="flex items-start gap-2 text-sm text-slate-700">
                <span className="mt-0.5 text-accent">✔</span>
                <span>{t(`monet.perks.${k}`)}</span>
              </li>
            ))}
          </ul>

          <button
            onClick={() => m.subscribe()}
            className="mt-5 w-full rounded-2xl bg-gradient-to-r from-amber-400 to-pink-500 px-4 py-3 font-bold text-white shadow"
          >
            {t('monet.subscribeCta')}
          </button>
          <p className="mt-2 text-center text-[11px] text-slate-400">{t('monet.mockNote')}</p>

          <button
            onClick={() => m.closePaywall()}
            className="mt-3 w-full text-xs text-slate-400 underline"
          >
            {t('monet.maybeLater')}
          </button>
        </div>
      </div>
    </div>
  );
}
