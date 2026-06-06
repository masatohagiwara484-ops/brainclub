import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { GAMES } from '../games/registry';
import { prefersReducedMotion } from '../lib/fx';
import { haptics } from '../lib/haptics';
import { sound } from '../lib/sound';
import GameArt from './GameArt';

// ============================================================================
// HolographicCardSelector — the home hero as a Pokémon-TCG-style deck.
//
// Each GAME is a flat 2D illustration (GameArt); the CARD is a 3D holographic
// object (pure CSS, GPU-composited — NO WebGL, so it never janks or freezes on
// mobile). Selection rides on native horizontal scroll-snap, so one swipe always
// lands exactly one card and every game is reliably reachable + playable. The
// centered card lights up with an iridescent foil + glare + sparkle and tilts
// toward the pointer (desktop) or device tilt (gyro, mobile). Reduced-motion
// keeps the snap-rail but drops the tilt/shimmer.
// ============================================================================

const BG = 'radial-gradient(120% 90% at 50% 6%, #221c54 0%, #0b1020 58%, #060812 100%)';
// Only playable games appear in the deck — so every card you can reach, you can play.
const DECK = GAMES.filter((g) => g.available);

const STARS: Record<string, number> = { 'must-have': 3, recommended: 2, innovative: 1 };
const clamp = (x: number, lo: number, hi: number) => (x < lo ? lo : x > hi ? hi : x);

export default function HolographicCardSelector() {
  const { t } = useTranslation();
  const nav = useNavigate();
  const reduced = useMemo(() => prefersReducedMotion(), []);
  const canHover = useMemo(
    () => typeof window !== 'undefined' && window.matchMedia?.('(hover: hover)').matches,
    [],
  );

  const scroller = useRef<HTMLDivElement>(null);
  const wraps = useRef<(HTMLDivElement | null)[]>([]);
  const inners = useRef<(HTMLDivElement | null)[]>([]);
  const rafId = useRef(0);
  const pointer = useRef<{ i: number; x: number; y: number } | null>(null);
  const selRef = useRef(0);
  const [selected, setSelected] = useState(0);

  // The single layout pass: place every card by its distance from center and
  // light up the centered one. Reads refs only, so it never goes stale.
  const layout = () => {
    const sc = scroller.current;
    if (!sc) return;
    const cr = sc.getBoundingClientRect();
    const center = cr.left + cr.width / 2;
    let best = 0;
    let bestD = Infinity;
    for (let i = 0; i < DECK.length; i++) {
      const wrap = wraps.current[i];
      const inner = inners.current[i];
      if (!wrap || !inner) continue;
      const r = wrap.getBoundingClientRect();
      const d = (r.left + r.width / 2 - center) / r.width;
      const ad = Math.abs(d);
      if (ad < bestD) {
        bestD = ad;
        best = i;
      }
      const active = ad < 0.5;
      const scale = 1 - Math.min(ad, 1.6) * 0.12;
      let ry = clamp(-d * 18, -26, 26);
      let rx = 0;
      let px = '50%';
      let py = '38%';
      if (active && !reduced && pointer.current && pointer.current.i === i) {
        ry = (pointer.current.x - 0.5) * 30;
        rx = -(pointer.current.y - 0.5) * 26;
        px = `${pointer.current.x * 100}%`;
        py = `${pointer.current.y * 100}%`;
      }
      inner.style.transform = `rotateX(${rx.toFixed(2)}deg) rotateY(${ry.toFixed(2)}deg) scale(${scale.toFixed(3)})`;
      inner.style.opacity = (1 - Math.min(ad, 1.7) * 0.34).toFixed(3);
      inner.style.zIndex = String(100 - Math.round(ad * 10));
      inner.style.setProperty('--holo', active && !reduced ? '1' : '0.12');
      inner.style.setProperty('--px', px);
      inner.style.setProperty('--py', py);
    }
    if (best !== selRef.current) {
      selRef.current = best;
      setSelected(best);
      haptics.tick();
    }
  };

  const layoutRef = useRef(layout);
  layoutRef.current = layout;
  const schedule = () => {
    if (rafId.current) return;
    rafId.current = requestAnimationFrame(() => {
      rafId.current = 0;
      layoutRef.current();
    });
  };

  useEffect(() => {
    layoutRef.current();
    const onResize = () => schedule();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // Device-tilt parallax (mobile). iOS needs a permission gesture (requested on tap).
  useEffect(() => {
    if (reduced) return;
    const onTilt = (e: DeviceOrientationEvent) => {
      if (e.gamma == null || e.beta == null) return;
      pointer.current = {
        i: selRef.current,
        x: clamp(e.gamma / 30 + 0.5, 0, 1),
        y: clamp((e.beta - 40) / 30 + 0.5, 0, 1),
      };
      schedule();
    };
    window.addEventListener('deviceorientation', onTilt);
    return () => window.removeEventListener('deviceorientation', onTilt);
  }, [reduced]);

  const centerCard = (i: number) =>
    wraps.current[i]?.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' });

  const onCardClick = (i: number) => {
    if (i === selRef.current) play();
    else centerCard(i);
  };

  const play = () => {
    const g = DECK[selRef.current];
    if (!g) return;
    sound.playSelectGame();
    nav(g.route);
  };

  // Desktop pointer tilt on the centered card.
  const onPointerMove = (e: React.PointerEvent) => {
    if (!canHover || reduced) return;
    const wrap = wraps.current[selRef.current];
    if (!wrap) return;
    const r = wrap.getBoundingClientRect();
    pointer.current = {
      i: selRef.current,
      x: clamp((e.clientX - r.left) / r.width, 0, 1),
      y: clamp((e.clientY - r.top) / r.height, 0, 1),
    };
    schedule();
  };
  const onPointerLeave = () => {
    if (!canHover) return;
    pointer.current = null;
    schedule();
  };
  const requestGyro = () => {
    const DOE = window.DeviceOrientationEvent as unknown as { requestPermission?: () => Promise<string> };
    if (typeof DOE?.requestPermission === 'function') void DOE.requestPermission().catch(() => {});
  };

  const game = DECK[selected];

  return (
    <div className="relative flex h-full w-full flex-col overflow-hidden" style={{ background: BG }}>
      {/* Hint */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex justify-center pt-3">
        <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-white/70 backdrop-blur-sm">
          {t('selector.hint', { defaultValue: 'Swipe to explore · tap to play' })}
        </span>
      </div>

      {/* The holographic deck — native scroll-snap carousel. */}
      <div
        ref={scroller}
        onScroll={schedule}
        onPointerDown={requestGyro}
        onPointerMove={onPointerMove}
        onPointerLeave={onPointerLeave}
        className="flex min-h-0 flex-1 items-center gap-4 overflow-x-auto overflow-y-hidden [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        style={{
          scrollSnapType: 'x mandatory',
          paddingInline: 'calc(50% - var(--cardW) / 2)',
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          ['--cardW' as any]: 'min(64vw, 240px)',
          perspective: '1100px',
        }}
      >
        {DECK.map((g, i) => (
          <div
            key={g.id}
            ref={(el) => { wraps.current[i] = el; }}
            onClick={() => onCardClick(i)}
            className="shrink-0 cursor-pointer"
            style={{ width: 'var(--cardW)', scrollSnapAlign: 'center' }}
          >
            <div ref={(el) => { inners.current[i] = el; }} className="holo-card">
              {/* 2D game illustration on a bespoke gradient */}
              <div className={`absolute inset-0 bg-gradient-to-br ${g.gradient}`}>
                <div className="absolute inset-0 bg-neural opacity-20" />
                {/* rarity stars */}
                <div className="absolute left-3 top-3 flex gap-0.5 text-amber-200/90 drop-shadow">
                  {Array.from({ length: STARS[g.category] ?? 1 }).map((_, s) => (
                    <span key={s} className="text-xs leading-none">★</span>
                  ))}
                </div>
                {/* central art */}
                <div className="flex h-[64%] items-center justify-center px-6 pt-6 text-white drop-shadow-[0_4px_10px_rgba(0,0,0,0.45)]">
                  <GameArt id={g.id} className="h-24 w-24" />
                </div>
                {/* name plate */}
                <div className="absolute inset-x-3 bottom-3 rounded-2xl border border-white/15 bg-black/25 px-3 py-2 text-center backdrop-blur-sm">
                  <div className="font-display text-lg leading-tight text-white">{t(g.nameKey)}</div>
                  <div className="text-[11px] leading-tight text-white/75">{t(g.taglineKey)}</div>
                </div>
              </div>
              {/* holographic layers */}
              <div className="holo-layer holo-foil" />
              <div className="holo-layer holo-sparkle" />
              <div className="holo-layer holo-glare" />
              <div className="holo-layer holo-frame" />
            </div>
          </div>
        ))}
      </div>

      {/* Bottom overlay: progress dots + big PLAY. */}
      <div className="relative z-10 shrink-0 px-6 pb-6 pt-2">
        <div className="mb-3 flex items-center justify-center gap-1">
          {DECK.map((g, i) => (
            <span
              key={g.id}
              className={`h-1.5 rounded-full transition-all duration-300 ${i === selected ? 'w-5 bg-white' : 'w-1.5 bg-white/30'}`}
            />
          ))}
        </div>
        <button
          onClick={play}
          className="mx-auto flex h-16 w-full max-w-xs items-center justify-center gap-2 rounded-3xl bg-gradient-to-r from-primary to-accent-cyan font-display text-xl uppercase tracking-[0.2em] text-white shadow-premium transition-premium active:scale-95"
        >
          <span aria-hidden className="text-lg leading-none">▶</span>
          {t('selector.play', { defaultValue: 'Play' })}
        </button>
        {game && (
          <p className="mt-2 text-center text-xs text-white/50">{t(game.taglineKey)}</p>
        )}
      </div>
    </div>
  );
}
