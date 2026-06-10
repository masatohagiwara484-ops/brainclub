import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import {
  initialState,
  legalMoves,
  makeMove,
  replay,
  status as gameStatus,
  inCheck,
  kingSq,
  chooseMove,
  WQ, WR, WB, WN,
  type State,
  type Move,
} from './chessEngine';
import { haptics } from '../../lib/haptics';
import { difficultyKey, DIFFICULTY_STYLE } from '../../lib/difficulty';
import { recordPlay, difficultyQuality, XP_WEIGHT } from '../../lib/synapse';
import { useGameSkin } from '../../lib/gameSkins';
import { getGame } from '../registry';
import GameResultScreen from '../../components/GameResultScreen';
import SkinPicker from '../../components/SkinPicker';
import { Icon } from '../../components/Icons';
import type { GameProps } from '../types';

const AXES = getGame('chess')?.axes ?? {};

// Filled glyphs for both sides; color comes from the active skin.
const GLYPH: Record<number, string> = { 1: '♟', 2: '♞', 3: '♝', 4: '♜', 5: '♛', 6: '♚' };

type Result = 'playing' | 'win' | 'loss' | 'draw';

export default function ChessGame({ difficulty = 'medium', online }: GameProps) {
  const { t } = useTranslation();
  const theme = useGameSkin('chess');
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  // Engine state lives in a ref (the engine mutates in place); `version` bumps
  // trigger redra't/HUD updates.
  const stateRef = useRef<State>(initialState());
  const movesRef = useRef<Move[]>([]);
  const [version, setVersion] = useState(0);
  const bump = () => setVersion((v) => v + 1);

  const [selected, setSelected] = useState<number | null>(null);
  const [promo, setPromo] = useState<{ f: number; t: number } | null>(null);
  const [result, setResult] = useState<Result>('playing');
  const [levelUp, setLevelUp] = useState<string | null>(null);
  const [shareMsg, setShareMsg] = useState<string | null>(null);
  const [showSkins, setShowSkins] = useState(false);
  const recordedRef = useRef(false);

  // Solo: human = white. Online: first mover = white.
  const myColor: 1 | -1 = online && !online.iMoveFirst ? -1 : 1;
  const s = stateRef.current;
  const legal = result === 'playing' ? legalMoves(s) : [];
  const lastMove = movesRef.current[movesRef.current.length - 1] ?? null;
  const checked = result === 'playing' && inCheck(s);

  // Map an engine terminus onto the local player's result.
  const settle = useCallback(
    (st: State) => {
      const g = gameStatus(st);
      if (g === 'playing') return false;
      if (g === 'checkmate') setResult(st.turn === myColor ? 'loss' : 'win');
      else setResult('draw');
      return true;
    },
    [myColor],
  );

  // ---- online: board derived from the authoritative move log ----------------
  useEffect(() => {
    if (!online) return;
    const ms = online.moves as Move[];
    stateRef.current = replay(ms);
    movesRef.current = ms.slice();
    setSelected(null);
    if (!settle(stateRef.current)) {
      if (online.finished && online.winnerSeat) {
        setResult(online.winnerSeat === online.mySeat ? 'win' : 'loss');
      } else {
        setResult('playing');
      }
    }
    bump();
  }, [online?.moves, online?.finished, online?.winnerSeat, settle]); // eslint-disable-line react-hooks/exhaustive-deps

  // Online: report a board-detected result once (idempotent server-side).
  const reportedRef = useRef(false);
  useEffect(() => {
    if (!online) return;
    if (result === 'playing' || result === 'draw') {
      reportedRef.current = false;
      return;
    }
    if (reportedRef.current) return;
    reportedRef.current = true;
    online.reportResult(result === 'win');
  }, [result, online]);

  // Synapse log (solo only; online ranks via Elo).
  useEffect(() => {
    if (online) return;
    if (result === 'playing') {
      recordedRef.current = false;
      return;
    }
    if (recordedRef.current) return;
    recordedRef.current = true;
    const quality = result === 'win' ? difficultyQuality(difficulty, 0.85) : result === 'draw' ? difficultyQuality(difficulty, 0.4) : 0.15;
    const res = recordPlay({ gameId: 'chess', axes: AXES, quality, weight: XP_WEIGHT[difficulty] });
    setLevelUp(result === 'win' && res.leveledUp ? t('synapse.levelUp', { n: res.newLevel }) : null);
  }, [result, difficulty, online, t]);

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

    const size = Math.min(w, h) - 16;
    const cell = size / 8;
    const ox = (w - size) / 2;
    const oy = (h - size) / 2;
    const flip = myColor === -1; // black at the bottom for the black player

    // frame
    ctx.fillStyle = theme.frame;
    ctx.beginPath();
    ctx.roundRect(ox - 8, oy - 8, size + 16, size + 16, 12);
    ctx.fill();

    const sqAt = (r: number, c: number) => (flip ? (7 - r) * 8 + (7 - c) : r * 8 + c);

    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const sq = sqAt(r, c);
        const x = ox + c * cell;
        const y = oy + r * cell;
        ctx.fillStyle = (r + c) % 2 === 0 ? theme.boardA : theme.boardB;
        ctx.fillRect(x, y, cell, cell);
        // last-move + selection + check tints
        if (lastMove && (sq === lastMove.f || sq === lastMove.t)) {
          ctx.fillStyle = `${theme.glow}3d`;
          ctx.fillRect(x, y, cell, cell);
        }
        if (selected === sq) {
          ctx.fillStyle = `${theme.glow}66`;
          ctx.fillRect(x, y, cell, cell);
        }
        if (checked && sq === kingSq(s.board, s.turn)) {
          ctx.fillStyle = 'rgba(239,68,68,0.45)';
          ctx.fillRect(x, y, cell, cell);
        }
      }
    }

    // legal-move dots for the selected piece
    if (selected != null) {
      for (const m of legal) {
        if (m.f !== selected) continue;
        const r = flip ? 7 - (m.t >> 3) : m.t >> 3;
        const c = flip ? 7 - (m.t & 7) : m.t & 7;
        const x = ox + c * cell + cell / 2;
        const y = oy + r * cell + cell / 2;
        ctx.fillStyle = `${theme.glow}aa`;
        ctx.beginPath();
        if (s.board[m.t]) {
          ctx.lineWidth = 3;
          ctx.strokeStyle = `${theme.glow}cc`;
          ctx.arc(x, y, cell * 0.42, 0, Math.PI * 2);
          ctx.stroke();
        } else {
          ctx.arc(x, y, cell * 0.14, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }

    // pieces
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `${cell * 0.78}px serif`;
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const sq = sqAt(r, c);
        const v = s.board[sq];
        if (!v) continue;
        const x = ox + c * cell + cell / 2;
        const y = oy + r * cell + cell / 2 + cell * 0.04;
        const [hi, main] = v > 0 ? theme.light : theme.dark;
        ctx.fillStyle = main;
        ctx.strokeStyle = v > 0 ? 'rgba(0,0,0,0.55)' : hi;
        ctx.lineWidth = Math.max(1, cell * 0.03);
        ctx.strokeText(GLYPH[Math.abs(v)], x, y);
        ctx.fillText(GLYPH[Math.abs(v)], x, y);
      }
    }
  }, [s, theme, selected, legal, lastMove, checked, myColor, version]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    draw();
  }, [draw]);
  useEffect(() => {
    const ro = new ResizeObserver(() => draw());
    if (wrapRef.current) ro.observe(wrapRef.current);
    return () => ro.disconnect();
  }, [draw]);

  // ---- moves --------------------------------------------------------------------
  const play = useCallback(
    (m: Move) => {
      if (online) {
        online.sendMove(m);
        return;
      }
      makeMove(stateRef.current, m);
      movesRef.current.push(m);
      haptics.tick();
      setSelected(null);
      settle(stateRef.current);
      bump();
    },
    [online, settle],
  );

  const onClick = (ev: React.MouseEvent<HTMLCanvasElement>) => {
    if (result !== 'playing' || s.turn !== myColor || promo) return;
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const size = Math.min(rect.width, rect.height) - 16;
    const cell = size / 8;
    const ox = (rect.width - size) / 2;
    const oy = (rect.height - size) / 2;
    let c = Math.floor((ev.clientX - rect.left - ox) / cell);
    let r = Math.floor((ev.clientY - rect.top - oy) / cell);
    if (r < 0 || r > 7 || c < 0 || c > 7) return;
    if (myColor === -1) {
      r = 7 - r;
      c = 7 - c;
    }
    const sq = r * 8 + c;
    const mine = s.board[sq] && Math.sign(s.board[sq]) === myColor;
    if (selected == null || mine) {
      setSelected(mine ? sq : null);
      return;
    }
    const candidates = legal.filter((m) => m.f === selected && m.t === sq);
    if (candidates.length === 0) {
      setSelected(null);
      return;
    }
    if (candidates.length > 1) {
      setPromo({ f: selected, t: sq }); // promotion: ask which piece
      return;
    }
    play(candidates[0]);
  };

  // AI responds whenever it is its turn (solo only).
  useEffect(() => {
    if (online || result !== 'playing' || s.turn === myColor) return;
    const id = setTimeout(() => {
      const m = chooseMove(stateRef.current, difficulty);
      if (m) play(m);
    }, 360);
    return () => clearTimeout(id);
  }, [version, result, difficulty, online, myColor, play, s.turn]);

  const newGame = () => {
    stateRef.current = initialState();
    movesRef.current = [];
    setSelected(null);
    setPromo(null);
    setResult('playing');
    setLevelUp(null);
    bump();
  };

  // Undo one full round (AI reply + my move). Solo only.
  const undo = () => {
    if (online || result !== 'playing' || s.turn !== myColor) return;
    const keep = movesRef.current.slice(0, Math.max(0, movesRef.current.length - 2));
    stateRef.current = replay(keep);
    movesRef.current = keep;
    setSelected(null);
    bump();
  };

  const onShare = async () => {
    const headline = result === 'win' ? t('chess.youWin') : result === 'loss' ? t('chess.youLose') : t('chess.draw');
    const text = `BrainClub · ${t('games.chess.name')}\n${result === 'win' ? '🏆' : result === 'draw' ? '🤝' : online ? '😞' : '🤖'} ${headline}\n${window.location.origin}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: 'BrainClub', text });
        setShareMsg(t('share.shared'));
      } else {
        await navigator.clipboard.writeText(text);
        setShareMsg(t('share.copied'));
      }
    } catch {
      setShareMsg(t('share.failed'));
    }
    setTimeout(() => setShareMsg(null), 2500);
  };

  const myTurn = s.turn === myColor;
  const turnLabel =
    result !== 'playing' ? '' : myTurn ? t('chess.yourTurn') : online ? t('online.opponentTurn') : t('chess.aiTurn');

  return (
    <div className="relative h-full w-full bg-[radial-gradient(120%_90%_at_50%_0%,#161b36_0%,#0e1226_60%,#05060d_100%)]">
      <div ref={wrapRef} className="absolute inset-0 px-2 pb-20 pt-20">
        <canvas ref={canvasRef} onClick={onClick} className="block h-full w-full touch-none" />
      </div>

      {/* HUD */}
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
          {result === 'playing' ? (
            <span>
              <span className={myTurn ? 'text-white' : 'text-white/40'}>{myColor === 1 ? '♔' : '♚'} {t('chess.you')}</span>
              <span className="mx-2 text-white/30">·</span>
              <span className={!myTurn ? 'text-white' : 'text-white/40'}>
                {myColor === 1 ? '♚' : '♔'} {online ? online.opponentName : t('chess.ai')}
              </span>
              <span className="ml-3 text-accent-cyan">{turnLabel}</span>
              {checked && <span className="ml-2 font-bold text-rose-400">{t('chess.check')}</span>}
            </span>
          ) : (
            <span>{t('chess.gameOver')}</span>
          )}
        </div>
      </div>

      {/* Controls */}
      <div className="absolute bottom-4 left-1/2 flex w-full max-w-md -translate-x-1/2 flex-col items-center gap-2 px-3">
        {showSkins && <SkinPicker gameId="chess" className="w-full" />}
        <div className="flex flex-wrap justify-center gap-2">
          {online ? (
            result === 'playing' && <Btn onClick={() => online.resign()}>{t('online.resign')}</Btn>
          ) : (
            <>
              <Btn onClick={newGame}>{t('chess.newGame')}</Btn>
              <Btn onClick={undo}>{t('chess.undo')}</Btn>
            </>
          )}
          <Btn onClick={() => setShowSkins((v) => !v)} ariaLabel={t('skins.title')}>
            <Icon name="sparkles" className="h-4 w-4" />
          </Btn>
        </div>
      </div>

      {/* Promotion chooser */}
      {promo && (
        <div className="absolute inset-0 z-30 grid place-items-center bg-space-0/60 backdrop-blur-sm">
          <div className="glass-panel flex gap-2 rounded-panel p-3">
            {[WQ, WR, WB, WN].map((p) => (
              <button
                key={p}
                onClick={() => {
                  const m = { ...promo, p };
                  setPromo(null);
                  play(m);
                }}
                className="grid h-14 w-14 place-items-center rounded-xl bg-white/10 text-3xl text-white ring-1 ring-white/15 transition hover:bg-white/20"
              >
                {GLYPH[p]}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Result */}
      {result !== 'playing' && (
        <GameResultScreen
          gameId="chess"
          emoji={result === 'win' ? '🏆' : result === 'draw' ? '🤝' : online ? '😞' : '🤖'}
          title={result === 'win' ? t('chess.youWin') : result === 'draw' ? t('chess.draw') : t('chess.youLose')}
          celebrate={result === 'win'}
          levelUp={levelUp}
          actions={
            online
              ? [
                  { label: t('chess.share'), onClick: onShare, variant: 'primary' },
                  { label: t('online.newOpponent'), onClick: online.leave, variant: 'secondary' },
                ]
              : [
                  { label: t('chess.share'), onClick: onShare, variant: 'primary' },
                  { label: t('chess.again'), onClick: newGame, variant: 'secondary' },
                ]
          }
          shareMsg={shareMsg}
        />
      )}
    </div>
  );
}

function Btn({ children, onClick, ariaLabel }: { children: ReactNode; onClick: () => void; ariaLabel?: string }) {
  return (
    <button
      onClick={onClick}
      aria-label={ariaLabel}
      className="min-h-[44px] rounded-xl bg-white/[0.08] px-4 py-2 text-sm font-semibold text-white shadow-sm ring-1 ring-white/12 backdrop-blur transition hover:bg-white/15 active:scale-95"
    >
      {children}
    </button>
  );
}
