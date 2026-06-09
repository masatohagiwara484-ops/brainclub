import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import {
  EMPTY,
  HUMAN,
  AI,
  SIZE_FOR,
  idx,
  createBoard,
  hasConnection,
  isBoardFull,
  chooseMove,
  type Cell,
} from './hexEngine';
import { haptics } from '../../lib/haptics';
import { difficultyKey, DIFFICULTY_STYLE } from '../../lib/difficulty';
import { recordPlay, difficultyQuality, XP_WEIGHT } from '../../lib/synapse';
import { getGame } from '../registry';
import GameResultScreen from '../../components/GameResultScreen';
import type { GameProps } from '../types';

const AXES = getGame('hex')?.axes ?? {};
const SQ3 = Math.sqrt(3);

// Player identities (HUMAN connects top↔bottom; AI connects left↔right).
const HUMAN_EDGE = '#22d3ee'; // cyan — the player's two edges
const AI_EDGE = '#fb7185'; // rose — the AI's two edges
const HUMAN_FILL: [string, string] = ['#a5f3fc', '#0891b2'];
const AI_FILL: [string, string] = ['#fecdd3', '#e11d48'];

type Status = 'playing' | 'human' | 'ai';
type Geom = { R: number; ox: number; oy: number };

function geom(n: number, w: number, h: number): Geom {
  const pad = 10;
  const spanX = SQ3 * (1.5 * (n - 1) + 1);
  const spanY = 1.5 * (n - 1) + 2;
  const R = Math.min((w - 2 * pad) / spanX, (h - 2 * pad) / spanY);
  const boardW = R * spanX;
  const boardH = R * spanY;
  const ox = (w - boardW) / 2 + (R * SQ3) / 2;
  const oy = (h - boardH) / 2 + R;
  return { R, ox, oy };
}

function center(g: Geom, r: number, c: number): [number, number] {
  return [g.ox + g.R * SQ3 * (c + r / 2), g.oy + g.R * 1.5 * r];
}

// Pointy-top hexagon corners, indices 0..5 going clockwise from the upper-right.
function corners(cx: number, cy: number, R: number): Array<[number, number]> {
  const pts: Array<[number, number]> = [];
  for (let k = 0; k < 6; k++) {
    const a = (Math.PI / 180) * (60 * k - 30);
    pts.push([cx + R * Math.cos(a), cy + R * Math.sin(a)]);
  }
  return pts;
}

export default function HexGame({ difficulty = 'medium', online }: GameProps) {
  const { t } = useTranslation();
  const n = SIZE_FOR[difficulty];

  // In AI mode the human is HUMAN (cyan, top↔bottom). Online, the first mover is
  // HUMAN and the second is AI (rose, left↔right); win/loss is read vs. this.
  const myColor: typeof HUMAN | typeof AI = online && !online.iMoveFirst ? AI : HUMAN;
  const myStatus: Status = myColor === HUMAN ? 'human' : 'ai';
  const oppStatus: Status = myColor === HUMAN ? 'ai' : 'human';
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  // Cell centers + R from the last draw, for hit-testing taps.
  const hitRef = useRef<{ centers: Array<[number, number]>; R: number }>({ centers: [], R: 0 });

  const [board, setBoard] = useState<Cell[]>(() => createBoard(n));
  const [turn, setTurn] = useState<typeof HUMAN | typeof AI>(HUMAN);
  const [status, setStatus] = useState<Status>('playing');
  const [last, setLast] = useState<number | null>(null);
  const [history, setHistory] = useState<number[]>([]);
  const [levelUp, setLevelUp] = useState<string | null>(null);
  const [shareMsg, setShareMsg] = useState<string | null>(null);
  const recordedRef = useRef(false);

  // Record one Synapse play when the game ends. A win counts most; a loss still
  // logs a little logic activity. Fires exactly once per finished game. Online
  // games rank via Elo instead, so they skip the local Synapse log.
  useEffect(() => {
    if (online) return;
    if (status === 'playing') {
      recordedRef.current = false;
      return;
    }
    if (recordedRef.current) return;
    recordedRef.current = true;
    const quality = status === 'human' ? difficultyQuality(difficulty, 0.8) : 0.15;
    const res = recordPlay({ gameId: 'hex', axes: AXES, quality, weight: XP_WEIGHT[difficulty] });
    setLevelUp(status === 'human' && res.leveledUp ? t('synapse.levelUp', { n: res.newLevel }) : null);
  }, [status, difficulty, t]);

  // ---- online: derive the whole board from the authoritative move log -------
  // Move i is HUMAN on even i, AI on odd i. Rebuilding from the log keeps both
  // clients in lockstep and rebuilds the board for free on reconnect.
  useEffect(() => {
    if (!online) return;
    const next = createBoard(n);
    let lastCell: number | null = null;
    let winColor: Cell = EMPTY;
    online.moves.forEach((mv, i) => {
      const cell = (mv as { cell: number }).cell;
      const color: Cell = i % 2 === 0 ? HUMAN : AI;
      next[cell] = color;
      lastCell = cell;
      if (winColor === EMPTY && hasConnection(next, n, color === HUMAN ? HUMAN : AI)) winColor = color;
    });
    setBoard(next);
    setLast(lastCell);
    setTurn(online.moves.length % 2 === 0 ? HUMAN : AI);
    if (winColor !== EMPTY) {
      const ws: Status = winColor === HUMAN ? 'human' : 'ai';
      setStatus(ws);
      if (ws === oppStatus) haptics.bump();
    } else if (online.finished && online.winnerSeat) {
      setStatus(online.winnerSeat === online.mySeat ? myStatus : oppStatus);
    } else {
      setStatus('playing');
    }
  }, [online?.moves, online?.finished, online?.winnerSeat]); // eslint-disable-line react-hooks/exhaustive-deps

  // Online: report a board-detected result (idempotent server-side).
  const reportedRef = useRef(false);
  useEffect(() => {
    if (!online) return;
    if (status === 'playing') {
      reportedRef.current = false;
      return;
    }
    if (reportedRef.current) return;
    reportedRef.current = true;
    online.reportResult(status === myStatus);
  }, [status, online]); // eslint-disable-line react-hooks/exhaustive-deps

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

    const g = geom(n, w, h);
    const R = g.R;
    const centers: Array<[number, number]> = new Array(n * n);

    // Pass 1: cell fills + thin separators.
    for (let r = 0; r < n; r++) {
      for (let c = 0; c < n; c++) {
        const k = idx(n, r, c);
        const [cx, cy] = center(g, r, c);
        centers[k] = [cx, cy];
        const pts = corners(cx, cy, R * 0.94);
        ctx.beginPath();
        ctx.moveTo(pts[0][0], pts[0][1]);
        for (let i = 1; i < 6; i++) ctx.lineTo(pts[i][0], pts[i][1]);
        ctx.closePath();
        const v = board[k];
        if (v === EMPTY) {
          ctx.fillStyle = 'rgba(255,255,255,0.05)';
          ctx.fill();
          ctx.lineWidth = 1;
          ctx.strokeStyle = 'rgba(255,255,255,0.14)';
          ctx.stroke();
        } else {
          const [c0, c1] = v === HUMAN ? HUMAN_FILL : AI_FILL;
          const grad = ctx.createRadialGradient(cx - R * 0.28, cy - R * 0.3, R * 0.1, cx, cy, R);
          grad.addColorStop(0, c0);
          grad.addColorStop(1, c1);
          ctx.fillStyle = grad;
          ctx.fill();
          ctx.lineWidth = 1.5;
          ctx.strokeStyle = 'rgba(8,12,24,0.55)';
          ctx.stroke();
        }
      }
    }

    // Pass 2: thick coloured edges marking each player's goal sides.
    const edge = (pts: Array<[number, number]>, a: number, b: number, color: string) => {
      ctx.strokeStyle = color;
      ctx.lineWidth = Math.max(3, R * 0.26);
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(pts[a][0], pts[a][1]);
      ctx.lineTo(pts[b][0], pts[b][1]);
      ctx.stroke();
    };
    for (let c = 0; c < n; c++) {
      const top = corners(...center(g, 0, c), R * 0.94);
      edge(top, 4, 5, HUMAN_EDGE);
      edge(top, 5, 0, HUMAN_EDGE);
      const bot = corners(...center(g, n - 1, c), R * 0.94);
      edge(bot, 1, 2, HUMAN_EDGE);
      edge(bot, 2, 3, HUMAN_EDGE);
    }
    for (let r = 0; r < n; r++) {
      const lf = corners(...center(g, r, 0), R * 0.94);
      edge(lf, 3, 4, AI_EDGE);
      edge(lf, 4, 5, AI_EDGE);
      const rt = corners(...center(g, r, n - 1), R * 0.94);
      edge(rt, 0, 1, AI_EDGE);
      edge(rt, 1, 2, AI_EDGE);
    }

    // Last-move marker.
    if (last != null && centers[last]) {
      const [cx, cy] = centers[last];
      ctx.strokeStyle = 'rgba(255,255,255,0.92)';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(cx, cy, R * 0.34, 0, Math.PI * 2);
      ctx.stroke();
    }

    hitRef.current = { centers, R };
  }, [board, last, n]);

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
    (cell: number, color: Cell) => {
      setBoard((prev) => {
        if (prev[cell] !== EMPTY) return prev;
        const next = prev.slice() as Cell[];
        next[cell] = color;
        setLast(cell);
        setHistory((hh) => [...hh, cell]);
        haptics.tick();
        if (hasConnection(next, n, color === HUMAN ? HUMAN : AI)) {
          setStatus(color === HUMAN ? 'human' : 'ai');
          if (color !== HUMAN) haptics.bump();
        } else if (isBoardFull(next)) {
          // Unreachable in Hex (no draws), but guard anyway.
          setStatus('human');
        } else {
          setTurn(color === HUMAN ? AI : HUMAN);
        }
        return next;
      });
    },
    [n],
  );

  const onClick = (ev: React.MouseEvent<HTMLCanvasElement>) => {
    if (status !== 'playing' || turn !== myColor) return;
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const px = ev.clientX - rect.left;
    const py = ev.clientY - rect.top;
    const { centers, R } = hitRef.current;
    let bestK = -1;
    let bestD = Infinity;
    for (let k = 0; k < centers.length; k++) {
      const cc = centers[k];
      if (!cc) continue;
      const d = (cc[0] - px) ** 2 + (cc[1] - py) ** 2;
      if (d < bestD) {
        bestD = d;
        bestK = k;
      }
    }
    if (bestK < 0 || bestD > (R * 1.02) ** 2) return; // tap landed outside the board
    if (board[bestK] !== EMPTY) return;
    if (online) {
      online.sendMove({ cell: bestK });
      return;
    }
    place(bestK, HUMAN);
  };

  // AI responds whenever it is its turn (single-player only).
  useEffect(() => {
    if (online) return;
    if (status !== 'playing' || turn !== AI) return;
    const id = setTimeout(() => {
      const move = chooseMove(board.slice() as Cell[], n, difficulty);
      if (move != null) place(move, AI);
    }, 340);
    return () => clearTimeout(id);
  }, [turn, status, board, place, difficulty, n]);

  const newGame = () => {
    setBoard(createBoard(n));
    setTurn(HUMAN);
    setStatus('playing');
    setLast(null);
    setHistory([]);
    setLevelUp(null);
  };

  // Undo a full round (the AI's reply + the player's move).
  const undo = () => {
    if (turn !== HUMAN || status !== 'playing' || history.length === 0) return;
    setBoard((prev) => {
      const next = prev.slice() as Cell[];
      const hh = history.slice();
      for (let k = 0; k < 2 && hh.length; k++) next[hh.pop()!] = EMPTY;
      setHistory(hh);
      setLast(hh.length ? hh[hh.length - 1] : null);
      return next;
    });
  };

  const won = status === myStatus;

  const onShare = async () => {
    const headline = won ? t('hex.youWin') : t('hex.youLose');
    const tag = online ? t('online.title') : t(difficultyKey(difficulty));
    const text = `BrainClub · ${t('games.hex.name')} (${tag})\n${
      won ? '🏆' : online ? '😞' : '🤖'
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
      ? turn === myColor
        ? t('hex.yourTurn')
        : online
          ? t('online.opponentTurn')
          : t('hex.aiTurn')
      : '';

  const myEdge = myColor === HUMAN ? HUMAN_EDGE : AI_EDGE;
  const oppEdge = myColor === HUMAN ? AI_EDGE : HUMAN_EDGE;
  const myActive = turn === myColor;
  const goalText = online
    ? myColor === HUMAN
      ? t('online.hexGoalTopBottom')
      : t('online.hexGoalLeftRight')
    : t('hex.goal');

  return (
    <div className="relative h-full w-full bg-[radial-gradient(120%_90%_at_50%_0%,#1b2350_0%,#0b1020_60%,#070a16_100%)]">
      <div ref={wrapRef} className="absolute inset-0 px-2 pb-20 pt-24">
        <canvas ref={canvasRef} onClick={onClick} className="block h-full w-full touch-none" />
      </div>

      {/* Difficulty / online + whose-turn indicator */}
      <div className="absolute left-0 right-0 top-0 flex flex-col items-center gap-2 p-3">
        {online ? (
          <span className="font-dot rounded-lg bg-primary/80 px-2 py-1 text-xs font-bold text-white">
            🌐 {t('online.vsLabel', { name: online.opponentName })}
          </span>
        ) : (
          <span
            className="font-dot rounded-lg px-2 py-1 text-xs font-bold text-white"
            style={{ backgroundColor: DIFFICULTY_STYLE[difficulty].color }}
          >
            {t(difficultyKey(difficulty))}
          </span>
        )}
        <div className="rounded-xl bg-slate-900/70 px-3 py-1.5 text-sm font-semibold text-white shadow-sm ring-1 ring-white/10 backdrop-blur">
          {status === 'playing' ? (
            <span>
              <span className={myActive ? 'text-white' : 'text-white/40'}>
                <span style={{ color: myEdge }}>⬢</span> {t('hex.you')}
              </span>
              <span className="mx-2 text-white/30">·</span>
              <span className={!myActive ? 'text-white' : 'text-white/40'}>
                <span style={{ color: oppEdge }}>⬢</span> {online ? online.opponentName : t('hex.ai')}
              </span>
              <span className="ml-3 text-accent-cyan">{turnLabel}</span>
            </span>
          ) : (
            <span>{t('hex.gameOver')}</span>
          )}
        </div>
        <p className="max-w-xs text-center text-[11px] leading-tight text-white/45">{goalText}</p>
      </div>

      {/* Controls */}
      <div className="absolute bottom-4 left-1/2 flex -translate-x-1/2 flex-wrap justify-center gap-2">
        {online ? (
          status === 'playing' && <Btn onClick={() => online.resign()}>{t('online.resign')}</Btn>
        ) : (
          <>
            <Btn onClick={newGame}>{t('hex.newGame')}</Btn>
            <Btn onClick={undo}>{t('hex.undo')}</Btn>
          </>
        )}
      </div>

      {/* Result */}
      {status !== 'playing' && (
        <GameResultScreen
          gameId="hex"
          emoji={won ? '🏆' : online ? '😞' : '🤖'}
          title={won ? t('hex.youWin') : t('hex.youLose')}
          celebrate={won}
          levelUp={levelUp}
          actions={
            online
              ? [
                  { label: t('hex.share'), onClick: onShare, variant: 'primary' },
                  { label: t('online.newOpponent'), onClick: online.leave, variant: 'secondary' },
                ]
              : [
                  { label: t('hex.share'), onClick: onShare, variant: 'primary' },
                  { label: t('hex.again'), onClick: newGame, variant: 'secondary' },
                ]
          }
          shareMsg={shareMsg}
        />
      )}
    </div>
  );
}

function Btn({ children, onClick }: { children: ReactNode; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="rounded-xl bg-white/[0.08] px-4 py-2 text-sm font-semibold text-white shadow-sm ring-1 ring-white/12 backdrop-blur transition hover:bg-white/15 active:scale-95"
    >
      {children}
    </button>
  );
}
