import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { GameProps } from '../types';
import { difficultyKey, DIFFICULTY_STYLE } from '../../lib/difficulty';
import { recordPlay, difficultyQuality, XP_WEIGHT } from '../../lib/synapse';
import { getGame } from '../registry';
import { haptics } from '../../lib/haptics';
import { fx } from '../../lib/fx';
import GameResultScreen from '../../components/GameResultScreen';
import {
  BASE,
  COLORS,
  GOAL,
  HOME_ENTRY,
  RING,
  START_OFFSET,
  TOKENS,
  SAFE,
  applyMove,
  chooseAIMove,
  hasWon,
  initialPos,
  legalMoves,
  type Color,
  type Move,
  type Pos,
} from './ludoEngine';
import {
  BASE_RECT,
  BASE_SLOTS,
  COLOR_DARK,
  COLOR_HEX,
  COLOR_LIGHT,
  GRID,
  HOME_CELLS,
  RING_CELLS,
} from './ludoBoard';

const AXES = getGame('ludo')?.axes ?? {};
const HUMAN: Color = 0;

type Phase = 'roll' | 'rolling' | 'move' | 'over';

// Grid cell (x,y) for a token of `color` at progress `t` (BASE handled by slot).
function tokenGrid(color: Color, t: number, tokenIdx: number): readonly [number, number] {
  if (t === BASE) return BASE_SLOTS[color][tokenIdx];
  if (t <= HOME_ENTRY) return RING_CELLS[(START_OFFSET[color] + t) % RING];
  return HOME_CELLS[color][t - 51];
}

type Hit = { color: Color; token: number; x: number; y: number; r: number };

export default function LudoGame({ difficulty = 'medium' }: GameProps) {
  const { t } = useTranslation();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  const [pos, setPos] = useState<Pos>(() => initialPos());
  const [turn, setTurn] = useState<Color>(HUMAN);
  const [phase, setPhase] = useState<Phase>('roll');
  const [die, setDie] = useState(0); // 0 = no die shown yet
  const [dieFace, setDieFace] = useState(1); // animated face while rolling
  const [movable, setMovable] = useState<number[]>([]); // human's movable tokens
  const [winner, setWinner] = useState<Color | null>(null);
  const [levelUp, setLevelUp] = useState<string | null>(null);
  const [shareMsg, setShareMsg] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null); // transient status ("no move", "three 6s")

  // Refs mirror state so the async turn loop always reads fresh values.
  const posRef = useRef(pos);
  const turnRef = useRef(turn);
  const phaseRef = useRef(phase);
  const dieRef = useRef(die);
  const movesRef = useRef<Move[]>([]); // legal moves for the live roll
  const sixesRef = useRef(0); // consecutive 6s this turn
  const hitsRef = useRef<Hit[]>([]);
  const lastRef = useRef<{ color: Color; token: number } | null>(null);
  const recordedRef = useRef(false);
  const timers = useRef<number[]>([]);

  useEffect(() => {
    posRef.current = pos;
  }, [pos]);
  useEffect(() => {
    turnRef.current = turn;
  }, [turn]);
  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);
  useEffect(() => {
    dieRef.current = die;
  }, [die]);

  const after = (ms: number, fn: () => void) => {
    const id = window.setTimeout(fn, ms);
    timers.current.push(id);
  };
  useEffect(() => () => timers.current.forEach((id) => clearTimeout(id)), []);

  const flash = (msg: string) => {
    setNote(msg);
    after(1300, () => setNote((m) => (m === msg ? null : m)));
  };

  // ---- turn loop --------------------------------------------------------------

  const passTurn = useCallback(() => {
    sixesRef.current = 0;
    const next = ((turnRef.current + 1) % 4) as Color;
    turnRef.current = next;
    setTurn(next);
    setDie(0);
    dieRef.current = 0;
    setMovable([]);
    movesRef.current = [];
    setPhase('roll');
    phaseRef.current = 'roll';
  }, []);

  const resolve = useCallback(
    (res: { pos: Pos; captured: boolean; reachedHome: boolean }, color: Color, d: number) => {
      if (hasWon(res.pos, color)) {
        setWinner(color);
        setPhase('over');
        phaseRef.current = 'over';
        return;
      }
      const extra = d === 6 || res.captured || res.reachedHome;
      setMovable([]);
      movesRef.current = [];
      setDie(0);
      dieRef.current = 0;
      if (extra) {
        setPhase('roll');
        phaseRef.current = 'roll';
      } else {
        passTurn();
      }
    },
    [passTurn],
  );

  const applyChosen = useCallback(
    (move: Move) => {
      const color = turnRef.current;
      const d = dieRef.current;
      const res = applyMove(posRef.current, color, move);
      posRef.current = res.pos;
      setPos(res.pos);
      lastRef.current = { color, token: move.token };
      if (res.captured) {
        haptics.bump();
        fx.correct({ streak: 2 });
      } else if (res.reachedHome) {
        fx.correct({ streak: 4 });
      } else {
        haptics.tick();
      }
      resolve(res, color, d);
    },
    [resolve],
  );

  const finishRoll = useCallback(
    (d: number) => {
      const color = turnRef.current;
      setDie(d);
      dieRef.current = d;
      sixesRef.current = d === 6 ? sixesRef.current + 1 : 0;

      // Three 6s in a row forfeits the turn.
      if (d === 6 && sixesRef.current >= 3) {
        flash(t('ludo.threeSixes'));
        setPhase('rolling'); // keep input gated until passTurn flips the turn
        phaseRef.current = 'rolling';
        after(900, passTurn);
        return;
      }

      const moves = legalMoves(posRef.current, color, d);
      if (moves.length === 0) {
        // A 6 still grants another roll even with nothing to move.
        if (d === 6) {
          flash(t('ludo.rollAgain'));
          after(800, () => {
            setPhase('roll');
            phaseRef.current = 'roll';
          });
        } else {
          flash(t('ludo.noMove'));
          after(850, passTurn);
        }
        phaseRef.current = 'rolling';
        return;
      }

      movesRef.current = moves;
      setMovable(moves.map((m) => m.token));
      setPhase('move');
      phaseRef.current = 'move';

      // The AI auto-picks after a short beat; the human taps a token.
      if (color !== HUMAN) {
        after(640, () => {
          const mv = chooseAIMove(posRef.current, color, d, difficulty);
          if (mv) applyChosen(mv);
          else passTurn();
        });
      }
    },
    [applyChosen, difficulty, passTurn, t],
  );

  const rollDice = useCallback(() => {
    if (phaseRef.current !== 'roll' || winner != null) return;
    setPhase('rolling');
    phaseRef.current = 'rolling';
    haptics.tick();
    let ticks = 0;
    const iv = window.setInterval(() => {
      setDieFace(1 + Math.floor(Math.random() * 6));
      ticks++;
      if (ticks >= 6) {
        window.clearInterval(iv);
        const d = 1 + Math.floor(Math.random() * 6);
        setDieFace(d);
        finishRoll(d);
      }
    }, 75);
    timers.current.push(iv);
  }, [finishRoll, winner]);

  // AI driver: when it is an AI's turn to roll, roll automatically.
  useEffect(() => {
    if (winner != null) return;
    if (phase === 'roll' && turn !== HUMAN) {
      after(560, () => {
        if (phaseRef.current === 'roll' && turnRef.current !== HUMAN) rollDice();
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, turn, winner]);

  // Record one Synapse play when the game ends.
  useEffect(() => {
    if (winner == null || recordedRef.current) return;
    recordedRef.current = true;
    const quality = winner === HUMAN ? difficultyQuality(difficulty, 0.85) : 0.15;
    const res = recordPlay({ gameId: 'ludo', axes: AXES, quality, weight: XP_WEIGHT[difficulty] });
    setLevelUp(winner === HUMAN && res.leveledUp ? t('synapse.levelUp', { n: res.newLevel }) : null);
  }, [winner, difficulty, t]);

  // ---- drawing ----------------------------------------------------------------
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

    const boardPx = Math.min(w, h);
    const cs = boardPx / GRID;
    const ox = (w - boardPx) / 2;
    const oy = (h - boardPx) / 2;
    const cx = (gx: number) => ox + gx * cs;
    const cy = (gy: number) => oy + gy * cs;
    const ctr = (gx: number, gy: number): [number, number] => [ox + (gx + 0.5) * cs, oy + (gy + 0.5) * cs];

    const roundRect = (x: number, y: number, ww: number, hh: number, r: number) => {
      ctx.beginPath();
      ctx.moveTo(x + r, y);
      ctx.arcTo(x + ww, y, x + ww, y + hh, r);
      ctx.arcTo(x + ww, y + hh, x, y + hh, r);
      ctx.arcTo(x, y + hh, x, y, r);
      ctx.arcTo(x, y, x + ww, y, r);
      ctx.closePath();
    };

    // Board backplate.
    ctx.fillStyle = '#0e1428';
    roundRect(ox, oy, boardPx, boardPx, cs * 0.5);
    ctx.fill();

    const cell = (gx: number, gy: number, fill: string, stroke = 'rgba(255,255,255,0.12)') => {
      roundRect(cx(gx) + cs * 0.06, cy(gy) + cs * 0.06, cs * 0.88, cs * 0.88, cs * 0.18);
      ctx.fillStyle = fill;
      ctx.fill();
      ctx.lineWidth = 1;
      ctx.strokeStyle = stroke;
      ctx.stroke();
    };

    // Corner yards.
    for (const c of COLORS) {
      const [bx, by] = BASE_RECT[c];
      ctx.fillStyle = COLOR_HEX[c];
      roundRect(cx(bx) + cs * 0.2, cy(by) + cs * 0.2, cs * 5.6, cs * 5.6, cs * 0.6);
      ctx.fill();
      ctx.fillStyle = 'rgba(8,12,26,0.82)';
      roundRect(cx(bx + 1) + cs * 0.1, cy(by + 1) + cs * 0.1, cs * 3.8, cs * 3.8, cs * 0.4);
      ctx.fill();
    }

    // Track cells (white), with coloured start cells + safe stars.
    for (let i = 0; i < RING_CELLS.length; i++) {
      const [gx, gy] = RING_CELLS[i];
      const isStart = i === START_OFFSET[0] || i === START_OFFSET[1] || i === START_OFFSET[2] || i === START_OFFSET[3];
      const startColor = COLORS.find((c) => START_OFFSET[c] === i);
      cell(gx, gy, isStart && startColor != null ? COLOR_HEX[startColor] : 'rgba(255,255,255,0.92)');
      if (SAFE.has(i) && !isStart) {
        const [sx, sy] = ctr(gx, gy);
        ctx.fillStyle = 'rgba(30,41,59,0.65)';
        ctx.font = `${cs * 0.6}px serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('★', sx, sy);
      }
    }

    // Coloured home columns.
    for (const c of COLORS) {
      for (const [gx, gy] of HOME_CELLS[c]) cell(gx, gy, COLOR_HEX[c], 'rgba(0,0,0,0.18)');
    }

    // Centre: four triangles meeting at the middle.
    const C = ctr(7, 7);
    const corners: Record<Color, [[number, number], [number, number]]> = {
      1: [ctr(6, 6), ctr(8, 6)], // top
      2: [ctr(8, 6), ctr(8, 8)], // right
      3: [ctr(8, 8), ctr(6, 8)], // bottom
      0: [ctr(6, 8), ctr(6, 6)], // left
    };
    for (const c of COLORS) {
      const [a, b] = corners[c];
      ctx.beginPath();
      ctx.moveTo(a[0], a[1]);
      ctx.lineTo(b[0], b[1]);
      ctx.lineTo(C[0], C[1]);
      ctx.closePath();
      ctx.fillStyle = COLOR_HEX[c];
      ctx.fill();
    }

    // ---- tokens (with stacking offsets) ----
    const groups = new Map<string, Array<{ color: Color; token: number }>>();
    for (const c of COLORS) {
      for (let i = 0; i < TOKENS; i++) {
        const g = tokenGrid(c, pos[c][i], i);
        const key = `${g[0]},${g[1]}`;
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key)!.push({ color: c, token: i });
      }
    }
    const hits: Hit[] = [];
    const r = cs * 0.34;
    for (const [key, members] of groups) {
      const [gx, gy] = key.split(',').map(Number);
      const [bx, by] = ctr(gx, gy);
      members.forEach((m, k) => {
        const spread = members.length > 1 ? cs * 0.16 : 0;
        const ang = (k / members.length) * Math.PI * 2;
        const px = bx + Math.cos(ang) * spread;
        const py = by + Math.sin(ang) * spread;
        const grad = ctx.createRadialGradient(px - r * 0.3, py - r * 0.35, r * 0.2, px, py, r);
        grad.addColorStop(0, COLOR_LIGHT[m.color]);
        grad.addColorStop(1, COLOR_DARK[m.color]);
        ctx.beginPath();
        ctx.arc(px, py, r, 0, Math.PI * 2);
        ctx.fillStyle = grad;
        ctx.fill();
        ctx.lineWidth = 1.5;
        ctx.strokeStyle = 'rgba(8,12,24,0.7)';
        ctx.stroke();
        // movable (human) highlight + last-moved marker
        const isMovable = turn === HUMAN && phase === 'move' && m.color === HUMAN && movable.includes(m.token);
        if (isMovable) {
          ctx.beginPath();
          ctx.arc(px, py, r + cs * 0.08, 0, Math.PI * 2);
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 2.5;
          ctx.stroke();
        }
        if (lastRef.current && lastRef.current.color === m.color && lastRef.current.token === m.token) {
          ctx.beginPath();
          ctx.arc(px, py, r * 0.4, 0, Math.PI * 2);
          ctx.fillStyle = 'rgba(255,255,255,0.85)';
          ctx.fill();
        }
        hits.push({ color: m.color, token: m.token, x: px, y: py, r: r + cs * 0.12 });
      });
    }
    hitsRef.current = hits;
  }, [pos, turn, phase, movable]);

  useEffect(() => {
    draw();
  }, [draw]);
  useEffect(() => {
    const ro = new ResizeObserver(() => draw());
    if (wrapRef.current) ro.observe(wrapRef.current);
    return () => ro.disconnect();
  }, [draw]);

  // ---- interaction ------------------------------------------------------------
  const onClick = (ev: React.MouseEvent<HTMLCanvasElement>) => {
    if (turn !== HUMAN || phase !== 'move') return;
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const px = ev.clientX - rect.left;
    const py = ev.clientY - rect.top;
    let best: Hit | null = null;
    let bestD = Infinity;
    for (const hh of hitsRef.current) {
      if (hh.color !== HUMAN || !movable.includes(hh.token)) continue;
      const d = (hh.x - px) ** 2 + (hh.y - py) ** 2;
      if (d < bestD && d <= hh.r ** 2) {
        bestD = d;
        best = hh;
      }
    }
    if (!best) return;
    const move = movesRef.current.find((m) => m.token === best!.token);
    if (move) applyChosen(move);
  };

  const newGame = () => {
    timers.current.forEach((id) => clearTimeout(id));
    timers.current = [];
    const fresh = initialPos();
    posRef.current = fresh;
    setPos(fresh);
    setTurn(HUMAN);
    turnRef.current = HUMAN;
    setPhase('roll');
    phaseRef.current = 'roll';
    setDie(0);
    dieRef.current = 0;
    setMovable([]);
    movesRef.current = [];
    sixesRef.current = 0;
    lastRef.current = null;
    recordedRef.current = false;
    setWinner(null);
    setLevelUp(null);
  };

  const onShare = async () => {
    const won = winner === HUMAN;
    const text = `BrainClub · ${t('games.ludo.name')} (${t(difficultyKey(difficulty))})\n${won ? '🏆' : '🎲'} ${
      won ? t('ludo.youWin') : t('ludo.youLose')
    }\n${window.location.origin}`;
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

  const canRoll = phase === 'roll' && turn === HUMAN && winner == null;
  const finished = (c: Color) => pos[c].filter((tk) => tk === GOAL).length;

  return (
    <div className="relative h-full w-full bg-[radial-gradient(120%_90%_at_50%_0%,#161d40_0%,#0b1020_60%,#070a16_100%)]">
      <div ref={wrapRef} className="absolute inset-0 px-2 pb-24 pt-20">
        <canvas ref={canvasRef} onClick={onClick} className="block h-full w-full touch-none" />
      </div>

      {/* Top: difficulty + per-colour finished count + turn */}
      <div className="absolute left-0 right-0 top-0 flex flex-col items-center gap-2 p-3">
        <div className="flex items-center gap-2">
          <span
            className="font-dot rounded-lg px-2 py-1 text-xs font-bold text-white"
            style={{ backgroundColor: DIFFICULTY_STYLE[difficulty].color }}
          >
            {t(difficultyKey(difficulty))}
          </span>
          {COLORS.map((c) => (
            <span
              key={c}
              className="flex items-center gap-1 rounded-lg px-1.5 py-1 text-xs font-bold tabular-nums"
              style={{
                backgroundColor: turn === c && winner == null ? COLOR_HEX[c] : 'rgba(255,255,255,0.08)',
                color: turn === c && winner == null ? '#0b1020' : COLOR_LIGHT[c],
              }}
            >
              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: COLOR_HEX[c] }} />
              {finished(c)}/4
            </span>
          ))}
        </div>
        <div className="rounded-xl bg-slate-900/70 px-3 py-1 text-xs font-semibold text-white shadow-sm ring-1 ring-white/10 backdrop-blur">
          {winner != null
            ? t('ludo.gameOver')
            : turn === HUMAN
              ? phase === 'move'
                ? t('ludo.tapToken')
                : t('ludo.yourRoll')
              : t('ludo.aiTurn')}
          {note && <span className="ml-2 text-accent-cyan">{note}</span>}
        </div>
      </div>

      {/* Bottom: the die + roll button */}
      <div className="absolute bottom-5 left-1/2 flex -translate-x-1/2 items-center gap-3">
        <Die value={die === 0 ? dieFace : die} rolling={phase === 'rolling'} color={COLOR_HEX[turn]} />
        <button
          onClick={rollDice}
          disabled={!canRoll}
          className={`rounded-2xl px-6 py-3 text-base font-bold shadow-premium transition active:scale-95 ${
            canRoll
              ? 'bg-gradient-to-r from-primary to-accent-cyan text-white'
              : 'cursor-not-allowed bg-white/[0.06] text-white/40'
          }`}
        >
          {t('ludo.roll')}
        </button>
        <button
          onClick={newGame}
          className="rounded-2xl bg-white/[0.08] px-4 py-3 text-sm font-semibold text-white ring-1 ring-white/12 transition hover:bg-white/15 active:scale-95"
        >
          {t('ludo.newGame')}
        </button>
      </div>

      {winner != null && (
        <GameResultScreen
          gameId="ludo"
          emoji={winner === HUMAN ? '🏆' : '🎲'}
          title={winner === HUMAN ? t('ludo.youWin') : t('ludo.youLose')}
          celebrate={winner === HUMAN}
          levelUp={levelUp}
          actions={[
            { label: t('ludo.share'), onClick: onShare, variant: 'primary' },
            { label: t('ludo.again'), onClick: newGame, variant: 'secondary' },
          ]}
          shareMsg={shareMsg}
        >
          <p className="mt-2 text-sm text-white/70">
            {winner === HUMAN
              ? t('ludo.youWinSub')
              : t('ludo.winnerIs', { color: t(`ludo.colors.${winner}`) })}
          </p>
        </GameResultScreen>
      )}
    </div>
  );
}

// A pip die face (1..6) with a little wobble while rolling.
function Die({ value, rolling, color }: { value: number; rolling: boolean; color: string }) {
  const pips: Record<number, [number, number][]> = {
    1: [[1, 1]],
    2: [[0, 0], [2, 2]],
    3: [[0, 0], [1, 1], [2, 2]],
    4: [[0, 0], [2, 0], [0, 2], [2, 2]],
    5: [[0, 0], [2, 0], [1, 1], [0, 2], [2, 2]],
    6: [[0, 0], [2, 0], [0, 1], [2, 1], [0, 2], [2, 2]],
  };
  return (
    <div
      className={`grid h-12 w-12 place-items-center rounded-xl bg-white shadow-elevated ${rolling ? 'animate-[wiggle_0.2s_ease-in-out_infinite]' : ''}`}
      style={{ boxShadow: `0 0 0 2px ${color}66, 0 8px 20px rgba(0,0,0,0.4)` }}
      aria-label={`die ${value}`}
    >
      <div className="grid h-8 w-8 grid-cols-3 grid-rows-3 gap-0.5">
        {Array.from({ length: 9 }).map((_, i) => {
          const col = i % 3;
          const row = Math.floor(i / 3);
          const on = (pips[value] ?? []).some(([px, py]) => px === col && py === row);
          return <span key={i} className={`m-auto h-2 w-2 rounded-full ${on ? 'bg-slate-900' : 'bg-transparent'}`} />;
        })}
      </div>
    </div>
  );
}
