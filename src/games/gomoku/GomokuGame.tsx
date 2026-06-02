import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import {
  SIZE,
  EMPTY,
  BLACK,
  WHITE,
  type Cell,
  idx,
  createBoard,
  isWin,
  isBoardFull,
  chooseMove,
} from './gomokuAI';
import { haptics } from '../../lib/haptics';
import { difficultyKey, DIFFICULTY_STYLE } from '../../lib/difficulty';
import type { GameProps } from '../types';

type Status = 'playing' | 'black' | 'white' | 'draw';

// Star points (hoshi) for a 15×15 board.
const STARS: ReadonlyArray<[number, number]> = [
  [3, 3],
  [3, 11],
  [11, 3],
  [11, 11],
  [7, 7],
];

type Geom = { pad: number; step: number; ox: number; oy: number };

function geom(w: number, h: number): Geom {
  const board = Math.min(w, h);
  const pad = board * 0.05 + 6;
  const step = (board - 2 * pad) / (SIZE - 1);
  const ox = (w - board) / 2 + pad;
  const oy = (h - board) / 2 + pad;
  return { pad, step, ox, oy };
}

export default function GomokuGame({ difficulty = 'medium' }: GameProps) {
  const { t } = useTranslation();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  const [board, setBoard] = useState<Cell[]>(() => createBoard());
  const [turn, setTurn] = useState<Cell>(BLACK);
  const [status, setStatus] = useState<Status>('playing');
  const [last, setLast] = useState<number | null>(null);
  const [history, setHistory] = useState<number[]>([]);
  const [shareMsg, setShareMsg] = useState<string | null>(null);

  // ---- drawing ----
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = wrap.clientWidth;
    const h = wrap.clientHeight;
    if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
    }
    const ctx = canvas.getContext('2d')!;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    const { step, ox, oy } = geom(w, h);
    const boardPx = step * (SIZE - 1);

    // Wooden board.
    ctx.fillStyle = '#d9a55b';
    const margin = step * 0.7;
    roundRect(ctx, ox - margin, oy - margin, boardPx + margin * 2, boardPx + margin * 2, 10);
    ctx.fill();

    // Grid lines.
    ctx.strokeStyle = 'rgba(60,40,15,0.85)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = 0; i < SIZE; i++) {
      const p = i * step;
      ctx.moveTo(ox, oy + p);
      ctx.lineTo(ox + boardPx, oy + p);
      ctx.moveTo(ox + p, oy);
      ctx.lineTo(ox + p, oy + boardPx);
    }
    ctx.stroke();

    // Star points.
    ctx.fillStyle = 'rgba(60,40,15,0.9)';
    for (const [sx, sy] of STARS) {
      ctx.beginPath();
      ctx.arc(ox + sx * step, oy + sy * step, Math.max(2, step * 0.08), 0, Math.PI * 2);
      ctx.fill();
    }

    // Stones.
    const r = step * 0.42;
    for (let y = 0; y < SIZE; y++) {
      for (let x = 0; x < SIZE; x++) {
        const c = board[idx(x, y)];
        if (c === EMPTY) continue;
        const cx = ox + x * step;
        const cy = oy + y * step;
        const grad = ctx.createRadialGradient(
          cx - r * 0.3,
          cy - r * 0.3,
          r * 0.1,
          cx,
          cy,
          r,
        );
        if (c === BLACK) {
          grad.addColorStop(0, '#555');
          grad.addColorStop(1, '#0a0a0a');
        } else {
          grad.addColorStop(0, '#fff');
          grad.addColorStop(1, '#c9ccd2');
        }
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Last-move marker.
    if (last != null) {
      const lx = last % SIZE;
      const ly = Math.floor(last / SIZE);
      ctx.strokeStyle = '#5b8cff';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(ox + lx * step, oy + ly * step, r * 0.55, 0, Math.PI * 2);
      ctx.stroke();
    }
  }, [board, last]);

  useEffect(() => {
    draw();
  }, [draw]);

  useEffect(() => {
    const ro = new ResizeObserver(() => draw());
    if (wrapRef.current) ro.observe(wrapRef.current);
    return () => ro.disconnect();
  }, [draw]);

  // ---- moves ----
  const place = useCallback(
    (x: number, y: number, color: Cell) => {
      setBoard((prev) => {
        if (prev[idx(x, y)] !== EMPTY) return prev;
        const next = prev.slice() as Cell[];
        next[idx(x, y)] = color;
        const cellIndex = idx(x, y);
        setLast(cellIndex);
        setHistory((h) => [...h, cellIndex]);
        haptics.tick();

        if (isWin(next, x, y, color)) {
          setStatus(color === BLACK ? 'black' : 'white');
          haptics.success();
        } else if (isBoardFull(next)) {
          setStatus('draw');
        } else {
          setTurn(color === BLACK ? WHITE : BLACK);
        }
        return next;
      });
    },
    [],
  );

  const onClick = (ev: React.MouseEvent<HTMLCanvasElement>) => {
    if (status !== 'playing' || turn !== BLACK) return;
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const { step, ox, oy } = geom(rect.width, rect.height);
    const x = Math.round((ev.clientX - rect.left - ox) / step);
    const y = Math.round((ev.clientY - rect.top - oy) / step);
    if (x < 0 || x >= SIZE || y < 0 || y >= SIZE) return;
    if (board[idx(x, y)] !== EMPTY) return;
    place(x, y, BLACK);
  };

  // AI responds whenever it is its turn.
  useEffect(() => {
    if (status !== 'playing' || turn !== WHITE) return;
    const id = setTimeout(() => {
      const move = chooseMove(board.slice() as Cell[], WHITE, BLACK, difficulty);
      if (move) place(move.x, move.y, WHITE);
    }, 320);
    return () => clearTimeout(id);
  }, [turn, status, board, place, difficulty]);

  const newGame = () => {
    setBoard(createBoard());
    setTurn(BLACK);
    setStatus('playing');
    setLast(null);
    setHistory([]);
  };

  // Undo a full round (the AI's reply + the player's move).
  const undo = () => {
    if (turn !== BLACK || status !== 'playing' || history.length === 0) return;
    setBoard((prev) => {
      const next = prev.slice() as Cell[];
      const h = history.slice();
      for (let k = 0; k < 2 && h.length; k++) next[h.pop()!] = EMPTY;
      setHistory(h);
      setLast(h.length ? h[h.length - 1] : null);
      return next;
    });
  };

  const onShare = async () => {
    const headline =
      status === 'black'
        ? t('gomoku.youWin')
        : status === 'white'
          ? t('gomoku.youLose')
          : t('gomoku.draw');
    const text = `BrainClub · ${t('games.gomoku.name')}\n${
      status === 'black' ? '🏆' : status === 'white' ? '🤖' : '🤝'
    } ${headline}\n${window.location.origin}`;
    let res: 'shared' | 'copied' | 'failed' = 'failed';
    try {
      if (navigator.share) {
        await navigator.share({ title: 'BrainClub', text });
        res = 'shared';
      } else {
        await navigator.clipboard.writeText(text);
        res = 'copied';
      }
    } catch {
      try {
        await navigator.clipboard.writeText(text);
        res = 'copied';
      } catch {
        res = 'failed';
      }
    }
    setShareMsg(res === 'shared' ? t('share.shared') : res === 'copied' ? t('share.copied') : t('share.failed'));
    setTimeout(() => setShareMsg(null), 2500);
  };

  const turnLabel =
    status === 'playing'
      ? turn === BLACK
        ? t('gomoku.yourTurn')
        : t('gomoku.aiTurn')
      : '';

  return (
    <div className="relative h-full w-full">
      <div ref={wrapRef} className="absolute inset-0">
        <canvas ref={canvasRef} onClick={onClick} className="block h-full w-full touch-none" />
      </div>

      {/* Difficulty + turn indicator */}
      <div className="absolute left-0 right-0 top-0 flex flex-col items-center gap-2 p-3">
        <span
          className="font-dot rounded-lg px-2 py-1 text-xs font-bold text-white"
          style={{ backgroundColor: DIFFICULTY_STYLE[difficulty].color }}
        >
          {t(difficultyKey(difficulty))}
        </span>
        <div className="rounded-xl bg-slate-100 px-3 py-1.5 text-sm font-semibold text-slate-700 shadow-sm">
          {status === 'playing' ? (
            <span>
              <span className={turn === BLACK ? 'text-slate-900' : 'text-slate-400'}>⚫ {t('gomoku.you')}</span>
              <span className="mx-2 text-slate-300">·</span>
              <span className={turn === WHITE ? 'text-slate-900' : 'text-slate-400'}>⚪ {t('gomoku.ai')}</span>
              <span className="ml-3 text-brand">{turnLabel}</span>
            </span>
          ) : (
            <span>{t('gomoku.gameOver')}</span>
          )}
        </div>
      </div>

      {/* Controls */}
      <div className="absolute bottom-4 left-1/2 flex -translate-x-1/2 flex-wrap justify-center gap-2">
        <Btn onClick={newGame}>{t('gomoku.newGame')}</Btn>
        <Btn onClick={undo}>{t('gomoku.undo')}</Btn>
      </div>

      {/* Result modal */}
      {status !== 'playing' && (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-900/40 p-6 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-3xl bg-white p-6 text-center text-slate-900 shadow-2xl ring-1 ring-black/5">
            <div className="text-4xl">{status === 'black' ? '🏆' : status === 'white' ? '🤖' : '🤝'}</div>
            <h2 className="font-cyber mt-2 text-2xl">
              {status === 'black' ? t('gomoku.youWin') : status === 'white' ? t('gomoku.youLose') : t('gomoku.draw')}
            </h2>
            <div className="mt-5 flex justify-center gap-2">
              <button onClick={onShare} className="rounded-xl bg-brand px-4 py-2 font-semibold text-white">
                {t('gomoku.share')}
              </button>
              <button onClick={newGame} className="rounded-xl bg-slate-100 px-4 py-2 font-semibold text-slate-700">
                {t('gomoku.again')}
              </button>
            </div>
            {shareMsg && <p className="mt-3 text-sm text-accent">{shareMsg}</p>}
          </div>
        </div>
      )}
    </div>
  );
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function Btn({ children, onClick }: { children: ReactNode; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="rounded-xl bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-200 active:scale-95"
    >
      {children}
    </button>
  );
}
