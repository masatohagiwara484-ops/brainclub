// Premium subscription landing page (Mission 8) — UI mock, no billing.
//
// The fuller marketing surface for BrainClub Premium (the Paywall overlay is the
// in-the-moment nudge; this is the page you land on from a "Premium" link).
// Shows the pitch, the perk list, a mock price card and a "subscribe" button
// that flips the local flag. When already subscribed it shows a thank-you state
// with a (demo-only) cancel so ads can be toggled back on.

import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useMonetization, PREMIUM_PERK_KEYS } from '../lib/monetization';

export default function Premium() {
  const { t } = useTranslation();
  const nav = useNavigate();
  const m = useMonetization();
  const premium = m.isPremium();

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-md px-5 py-6">
        <div className="rounded-3xl bg-gradient-to-br from-amber-400 to-pink-500 px-6 py-8 text-center text-white shadow-lg">
          <div className="text-5xl">✨</div>
          <h1 className="font-cyber mt-2 text-3xl">{t('monet.premiumTitle')}</h1>
          <p className="mt-1 text-sm text-white/90">{t('monet.premiumTagline')}</p>
        </div>

        <ul className="mt-6 flex flex-col gap-3">
          {PREMIUM_PERK_KEYS.map((k) => (
            <li key={k} className="flex items-start gap-3 rounded-2xl bg-slate-50 px-4 py-3">
              <span className="mt-0.5 text-lg text-accent">✔</span>
              <span className="text-sm text-slate-700">{t(`monet.perks.${k}`)}</span>
            </li>
          ))}
        </ul>

        {premium ? (
          <div className="mt-6 text-center">
            <div className="rounded-2xl bg-accent/10 px-4 py-4 text-accent">
              <div className="text-2xl">🎉</div>
              <p className="mt-1 font-bold">{t('monet.thanks')}</p>
            </div>
            <button
              onClick={() => m.cancel()}
              className="mt-4 text-xs text-slate-400 underline"
            >
              {t('monet.cancelDemo')}
            </button>
          </div>
        ) : (
          <div className="mt-6">
            <div className="rounded-2xl border-2 border-brand bg-blue-50 px-5 py-4 text-center">
              <div className="text-3xl font-bold tabular-nums text-slate-900">{t('monet.price')}</div>
              <div className="text-xs text-slate-500">{t('monet.pricePer')}</div>
            </div>
            <button
              onClick={() => m.subscribe()}
              className="mt-4 w-full rounded-2xl bg-gradient-to-r from-amber-400 to-pink-500 px-4 py-3.5 font-bold text-white shadow"
            >
              {t('monet.subscribeCta')}
            </button>
            <p className="mt-2 text-center text-[11px] text-slate-400">{t('monet.mockNote')}</p>
          </div>
        )}

        <button
          onClick={() => m.openShop()}
          className="mt-6 w-full rounded-xl bg-slate-100 px-4 py-2.5 font-semibold text-slate-700"
        >
          🎨 {t('monet.shopTitle')}
        </button>

        <button onClick={() => nav('/')} className="mt-3 w-full text-xs text-slate-400 underline">
          {t('nav.home')}
        </button>
      </div>
    </div>
  );
}
