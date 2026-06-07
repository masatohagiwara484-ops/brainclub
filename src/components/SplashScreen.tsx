import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { BrandGlyph, BrandWordmark } from './BrandMark';

// ============================================================
// SplashScreen — the 2–3s opening animation (chess.com-style)
// ============================================================
// A full-bleed dark overlay shown on every cold app launch (mounted once by
// App, so it naturally fires once per page load). The synapse monogram draws
// itself on, its node junctions light up in sequence, the sparks fire in
// (information feeding the brain), then the BRAINCLUB wordmark resolves out of
// wide tracking — all pure CSS (keyframes scoped under `.bc-splash`), so it
// paints instantly with zero added bundle weight. Reduced-motion shows the
// final frame and dismisses quickly. `onDone` unmounts it.
export default function SplashScreen({ onDone }: { onDone: () => void }) {
  const { t } = useTranslation();

  useEffect(() => {
    const reduce =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const id = window.setTimeout(onDone, reduce ? 900 : 2500);
    return () => window.clearTimeout(id);
  }, [onDone]);

  return (
    <div className="bc-splash" role="status" aria-label={t('app.name')}>
      <div className="flex flex-col items-center">
        <BrandGlyph
          animated
          className="bc-splash-glyph h-28 w-28 drop-shadow-[0_0_28px_rgba(99,102,241,0.5)]"
        />
        <BrandWordmark className="bc-splash-word mt-6 text-2xl" />
        <p className="bc-splash-tag mt-3 text-[11px] uppercase tracking-[0.4em] text-white/40">
          {t('app.tagline')}
        </p>
      </div>
    </div>
  );
}
