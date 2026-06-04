// Cosmetic shop (Mission 8) — UI mock, no real purchases.
//
// Lists every skin as a tappable card with a live gradient swatch. Owned skins
// can be applied instantly (they recolor the whole app via the [data-skin]
// token on the Layout root — zero game-code changes). Unowned skins show a mock
// price and "buy" unlocks them on the spot. Premium-only skins route to the
// Paywall instead of charging. Closing is via backdrop, ✕, or Done.

import { useTranslation } from 'react-i18next';
import { useMonetization, SKINS, type SkinDef } from '../lib/monetization';

function SkinCard({ skin }: { skin: SkinDef }) {
  const { t } = useTranslation();
  const m = useMonetization();
  const owned = m.isOwned(skin.id);
  const active = m.getSkin() === skin.id;
  const premiumLocked = !!skin.premium && !m.isPremium() && !owned;

  const onTap = () => {
    if (active) return;
    if (owned) m.setSkin(skin.id);
    else if (premiumLocked) m.openPaywall();
    else m.buy(skin.id);
  };

  return (
    <button
      onClick={onTap}
      aria-pressed={active}
      className={`relative flex flex-col overflow-hidden rounded-2xl border-2 text-left transition ${
        active ? 'border-brand ring-2 ring-brand/30' : 'border-slate-200 hover:border-slate-300'
      }`}
    >
      <div className="h-16 w-full" style={{ background: `linear-gradient(135deg, ${skin.c1}, ${skin.c2})` }} />
      <div className="flex items-center justify-between gap-2 px-3 py-2">
        <span className="text-sm font-semibold text-slate-700">{t(`monet.skins.${skin.id}`)}</span>
        {active ? (
          <span className="text-xs font-bold text-brand">{t('monet.applied')}</span>
        ) : owned ? (
          <span className="text-xs font-semibold text-slate-400">{t('monet.apply')}</span>
        ) : premiumLocked ? (
          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-700">
            {t('monet.premiumTag')}
          </span>
        ) : (
          <span className="rounded-full bg-brand px-2 py-0.5 text-xs font-bold text-white">{skin.price}</span>
        )}
      </div>
    </button>
  );
}

export default function ShopModal() {
  const { t } = useTranslation();
  const m = useMonetization();
  if (!m.isShopOpen()) return null;

  return (
    <div
      className="absolute inset-0 z-40 flex items-center justify-center bg-slate-900/40 p-5 backdrop-blur-sm"
      onClick={() => m.closeShop()}
    >
      <div
        className="max-h-[88vh] w-full max-w-md overflow-y-auto rounded-3xl bg-white p-6 text-slate-900 shadow-2xl ring-1 ring-black/5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between">
          <div>
            <h2 className="font-cyber text-2xl">🎨 {t('monet.shopTitle')}</h2>
            <p className="mt-1 text-sm text-slate-500">{t('monet.shopNote')}</p>
          </div>
          <button
            onClick={() => m.closeShop()}
            aria-label={t('monet.close')}
            className="rounded-lg px-2 py-1 text-xl text-slate-400 hover:text-slate-700"
          >
            ✕
          </button>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3">
          {SKINS.map((s) => (
            <SkinCard key={s.id} skin={s} />
          ))}
        </div>

        {!m.isPremium() && (
          <button
            onClick={() => m.openPaywall()}
            className="mt-5 w-full rounded-2xl bg-gradient-to-r from-amber-400 to-pink-500 px-4 py-3 text-sm font-bold text-white shadow"
          >
            ✨ {t('monet.unlockAll')}
          </button>
        )}

        <button
          onClick={() => m.closeShop()}
          className="mt-3 w-full rounded-xl bg-slate-100 px-4 py-2 font-semibold text-slate-700"
        >
          {t('monet.done')}
        </button>
      </div>
    </div>
  );
}
