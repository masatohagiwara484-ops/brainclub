import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { GameProps } from '../types';
import { Icon } from '../../components/Icons';
import { difficultyKey, DIFFICULTY_STYLE, type Difficulty } from '../../lib/difficulty';
import { getSetting, setSetting } from '../../lib/storage';
import { makeRng } from '../../lib/daily';
import { fx } from '../../lib/fx';
import { haptics } from '../../lib/haptics';
import { recordPlay, clamp01, XP_WEIGHT } from '../../lib/synapse';
import { getGame } from '../registry';
import { submitScore } from '../../lib/leaderboard';
import GameResultScreen from '../../components/GameResultScreen';
import { useShareMsg } from '../shareHook';
import {
  COLORS,
  COLS,
  ROWS,
  SHAPES,
  TYPES,
  addGarbage,
  clearLines,
  collides,
  colorValue,
  decodeBoard,
  emptyBoard,
  encodeBoard,
  garbageFor,
  gravityMs,
  lineScore,
  lock,
  makeBag,
  rotateCells,
  spawn,
  type Cell,
  type Piece,
  type PieceType,
} from './tetrisEngine';
import { versusChannel } from '../../lib/realtime';

const AXES = getGame('tetris')?.axes ?? {};
const START_LEVEL: Record<Difficulty, number> = { easy: 0, medium: 4, hard: 8, expert: 12 };
// Online versus runs at a fixed mid speed — fairness over difficulty choice.
const ONLINE_LEVEL = 3;

// FNV-1a string hash → rng seed, so BOTH players deal the same 7-bag sequence
// from the shared match id (the versus standard).
function hashSeed(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export default function TetrisGame({ difficulty = 'easy', online }: GameProps) {
  const { t } = useTranslation();
  const { shareMsg, doShare } = useShareMsg();
  const startLevel = online ? ONLINE_LEVEL : START_LEVEL[difficulty];
  const bestKey = `tetris.best.${difficulty}`;

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  // Gameplay lives in refs (the rAF loop reads them); HUD mirrors to state.
  const boardRef = useRef<Cell[][]>(emptyBoard());
  const pieceRef = useRef<Piece | null>(null);
  const bagRef = useRef<PieceType[]>([]);
  const nextRef = useRef<PieceType>('I');
  const rngRef = useRef<() => number>(
    makeRng(online ? hashSeed(online.matchId) : (Date.now() ^ Math.floor(Math.random() * 1e9)) >>> 0),
  );
  // Versus: incoming attack rows (applied at my next lock) + hole positions
  // (per-receiver deterministic) + the broadcast channel.
  const pendingGarbageRef = useRef(0);
  const holeRngRef = useRef<() => number>(makeRng(online ? hashSeed(online.matchId + online.mySeat) : 1));
  const channelRef = useRef<ReturnType<typeof versusChannel> | null>(null);
  const rafRef = useRef(0);
  const lastDropRef = useRef(0);
  const levelRef = useRef(startLevel);
  const scoreRef = useRef(0);
  const linesRef = useRef(0);
  const overRef = useRef(false);
  const pausedRef = useRef(false);

  const [score, setScore] = useState(0);
  const [lines, setLines] = useState(0);
  const [level, setLevel] = useState(startLevel);
  const [nextType, setNextType] = useState<PieceType>('I');
  const [over, setOver] = useState(false);
  const [paused, setPaused] = useState(false);
  const [best, setBest] = useState(() => getSetting<number>(bestKey, 0));
  const [isBest, setIsBest] = useState(false);
  const [levelUp, setLevelUp] = useState<string | null>(null);
  const [opp, setOpp] = useState<{ board: string; score: number; lines: number } | null>(null);
  const [outcome, setOutcome] = useState<'win' | 'loss' | null>(null);

  const drawFromBag = (): PieceType => {
    if (bagRef.current.length === 0) bagRef.current = makeBag(rngRef.current);
    return bagRef.current.pop()!;
  };
  const newPiece = (): Piece => {
    const tp = nextRef.current;
    nextRef.current = drawFromBag();
    setNextType(nextRef.current);
    return spawn(tp);
  };

  // ---- rendering ----
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

    const cs = Math.min(w / COLS, h / ROWS);
    const bw = cs * COLS;
    const bh = cs * ROWS;
    const ox = (w - bw) / 2;
    const oy = (h - bh) / 2;

    // Playfield backplate + grid.
    ctx.fillStyle = 'rgba(255,255,255,0.03)';
    ctx.fillRect(ox, oy, bw, bh);
    ctx.strokeStyle = 'rgba(255,255,255,0.05)';
    ctx.lineWidth = 1;
    for (let c = 0; c <= COLS; c++) {
      ctx.beginPath();
      ctx.moveTo(ox + c * cs, oy);
      ctx.lineTo(ox + c * cs, oy + bh);
      ctx.stroke();
    }
    for (let r = 0; r <= ROWS; r++) {
      ctx.beginPath();
      ctx.moveTo(ox, oy + r * cs);
      ctx.lineTo(ox + bw, oy + r * cs);
      ctx.stroke();
    }

    const block = (R: number, C: number, color: string, alpha = 1) => {
      if (R < 0) return;
      const x = ox + C * cs;
      const y = oy + R * cs;
      ctx.globalAlpha = alpha;
      ctx.fillStyle = color;
      ctx.fillRect(x + 1, y + 1, cs - 2, cs - 2);
      ctx.fillStyle = 'rgba(255,255,255,0.22)';
      ctx.fillRect(x + 1, y + 1, cs - 2, Math.max(2, cs * 0.18));
      ctx.globalAlpha = 1;
    };

    // Locked cells.
    const board = boardRef.current;
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) if (board[r][c]) block(r, c, COLORS[board[r][c]]);

    // Ghost + active piece.
    const p = pieceRef.current;
    if (p) {
      let gr = p.r;
      while (!collides(board, p.cells, gr + 1, p.c)) gr++;
      const color = COLORS[colorValue(p.type)];
      for (const [cr, cc] of p.cells) block(gr + cr, p.c + cc, color, 0.22);
      for (const [cr, cc] of p.cells) block(p.r + cr, p.c + cc, color);
    }
  }, []);

  // ---- game step / actions ----
  const finish = useCallback(() => {
    if (overRef.current) return;
    overRef.current = true;
    cancelAnimationFrame(rafRef.current);
    setOver(true);
    haptics.bump();
    if (online) {
      // Top-out = I lose. Tell the opponent instantly; Elo settles via the RPC.
      setOutcome('loss');
      channelRef.current?.send({ kind: 'dead' });
      online.reportResult(false);
      return;
    }
    const sc = scoreRef.current;
    const prev = getSetting<number>(bestKey, 0);
    const better = sc > prev;
    if (better) {
      setBest(sc);
      setSetting(bestKey, sc);
    }
    setIsBest(better);
    void submitScore('tetris', difficulty, sc, { score: sc, lines: linesRef.current });
    const res = recordPlay({ gameId: 'tetris', axes: AXES, quality: clamp01(0.2 + 0.6 * clamp01(sc / 8000)), weight: XP_WEIGHT[difficulty] });
    setLevelUp(res.leveledUp ? t('synapse.levelUp', { n: res.newLevel }) : null);
  }, [bestKey, difficulty, t]);

  const lockAndNext = useCallback(() => {
    boardRef.current = lock(boardRef.current, pieceRef.current!);
    const { board, cleared } = clearLines(boardRef.current);
    boardRef.current = board;
    if (cleared > 0) {
      scoreRef.current += lineScore(cleared, levelRef.current);
      linesRef.current += cleared;
      levelRef.current = startLevel + Math.floor(linesRef.current / 10);
      setScore(scoreRef.current);
      setLines(linesRef.current);
      setLevel(levelRef.current);
      fx.correct({ streak: cleared + 1 });
    } else {
      haptics.tick();
    }
    if (online) {
      // Outgoing attack for multi-line clears (double/triple/tetris → 1/2/4).
      const atk = garbageFor(cleared);
      if (atk > 0) channelRef.current?.send({ kind: 'garbage', n: atk });
      // Incoming garbage lands between my locks (classic versus timing).
      if (pendingGarbageRef.current > 0) {
        const g = Math.min(pendingGarbageRef.current, 8);
        pendingGarbageRef.current = 0;
        boardRef.current = addGarbage(boardRef.current, g, () => Math.floor(holeRngRef.current() * COLS));
        haptics.bump();
      }
      // Mirror my board to the opponent's mini view.
      channelRef.current?.send({
        kind: 'state',
        board: encodeBoard(boardRef.current),
        score: scoreRef.current,
        lines: linesRef.current,
      });
    }
    const np = newPiece();
    if (collides(boardRef.current, np.cells, np.r, np.c)) {
      pieceRef.current = np;
      draw();
      finish();
      return;
    }
    pieceRef.current = np;
    lastDropRef.current = performance.now();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draw, finish, startLevel]);

  const stepDown = useCallback(() => {
    const p = pieceRef.current;
    if (!p) return;
    if (!collides(boardRef.current, p.cells, p.r + 1, p.c)) p.r++;
    else lockAndNext();
  }, [lockAndNext]);

  const move = useCallback((dc: number) => {
    const p = pieceRef.current;
    if (!p || overRef.current || pausedRef.current) return;
    if (!collides(boardRef.current, p.cells, p.r, p.c + dc)) {
      p.c += dc;
      draw();
    }
  }, [draw]);

  const rotate = useCallback(() => {
    const p = pieceRef.current;
    if (!p || overRef.current || pausedRef.current) return;
    const rc = rotateCells(p.cells, p.n);
    for (const k of [0, -1, 1, -2, 2]) {
      if (!collides(boardRef.current, rc, p.r, p.c + k)) {
        p.cells = rc;
        p.c += k;
        haptics.tick();
        draw();
        return;
      }
    }
  }, [draw]);

  const softDrop = useCallback(() => {
    const p = pieceRef.current;
    if (!p || overRef.current || pausedRef.current) return;
    if (!collides(boardRef.current, p.cells, p.r + 1, p.c)) {
      p.r++;
      scoreRef.current += 1;
      setScore(scoreRef.current);
      lastDropRef.current = performance.now();
      draw();
    } else lockAndNext();
  }, [draw, lockAndNext]);

  const hardDrop = useCallback(() => {
    const p = pieceRef.current;
    if (!p || overRef.current || pausedRef.current) return;
    let d = 0;
    while (!collides(boardRef.current, p.cells, p.r + 1, p.c)) {
      p.r++;
      d++;
    }
    scoreRef.current += d * 2;
    setScore(scoreRef.current);
    haptics.bump();
    lockAndNext();
    draw();
  }, [draw, lockAndNext]);

  // ---- loop + input (start on mount = at GO!) ----
  useEffect(() => {
    bagRef.current = makeBag(rngRef.current);
    nextRef.current = drawFromBag();
    pieceRef.current = newPiece();
    lastDropRef.current = performance.now();
    const loop = (now: number) => {
      if (overRef.current) return;
      if (!pausedRef.current && now - lastDropRef.current >= gravityMs(levelRef.current)) {
        lastDropRef.current = now;
        stepDown();
      }
      draw();
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);

    const onKey = (e: KeyboardEvent) => {
      if (overRef.current) return;
      const k = e.key;
      if (['ArrowLeft', 'ArrowRight', 'ArrowDown', 'ArrowUp', ' '].includes(k)) e.preventDefault();
      if (k === 'ArrowLeft') move(-1);
      else if (k === 'ArrowRight') move(1);
      else if (k === 'ArrowDown') softDrop();
      else if (k === 'ArrowUp' || k === 'x' || k === 'z') rotate();
      else if (k === ' ') hardDrop();
      else if (k === 'p' || k === 'P') togglePause();
    };
    window.addEventListener('keydown', onKey);
    const ro = new ResizeObserver(() => draw());
    if (wrapRef.current) ro.observe(wrapRef.current);
    return () => {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener('keydown', onKey);
      ro.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Versus channel: opponent board mirror, garbage in, opponent top-out.
  useEffect(() => {
    if (!online) return;
    const ch = versusChannel(online.matchId, (m) => {
      if (m.kind === 'state') setOpp({ board: m.board, score: m.score, lines: m.lines });
      else if (m.kind === 'garbage') pendingGarbageRef.current += m.n;
      else if (m.kind === 'dead') {
        if (overRef.current) return;
        overRef.current = true;
        cancelAnimationFrame(rafRef.current);
        setOver(true);
        setOutcome('win');
        online.reportResult(true);
      }
    });
    channelRef.current = ch;
    return () => {
      channelRef.current = null;
      ch.close();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [online?.matchId]);

  // Match settled outside the channel (opponent resigned / left → forfeit).
  useEffect(() => {
    if (!online?.finished || overRef.current) return;
    overRef.current = true;
    cancelAnimationFrame(rafRef.current);
    setOver(true);
    setOutcome(online.winnerSeat === online.mySeat ? 'win' : 'loss');
  }, [online?.finished, online?.winnerSeat, online?.mySeat]);

  const togglePause = () => {
    if (online) return; // no pausing a live opponent
    if (overRef.current) return;
    pausedRef.current = !pausedRef.current;
    setPaused(pausedRef.current);
    lastDropRef.current = performance.now();
  };

  const restart = () => {
    cancelAnimationFrame(rafRef.current);
    boardRef.current = emptyBoard();
    rngRef.current = makeRng((Date.now() ^ Math.floor(Math.random() * 1e9)) >>> 0);
    bagRef.current = makeBag(rngRef.current);
    nextRef.current = drawFromBag();
    pieceRef.current = newPiece();
    scoreRef.current = 0;
    linesRef.current = 0;
    levelRef.current = startLevel;
    overRef.current = false;
    pausedRef.current = false;
    lastDropRef.current = performance.now();
    setScore(0);
    setLines(0);
    setLevel(startLevel);
    setOver(false);
    setPaused(false);
    setIsBest(false);
    setLevelUp(null);
    const loop = (now: number) => {
      if (overRef.current) return;
      if (!pausedRef.current && now - lastDropRef.current >= gravityMs(levelRef.current)) {
        lastDropRef.current = now;
        stepDown();
      }
      draw();
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
  };

  // Next-piece preview cells (in its n×n box).
  const previewCells = SHAPES[nextType];

  return (
    <div className="relative flex h-full w-full flex-col bg-[radial-gradient(120%_100%_at_50%_0%,#1b1840_0%,#0e1226_60%,#05060d_100%)] text-white">
      {/* HUD */}
      <div className="flex items-center justify-between px-4 pb-1 pt-3 text-sm">
        {online ? (
          <span className="font-dot rounded-lg bg-primary/80 px-2 py-1 text-xs font-bold">
            🌐 {t('online.vsLabel', { name: online.opponentName })}
          </span>
        ) : (
          <span className="font-dot rounded-lg px-2 py-1 text-xs font-bold" style={{ backgroundColor: DIFFICULTY_STYLE[difficulty].color }}>
            {t(difficultyKey(difficulty))}
          </span>
        )}
        <div className="flex gap-3 text-xs font-semibold tabular-nums">
          <span>{t('tetris.score')} <b className="text-accent-cyan">{score}</b></span>
          <span>{t('tetris.lvl')} <b>{level}</b></span>
          <span>{t('tetris.lines')} <b>{lines}</b></span>
        </div>
        {online ? (
          <span className="w-11" />
        ) : (
          <button
            onClick={togglePause}
            aria-label={paused ? 'resume' : 'pause'}
            className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/10 ring-1 ring-white/15"
          >
            <Icon name={paused ? 'play' : 'pause'} className="h-4 w-4" />
          </button>
        )}
      </div>

      <div className="flex flex-1 items-stretch justify-center gap-2 overflow-hidden px-2">
        <div ref={wrapRef} className="relative flex-1">
          <canvas ref={canvasRef} className="block h-full w-full touch-none" />
        </div>
        {/* Side: next + best */}
        <div className="flex w-16 flex-col items-center gap-2 pt-1">
          <span className="text-[10px] uppercase tracking-wide text-white/45">{t('tetris.next')}</span>
          <div className="grid gap-0.5" style={{ gridTemplateColumns: `repeat(${previewCells.n}, 12px)` }}>
            {Array.from({ length: previewCells.n * previewCells.n }).map((_, i) => {
              const r = Math.floor(i / previewCells.n);
              const c = i % previewCells.n;
              const on = previewCells.cells.some(([cr, cc]) => cr === r && cc === c);
              return <span key={i} className="h-3 w-3 rounded-[2px]" style={{ background: on ? COLORS[TYPES.indexOf(nextType) + 1] : 'transparent' }} />;
            })}
          </div>
          {online ? (
            <>
              <span className="mt-2 max-w-full truncate text-[10px] uppercase tracking-wide text-white/45">
                {online.opponentName}
              </span>
              <OppBoard encoded={opp?.board ?? null} />
              <span className="text-xs font-bold tabular-nums text-accent-cyan">{opp?.score ?? 0}</span>
            </>
          ) : (
            <>
              <span className="mt-1 text-[10px] text-white/45">🏆</span>
              <span className="text-xs font-bold tabular-nums text-white/70">{best}</span>
            </>
          )}
        </div>
      </div>

      {/* Touch controls */}
      <div className="grid grid-cols-5 gap-2 px-3 pb-5 pt-2">
        <Pad onClick={() => move(-1)}>◀</Pad>
        <Pad onClick={rotate}>⟳</Pad>
        <Pad onClick={() => move(1)}>▶</Pad>
        <Pad onClick={softDrop}>▼</Pad>
        <Pad onClick={hardDrop} accent>⤓</Pad>
      </div>

      {over && (
        <GameResultScreen
          gameId="tetris"
          emoji={online ? (outcome === 'win' ? '🏆' : '😞') : isBest ? '🏆' : '🧱'}
          title={
            online
              ? outcome === 'win'
                ? t('tetris.youWin')
                : t('tetris.youLose')
              : isBest
                ? t('tetris.newBest')
                : t('tetris.gameOver')
          }
          isNewBest={!online && isBest}
          celebrate={online ? outcome === 'win' : true}
          levelUp={levelUp}
          stats={[
            { value: score, label: t('tetris.score') },
            { value: lines, label: t('tetris.lines') },
            ...(online && opp ? [{ value: opp.score, label: online.opponentName }] : [{ value: level, label: t('tetris.lvl') }]),
          ]}
          actions={
            online
              ? [
                  { label: t('online.newOpponent'), onClick: online.leave, variant: 'primary' as const },
                  { label: t('tetris.share'), onClick: () => doShare(`BrainClub · ${t('games.tetris.name')} (${t('online.title')})\n${outcome === 'win' ? '🏆' : '🧱'} ${score} · ${lines} ${t('tetris.lines')}\n${window.location.origin}`), variant: 'secondary' as const },
                ]
              : [
                  { label: t('tetris.again'), onClick: restart, variant: 'primary' as const },
                  { label: t('tetris.share'), onClick: () => doShare(`BrainClub · ${t('games.tetris.name')} (${t(difficultyKey(difficulty))})\n🧱 ${score} · ${lines} ${t('tetris.lines')}\n${window.location.origin}`), variant: 'secondary' as const },
                ]
          }
          shareMsg={shareMsg}
        />
      )}
    </div>
  );
}

// The opponent's live board, decoded from the broadcast mirror — small but
// readable (the Tetris-99 glance: am I winning the race?).
function OppBoard({ encoded }: { encoded: string | null }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const cs = 6; // 6px cells → 60×120 mini board
    canvas.width = COLS * cs;
    canvas.height = ROWS * cs;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = 'rgba(255,255,255,0.04)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    if (!encoded) return;
    const board = decodeBoard(encoded);
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const v = board[r][c];
        if (!v) continue;
        ctx.fillStyle = COLORS[v] ?? '#64748b';
        ctx.fillRect(c * cs, r * cs, cs - 1, cs - 1);
      }
    }
  }, [encoded]);
  return <canvas ref={ref} className="rounded-md ring-1 ring-white/15" style={{ width: COLS * 6, height: ROWS * 6 }} />;
}

function Pad({ children, onClick, accent }: { children: React.ReactNode; onClick: () => void; accent?: boolean }) {
  return (
    <button
      onClick={onClick}
      className={`grid h-14 place-items-center rounded-2xl text-2xl font-bold shadow-premium transition active:scale-95 ${
        accent ? 'bg-gradient-to-r from-iris-cyan via-iris-violet to-iris-magenta text-white' : 'bg-white/[0.1] text-white ring-1 ring-white/15'
      }`}
    >
      {children}
    </button>
  );
}
