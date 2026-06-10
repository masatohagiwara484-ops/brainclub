// Chess — pure engine (no React/DOM). Board is a 64-cell mailbox, row 0 = 8th
// rank (black's back rank) so rendering maps directly. White pieces are
// positive, black negative: P1 N2 B3 R4 Q5 K6. Full rules: castling, en
// passant, promotion (N/B/R/Q), check/checkmate/stalemate, 50-move draw.
// AI = negamax + alpha-beta with material + piece-square evaluation; depth by
// difficulty. scripts/verify-chess.mjs re-verifies move generation against
// known perft counts — keep the two in sync.

import type { Difficulty } from '../../lib/difficulty';

export const EMPTY = 0, WP = 1, WN = 2, WB = 3, WR = 4, WQ = 5, WK = 6;
export type Board = Int8Array; // 64 cells, +white / -black

export type Move = { f: number; t: number; p?: number }; // promo piece (2..5), white-positive magnitude

export type CastleRights = { wk: boolean; wq: boolean; bk: boolean; bq: boolean };
export type State = {
  board: Board;
  turn: 1 | -1; // 1 = white
  castle: CastleRights;
  ep: number; // en-passant target square, or -1
  half: number; // halfmove clock (50-move rule)
};

const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
const PIECE_OF: Record<string, number> = { p: 1, n: 2, b: 3, r: 4, q: 5, k: 6 };

export function fromFen(fen = START_FEN): State {
  const [pieces, turn, castle, ep, half] = fen.split(' ');
  const board = new Int8Array(64) as Board;
  let sq = 0;
  for (const ch of pieces) {
    if (ch === '/') continue;
    if (ch >= '1' && ch <= '8') sq += Number(ch);
    else {
      const v = PIECE_OF[ch.toLowerCase()];
      board[sq++] = ch === ch.toLowerCase() ? -v : v;
    }
  }
  return {
    board,
    turn: turn === 'w' ? 1 : -1,
    castle: { wk: castle.includes('K'), wq: castle.includes('Q'), bk: castle.includes('k'), bq: castle.includes('q') },
    ep: ep && ep !== '-' ? (8 - Number(ep[1])) * 8 + (ep.charCodeAt(0) - 97) : -1,
    half: Number(half ?? 0) || 0,
  };
}

export const initialState = (): State => fromFen();

const ROW = (sq: number) => sq >> 3;
const COL = (sq: number) => sq & 7;
const ON = (r: number, c: number) => r >= 0 && r < 8 && c >= 0 && c < 8;

const KNIGHT_D = [[-2, -1], [-2, 1], [-1, -2], [-1, 2], [1, -2], [1, 2], [2, -1], [2, 1]];
const KING_D = [[-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1]];
const BISHOP_D = [[-1, -1], [-1, 1], [1, -1], [1, 1]];
const ROOK_D = [[-1, 0], [1, 0], [0, -1], [0, 1]];

/** Is `sq` attacked by side `by` (1 white / -1 black)? */
export function attacked(board: Board, sq: number, by: 1 | -1): boolean {
  const r = ROW(sq), c = COL(sq);
  // pawns: white attacks upward (toward row 0)
  const pr = r + by; // row a `by` pawn would attack FROM
  for (const dc of [-1, 1]) {
    if (ON(pr, c + dc) && board[pr * 8 + c + dc] === WP * by) return true;
  }
  for (const [dr, dc] of KNIGHT_D)
    if (ON(r + dr, c + dc) && board[(r + dr) * 8 + c + dc] === WN * by) return true;
  for (const [dr, dc] of KING_D)
    if (ON(r + dr, c + dc) && board[(r + dr) * 8 + c + dc] === WK * by) return true;
  for (const [dr, dc] of BISHOP_D) {
    let rr = r + dr, cc = c + dc;
    while (ON(rr, cc)) {
      const v = board[rr * 8 + cc];
      if (v) { if (v === WB * by || v === WQ * by) return true; break; }
      rr += dr; cc += dc;
    }
  }
  for (const [dr, dc] of ROOK_D) {
    let rr = r + dr, cc = c + dc;
    while (ON(rr, cc)) {
      const v = board[rr * 8 + cc];
      if (v) { if (v === WR * by || v === WQ * by) return true; break; }
      rr += dr; cc += dc;
    }
  }
  return false;
}

export function kingSq(board: Board, color: 1 | -1): number {
  const k = WK * color;
  for (let i = 0; i < 64; i++) if (board[i] === k) return i;
  return -1;
}

function pseudoMoves(s: State): Move[] {
  const out: Move[] = [];
  const { board, turn } = s;
  const push = (f: number, t: number) => out.push({ f, t });
  for (let f = 0; f < 64; f++) {
    const v = board[f];
    if (!v || Math.sign(v) !== turn) continue;
    const r = ROW(f), c = COL(f), kind = Math.abs(v);
    if (kind === WP) {
      const dir = -turn; // white moves toward row 0
      const one = (r + dir) * 8 + c;
      const promo = r + dir === (turn === 1 ? 0 : 7);
      if (ON(r + dir, c) && !board[one]) {
        if (promo) for (const p of [WQ, WR, WB, WN]) out.push({ f, t: one, p });
        else push(f, one);
        const startRow = turn === 1 ? 6 : 1;
        const two = (r + 2 * dir) * 8 + c;
        if (r === startRow && !board[two]) push(f, two);
      }
      for (const dc of [-1, 1]) {
        const rr = r + dir, cc = c + dc;
        if (!ON(rr, cc)) continue;
        const t = rr * 8 + cc;
        if (board[t] && Math.sign(board[t]) === -turn) {
          if (promo) for (const p of [WQ, WR, WB, WN]) out.push({ f, t, p });
          else push(f, t);
        } else if (t === s.ep) push(f, t); // en passant
      }
    } else if (kind === WN || kind === WK) {
      for (const [dr, dc] of kind === WN ? KNIGHT_D : KING_D) {
        const rr = r + dr, cc = c + dc;
        if (!ON(rr, cc)) continue;
        const t = rr * 8 + cc;
        if (!board[t] || Math.sign(board[t]) === -turn) push(f, t);
      }
      if (kind === WK) {
        // castling: rights + empty path + king's path not attacked
        const home = turn === 1 ? 56 : 0;
        const canK = turn === 1 ? s.castle.wk : s.castle.bk;
        const canQ = turn === 1 ? s.castle.wq : s.castle.bq;
        if (f === home + 4 && !attacked(board, f, -turn as 1 | -1)) {
          if (canK && !board[home + 5] && !board[home + 6] &&
              !attacked(board, home + 5, -turn as 1 | -1) && !attacked(board, home + 6, -turn as 1 | -1))
            push(f, home + 6);
          if (canQ && !board[home + 3] && !board[home + 2] && !board[home + 1] &&
              !attacked(board, home + 3, -turn as 1 | -1) && !attacked(board, home + 2, -turn as 1 | -1))
            push(f, home + 2);
        }
      }
    } else {
      const dirs = kind === WB ? BISHOP_D : kind === WR ? ROOK_D : [...BISHOP_D, ...ROOK_D];
      for (const [dr, dc] of dirs) {
        let rr = r + dr, cc = c + dc;
        while (ON(rr, cc)) {
          const t = rr * 8 + cc;
          if (!board[t]) push(f, t);
          else { if (Math.sign(board[t]) === -turn) push(f, t); break; }
          rr += dr; cc += dc;
        }
      }
    }
  }
  return out;
}

type Undo = { captured: number; capSq: number; castle: CastleRights; ep: number; half: number; movedFrom: number; movedTo: number; was: number };

/** Apply a move in place; returns undo info for unmake. */
export function makeMove(s: State, m: Move): Undo {
  const { board } = s;
  const piece = board[m.f];
  const kind = Math.abs(piece);
  const u: Undo = { captured: board[m.t], capSq: m.t, castle: { ...s.castle }, ep: s.ep, half: s.half, movedFrom: m.f, movedTo: m.t, was: piece };

  // en passant capture: the victim is behind the target square
  if (kind === WP && m.t === s.ep && !board[m.t]) {
    u.capSq = m.t + (s.turn === 1 ? 8 : -8);
    u.captured = board[u.capSq];
    board[u.capSq] = EMPTY;
  }

  s.half = kind === WP || u.captured ? 0 : s.half + 1;
  s.ep = kind === WP && Math.abs(m.t - m.f) === 16 ? (m.f + m.t) / 2 : -1;

  board[m.t] = m.p ? m.p * s.turn : piece;
  board[m.f] = EMPTY;

  if (kind === WK) {
    if (s.turn === 1) { s.castle.wk = s.castle.wq = false; } else { s.castle.bk = s.castle.bq = false; }
    if (m.t - m.f === 2) { board[m.f + 1] = board[m.t + 1]; board[m.t + 1] = EMPTY; } // O-O
    if (m.f - m.t === 2) { board[m.f - 1] = board[m.t - 2]; board[m.t - 2] = EMPTY; } // O-O-O
  }
  // rook moved or captured → drop the matching right
  for (const [sq, key] of [[56, 'wq'], [63, 'wk'], [0, 'bq'], [7, 'bk']] as const) {
    if (m.f === sq || m.t === sq || u.capSq === sq) s.castle[key] = false;
  }

  s.turn = -s.turn as 1 | -1;
  return u;
}

export function unmake(s: State, m: Move, u: Undo): void {
  const { board } = s;
  s.turn = -s.turn as 1 | -1;
  s.castle = u.castle;
  s.ep = u.ep;
  s.half = u.half;
  board[m.f] = u.was;
  board[m.t] = EMPTY;
  if (u.capSq !== m.t) board[u.capSq] = u.captured; // en passant victim restored behind
  else board[m.t] = u.captured;
  if (Math.abs(u.was) === WK) {
    if (m.t - m.f === 2) { board[m.t + 1] = board[m.f + 1]; board[m.f + 1] = EMPTY; }
    if (m.f - m.t === 2) { board[m.t - 2] = board[m.f - 1]; board[m.f - 1] = EMPTY; }
  }
}

export function legalMoves(s: State): Move[] {
  const out: Move[] = [];
  for (const m of pseudoMoves(s)) {
    const u = makeMove(s, m);
    if (!attacked(s.board, kingSq(s.board, -s.turn as 1 | -1), s.turn)) out.push(m);
    unmake(s, m, u);
  }
  return out;
}

export function inCheck(s: State): boolean {
  return attacked(s.board, kingSq(s.board, s.turn), -s.turn as 1 | -1);
}

export type GameStatus = 'playing' | 'checkmate' | 'stalemate' | 'draw50';
export function status(s: State): GameStatus {
  if (s.half >= 100) return 'draw50';
  if (legalMoves(s).length > 0) return 'playing';
  return inCheck(s) ? 'checkmate' : 'stalemate';
}

/** Perft node count (verification only). */
export function perft(s: State, depth: number): number {
  if (depth === 0) return 1;
  let n = 0;
  for (const m of pseudoMoves(s)) {
    const u = makeMove(s, m);
    if (!attacked(s.board, kingSq(s.board, -s.turn as 1 | -1), s.turn)) n += perft(s, depth - 1);
    unmake(s, m, u);
  }
  return n;
}

// ---- evaluation + search ------------------------------------------------------

const VAL = [0, 100, 320, 330, 500, 900, 0];
// Piece-square tables (white's view, row 0 = 8th rank). Compact midgame tables.
const PST_P = [0,0,0,0,0,0,0,0, 50,50,50,50,50,50,50,50, 10,10,20,30,30,20,10,10, 5,5,10,25,25,10,5,5, 0,0,0,20,20,0,0,0, 5,-5,-10,0,0,-10,-5,5, 5,10,10,-20,-20,10,10,5, 0,0,0,0,0,0,0,0];
const PST_N = [-50,-40,-30,-30,-30,-30,-40,-50, -40,-20,0,0,0,0,-20,-40, -30,0,10,15,15,10,0,-30, -30,5,15,20,20,15,5,-30, -30,0,15,20,20,15,0,-30, -30,5,10,15,15,10,5,-30, -40,-20,0,5,5,0,-20,-40, -50,-40,-30,-30,-30,-30,-40,-50];
const PST_B = [-20,-10,-10,-10,-10,-10,-10,-20, -10,0,0,0,0,0,0,-10, -10,0,5,10,10,5,0,-10, -10,5,5,10,10,5,5,-10, -10,0,10,10,10,10,0,-10, -10,10,10,10,10,10,10,-10, -10,5,0,0,0,0,5,-10, -20,-10,-10,-10,-10,-10,-10,-20];
const PST_R = [0,0,0,0,0,0,0,0, 5,10,10,10,10,10,10,5, -5,0,0,0,0,0,0,-5, -5,0,0,0,0,0,0,-5, -5,0,0,0,0,0,0,-5, -5,0,0,0,0,0,0,-5, -5,0,0,0,0,0,0,-5, 0,0,0,5,5,0,0,0];
const PST_Q = [-20,-10,-10,-5,-5,-10,-10,-20, -10,0,0,0,0,0,0,-10, -10,0,5,5,5,5,0,-10, -5,0,5,5,5,5,0,-5, 0,0,5,5,5,5,0,-5, -10,5,5,5,5,5,0,-10, -10,0,5,0,0,0,0,-10, -20,-10,-10,-5,-5,-10,-10,-20];
const PST_K = [-30,-40,-40,-50,-50,-40,-40,-30, -30,-40,-40,-50,-50,-40,-40,-30, -30,-40,-40,-50,-50,-40,-40,-30, -30,-40,-40,-50,-50,-40,-40,-30, -20,-30,-30,-40,-40,-30,-30,-20, -10,-20,-20,-20,-20,-20,-20,-10, 20,20,0,0,0,0,20,20, 20,30,10,0,0,10,30,20];
const PST = [null, PST_P, PST_N, PST_B, PST_R, PST_Q, PST_K] as const;
const FLIP = (sq: number) => sq ^ 56; // mirror rows for black

/** Static eval from white's perspective (centipawns). */
export function evaluate(board: Board): number {
  let e = 0;
  for (let i = 0; i < 64; i++) {
    const v = board[i];
    if (!v) continue;
    const k = Math.abs(v);
    e += v > 0 ? VAL[k] + PST[k]![i] : -(VAL[k] + PST[k]![FLIP(i)]);
  }
  return e;
}

const DEPTH: Record<Difficulty, number> = { easy: 1, medium: 2, hard: 3, expert: 4 };

function negamax(s: State, depth: number, alpha: number, beta: number): number {
  if (depth === 0) return s.turn * evaluate(s.board);
  const moves = legalMoves(s);
  if (moves.length === 0) return inCheck(s) ? -100000 - depth : 0; // mate (prefer faster) / stalemate
  if (s.half >= 100) return 0;
  // capture-first ordering for better cutoffs
  moves.sort((a, b) => Math.abs(s.board[b.t]) - Math.abs(s.board[a.t]));
  let best = -Infinity;
  for (const m of moves) {
    const u = makeMove(s, m);
    const v = -negamax(s, depth - 1, -beta, -alpha);
    unmake(s, m, u);
    if (v > best) best = v;
    if (v > alpha) alpha = v;
    if (alpha >= beta) break;
  }
  return best;
}

/** Choose the AI's move. easy adds randomness among reasonable moves. */
export function chooseMove(s: State, difficulty: Difficulty, rnd: () => number = Math.random): Move | null {
  const moves = legalMoves(s);
  if (moves.length === 0) return null;
  const depth = DEPTH[difficulty];
  moves.sort((a, b) => Math.abs(s.board[b.t]) - Math.abs(s.board[a.t]));
  let bestV = -Infinity;
  const scored: Array<{ m: Move; v: number }> = [];
  for (const m of moves) {
    const u = makeMove(s, m);
    const v = -negamax(s, depth - 1, -Infinity, Infinity);
    unmake(s, m, u);
    scored.push({ m, v });
    if (v > bestV) bestV = v;
  }
  if (difficulty === 'easy') {
    // pick among moves within 120cp of best (sloppy but not suicidal)
    const pool = scored.filter((x) => x.v >= bestV - 120);
    return pool[Math.floor(rnd() * pool.length)].m;
  }
  const best = scored.filter((x) => x.v === bestV);
  return best[Math.floor(rnd() * best.length)].m;
}

/** Replay a move list from the start (online: the moves array is authoritative). */
export function replay(moves: Move[]): State {
  const s = initialState();
  for (const m of moves) makeMove(s, m);
  return s;
}
