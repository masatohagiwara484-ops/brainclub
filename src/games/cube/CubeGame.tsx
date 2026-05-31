import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { CubeEngine, type CubeStats } from './cubeEngine';
import { saveBest } from '../../lib/storage';
import { share } from '../../lib/share';

const SIZES = [2, 3, 4, 5];

function fmt(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export default function CubeGame() {
  const { t } = useTranslation();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<CubeEngine | null>(null);

  const [size, setSize] = useState(3);
  const [stats, setStats] = useState<CubeStats>({ moves: 0, seconds: 0, running: false });
  const [win, setWin] = useState<CubeStats | null>(null);
  const [shareMsg, setShareMsg] = useState<string | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current!;
    const engine = new CubeEngine(canvas, {
      onStats: setStats,
      onSolved: (s) => {
        saveBest('cube', `${engineRef.current?.size ?? 3}`, { seconds: s.seconds, moves: s.moves, at: Date.now() });
        setWin(s);
      },
    });
    engineRef.current = engine;

    const onResize = () => engine.resize();
    window.addEventListener('resize', onResize);
    // ensure correct size after layout settles
    requestAnimationFrame(onResize);

    return () => {
      window.removeEventListener('resize', onResize);
      engine.dispose();
      engineRef.current = null;
    };
  }, []);

  const changeSize = (n: number) => {
    setSize(n);
    setWin(null);
    engineRef.current?.setSize(n);
  };

  const onShare = async () => {
    if (!win) return;
    const res = await share({
      title: `BrainClub Cube ${size}×${size}`,
      seconds: win.seconds,
      moves: win.moves,
      url: window.location.origin,
    });
    setShareMsg(res === 'shared' ? t('share.shared') : res === 'copied' ? t('share.copied') : t('share.failed'));
    setTimeout(() => setShareMsg(null), 2500);
  };

  return (
    <div className="relative h-full w-full">
      <canvas ref={canvasRef} className="block h-full w-full touch-none" />

      {/* Top stats */}
      <div className="pointer-events-none absolute left-0 right-0 top-0 flex justify-center gap-3 p-3">
        <div className="rounded-xl bg-black/30 px-3 py-1.5 text-sm font-semibold tabular-nums text-white backdrop-blur">
          ⏱ {fmt(stats.seconds)}
        </div>
        <div className="rounded-xl bg-black/30 px-3 py-1.5 text-sm font-semibold tabular-nums text-white backdrop-blur">
          {stats.moves} {t('cube.moves')}
        </div>
      </div>

      {/* Size selector */}
      <div className="absolute left-1/2 top-14 flex -translate-x-1/2 gap-1 rounded-2xl bg-black/30 p-1 backdrop-blur">
        {SIZES.map((n) => (
          <button
            key={n}
            onClick={() => changeSize(n)}
            className={`rounded-xl px-3 py-1.5 text-sm font-semibold transition ${
              size === n ? 'bg-brand text-white' : 'text-white/70 hover:text-white'
            }`}
          >
            {n}×{n}
          </button>
        ))}
      </div>

      {/* Controls */}
      <div className="absolute bottom-4 left-1/2 flex -translate-x-1/2 flex-wrap justify-center gap-2">
        <Btn onClick={() => engineRef.current?.scramble()}>{t('cube.scramble')}</Btn>
        <Btn onClick={() => engineRef.current?.undo()}>{t('cube.undo')}</Btn>
        <Btn onClick={() => { setWin(null); engineRef.current?.reset(); }}>{t('cube.reset')}</Btn>
        <Btn onClick={() => engineRef.current?.resetView()}>{t('cube.view')}</Btn>
      </div>

      {/* Win modal */}
      {win && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/50 p-6 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-3xl bg-panel p-6 text-center text-white shadow-2xl">
            <div className="text-4xl">🎉</div>
            <h2 className="mt-2 text-xl font-bold">{t('cube.solved')}</h2>
            <p className="mt-1 text-white/70">
              ⏱ {fmt(win.seconds)} · {win.moves} {t('cube.moves')}
            </p>
            <div className="mt-5 flex justify-center gap-2">
              <button onClick={onShare} className="rounded-xl bg-brand px-4 py-2 font-semibold">
                {t('cube.share')}
              </button>
              <button
                onClick={() => { setWin(null); engineRef.current?.scramble(); }}
                className="rounded-xl bg-white/10 px-4 py-2 font-semibold"
              >
                {t('cube.again')}
              </button>
            </div>
            {shareMsg && <p className="mt-3 text-sm text-accent">{shareMsg}</p>}
          </div>
        </div>
      )}
    </div>
  );
}

function Btn({ children, onClick }: { children: ReactNode; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="rounded-xl bg-black/30 px-4 py-2 text-sm font-semibold text-white backdrop-blur transition hover:bg-black/45 active:scale-95"
    >
      {children}
    </button>
  );
}
