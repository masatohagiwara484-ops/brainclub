// Ad placeholder (Mission 8) — free-tier only, no real ad network wired in.
//
// Renders nothing for Premium subscribers (that's the value prop). For free
// users it shows a labeled, clearly-fake placeholder box plus a quiet
// "remove ads" nudge that opens the Paywall. The label is intentionally honest
// ("Ad placeholder") so the mock is never mistaken for a live ad unit.

import { useTranslation } from 'react-i18next';
import { useMonetization } from '../lib/monetization';

export default function AdSlot({ className = '' }: { className?: string }) {
  const { t } = useTranslation();
  const m = useMonetization();
  if (!m.showAds()) return null;

  return (
    <div
      className={`flex items-center justify-between gap-3 rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-3 ${className}`}
    >
      <div className="flex items-center gap-2 text-slate-400">
        <span className="rounded bg-slate-200 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-slate-500">
          {t('monet.adLabel')}
        </span>
        <span className="text-xs">{t('monet.adPlaceholder')}</span>
      </div>
      <button
        onClick={() => m.openPaywall()}
        className="shrink-0 text-xs font-semibold text-brand hover:underline"
      >
        {t('monet.removeAds')}
      </button>
    </div>
  );
}
