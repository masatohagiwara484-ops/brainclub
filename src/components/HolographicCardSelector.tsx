import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { GAMES } from '../games/registry';
import { prefersReducedMotion } from '../lib/fx';
import { haptics } from '../lib/haptics';
import { sound } from '../lib/sound';
import { getSetting } from '../lib/storage';
import GameArt from './GameArt';

// ============================================================================
// HolographicCardSelector — the home hero as a Pokémon-TCG-style deck.
//
// Each GAME is a flat 2D illustration (GameArt); the CARD is a 3D holographic
// object (pure CSS, GPU-composited — NO WebGL, so it never janks/freezes on
// mobile). Selection rides native horizontal scroll-snap, so one swipe lands
// exactly one card and every game is reliably reachable + playable. A continuous
// rAF animates the centered card: its iridescent foil drifts on its own (so it
// reads as holographic at rest), follows the finger/mouse when touched, and
// tilts to device-tilt (gyro) — on mobile and desktop alike. The deck opens on
// the last game you played. Reduced-motion keeps the snap-rail, no tilt/shimmer.
// ============================================================================

const BG = 'radial-gradient(120% 90% at 50% 6%, #221c54 0%, #0b1020 58%, #060812 100%)';
// Only playable games appear — so every card you can reach, you can play.
const DECK = GAMES.filter((g) => g.available);
const STARS: Record<string, number> = { 'must-have': 3, recommended: 2, innovative: 1 };
const clamp = (x: number, lo: number, hi: number) => (x < lo ? lo : x > hi ? hi : x);

export default function HolographicCardSelector() {
  const { t } = useTranslation();
  const nav = useNavigate();
  const reduced = useMemo(() => prefersReducedMotion(), []);

  const scroller = useRef<HTMLDivElement>(null);
  const wraps = useRef<(HTMLDivElement | null)[]>([]);
  const inners = useRef<(HTMLDivElement | null)[]>([]);
  const rafLayout = useRef(0);
  const pointer = useRef<{ x: number; y: number } | null>(null); // finger / mouse on the active card
  const gyro = useRef<{ x: number; y: number } | null>(null);
  const selRef = useRef(0);
  const [selected, setSelected] = useState(0);

  // Position every card by its distance from center; the centered card's tilt is
  // owned by the continuous tick() below. Called on scroll + resize only.
  const layout = () => {
    const sc = scroller.current;
    if (!sc) return;
    const cr = sc.getBoundingClientRect();
    const center = cr.left + cr.width / 2;
    const rects = wraps.current.map((w) => w?.getBoundingClientRect());
    let best = 0;
    let bestD = Infinity;
    for (let i = 0; i < DECK.length; i++) {
      const r = rects[i];
      if (!r) continue;
      const d = (r.left + r.width / 2 - center) / r.width;
      const ad = Math.abs(d);
      if (ad < bestD) { bestD = ad; best = i; }
    }
    for (let i = 0; i < DECK.length; i++) {
      const inner = inners.current[i];
      const r = rects[i];
      if (!inner || !r) continue;
      const d = (r.left + r.width / 2 - center) / r.width;
      const ad = Math.abs(d);
      inner.style.opacity = (1 - Math.min(ad, 1.7) * 0.34).toFixed(3);
      inner.style.zIndex = String(100 - Math.round(ad * 10));
      if (i === best) continue; // centered card is animated by tick()
      const scale = 1 - Math.min(ad, 1.6) * 0.12;
      const ry = clamp(-d * 18, -26, 26);
      inner.style.transform = `rotateY(${ry.toFixed(2)}deg) scale(${scale.toFixed(3)})`;
      inner.style.setProperty('--holo', '0.12');
      inner.style.setProperty('--px', '50%');
      inner.style.setProperty('--py', '38%');
    }
    if (best !== selRef.current) {
      selRef.current = best;
      setSelected(best);
      haptics.tick();
    }
  };
  const layoutRef = useRef(layout);
  layoutRef.current = layout;
  const scheduleLayout = () => {
    if (rafLayout.current) return;
    rafLayout.current = requestAnimationFrame(() => {
      rafLayout.current = 0;
      layoutRef.current();
    });
  };

  // Mount: open on the last-played game, lay out, and start the shimmer loop.
  useEffect(() => {
    const last = getSetting<string>('lastGame', '');
    const idx = Math.max(0, DECK.findIndex((g) => g.id === last));
    const sc = scroller.current;
    const w = wraps.current[idx];
    if (idx > 0 && sc && w) {
      sc.scrollLeft = w.offsetLeft - (sc.clientWidth - w.clientWidth) / 2;
      selRef.current = idx;
      setSelected(idx);
    }
    layoutRef.current();

    if (reduced) return;
    let raf = 0;
    const tick = () => {
      const inner = inners.current[selRef.current];
      if (inner) {
        const tt = performance.now() / 1000;
        let px: number;
        let py: number;
        if (pointer.current) { px = pointer.current.x; py = pointer.current.y; }
        else if (gyro.current) { px = gyro.current.x; py = gyro.current.y; }
        else { px = 0.5 + Math.sin(tt * 0.7) * 0.3; py = 0.42 + Math.cos(tt * 0.55) * 0.2; }
        const ry = (px - 0.5) * 30;
        const rx = -(py - 0.5) * 24;
        inner.style.transform = `rotateX(${rx.toFixed(2)}deg) rotateY(${ry.toFixed(2)}deg) scale(1)`;
        inner.style.setProperty('--holo', '1');
        inner.style.setProperty('--px', `${(px * 100).toFixed(1)}%`);
        inner.style.setProperty('--py', `${(py * 100).toFixed(1)}%`);
        inner.style.opacity = '1';
        inner.style.zIndex = '120';
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    const onResize = () => scheduleLayout();
    window.addEventListener('resize', onResize);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', onResize);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Device-tilt parallax (mobile). iOS needs a permission gesture (on first tap).
  useEffect(() => {
    if (reduced) return;
    const onTilt = (e: DeviceOrientationEvent) => {
      if (e.gamma == null || e.beta == null) return;
      gyro.current = { x: clamp(e.gamma / 30 + 0.5, 0, 1), y: clamp((e.beta - 40) / 30 + 0.5, 0, 1) };
    };
    window.addEventListener('deviceorientation', onTilt);
    return () => window.removeEventListener('deviceorientation', onTilt);
  }, [reduced]);

  const setPointer = (e: React.PointerEvent) => {
    if (reduced) return;
    const w = wraps.current[selRef.current];
    if (!w) return;
    const r = w.getBoundingClientRect();
    pointer.current = {
      x: clamp((e.clientX - r.left) / r.width, 0, 1),
      y: clamp((e.clientY - r.top) / r.height, 0, 1),
    };
  };
  const clearPointer = () => { pointer.current = null; };
  const requestGyro = () => {
    const DOE = window.DeviceOrientationEvent as unknown as { requestPermission?: () => Promise<string> };
    if (typeof DOE?.requestPermission === 'function') void DOE.requestPermission().catch(() => {});
  };

  const centerCard = (i: number) =>
    wraps.current[i]?.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' });
  const onCardClick = (i: number) => (i === selRef.current ? play() : centerCard(i));
  const play = () => {
    const g = DECK[selRef.current];
    if (!g) return;
    sound.playSelectGame();
    nav(g.route);
  };

  const game = DECK[selected];

  return (
    <div className="relative flex h-full w-full flex-col overflow-hidden" style={{ background: BG }}>
      <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex justify-center pt-3">
        <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-white/70 backdrop-blur-sm">
          {t('selector.hint', { defaultValue: 'Swipe to explore · tap to play' })}
        </span>
      </div>

      <div
        ref={scroller}
        onScroll={scheduleLayout}
        onPointerDown={(e) => { requestGyro(); setPointer(e); }}
        onPointerMove={setPointer}
        onPointerUp={clearPointer}
        onPointerLeave={clearPointer}
        onPointerCancel={clearPointer}
        className="flex min-h-0 flex-1 items-center gap-4 overflow-x-auto overflow-y-hidden [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        style={{
          scrollSnapType: 'x mandatory',
          paddingInline: 'calc(50% - var(--cardW) / 2)',
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          ['--cardW' as any]: 'min(64vw, 240px)',
        }}
      >
        {DECK.map((g, i) => (
          <div
            key={g.id}
            ref={(el) => { wraps.current[i] = el; }}
            onClick={() => onCardClick(i)}
            className="shrink-0 cursor-pointer"
            // Perspective MUST sit on the card's direct parent for rotateX/Y to
            // read as a real 3D tilt (not a flat skew) — this is what makes the
            // card actually lean on touch/gyro/idle, on mobile included.
            style={{ width: 'var(--cardW)', scrollSnapAlign: 'center', perspective: '760px' }}
          >
            <div ref={(el) => { inners.current[i] = el; }} className="holo-card">
              <div className={`absolute inset-0 bg-gradient-to-br ${g.gradient}`}>
                <div className="absolute inset-0 bg-neural opacity-20" />
                <div className="absolute left-3 top-3 flex gap-0.5 text-amber-200/90 drop-shadow">
                  {Array.from({ length: STARS[g.category] ?? 1 }).map((_, s) => (
                    <span key={s} className="text-xs leading-none">★</span>
                  ))}
                </div>
                <div className="flex h-[64%] items-center justify-center px-6 pt-6 text-white drop-shadow-[0_4px_10px_rgba(0,0,0,0.45)]">
                  <GameArt id={g.id} className="h-24 w-24" />
                </div>
                <div className="absolute inset-x-3 bottom-3 rounded-2xl border border-white/15 bg-black/25 px-3 py-2 text-center backdrop-blur-sm">
                  <div className="font-display text-lg leading-tight text-white">{t(g.nameKey)}</div>
                  <div className="text-[11px] leading-tight text-white/75">{t(g.taglineKey)}</div>
                </div>
              </div>
              <div className="holo-layer holo-foil" />
              <div className="holo-layer holo-sparkle" />
              <div className="holo-layer holo-glare" />
              <div className="holo-layer holo-frame" />
            </div>
          </div>
        ))}
      </div>

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
        {game && <p className="mt-2 text-center text-xs text-white/50">{t(game.taglineKey)}</p>}
      </div>
    </div>
  );
}
