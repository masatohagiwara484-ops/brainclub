// Verifies the chess move generator (mirrors src/games/chess/chessEngine.ts)
// against known perft node counts — these positions exercise castling, en
// passant, promotions, pins and checks exhaustively. Also asserts mate /
// stalemate detection. Run: node scripts/verify-chess.mjs
const EMPTY = 0, WP = 1, WN = 2, WB = 3, WR = 4, WQ = 5, WK = 6;
const PIECE_OF = { p: 1, n: 2, b: 3, r: 4, q: 5, k: 6 };

function fromFen(fen) {
  const [pieces, turn, castle, ep, half] = fen.split(' ');
  const board = new Int8Array(64);
  let sq = 0;
  for (const ch of pieces) {
    if (ch === '/') continue;
    if (ch >= '1' && ch <= '8') sq += Number(ch);
    else { const v = PIECE_OF[ch.toLowerCase()]; board[sq++] = ch === ch.toLowerCase() ? -v : v; }
  }
  return {
    board, turn: turn === 'w' ? 1 : -1,
    castle: { wk: castle.includes('K'), wq: castle.includes('Q'), bk: castle.includes('k'), bq: castle.includes('q') },
    ep: ep && ep !== '-' ? (8 - Number(ep[1])) * 8 + (ep.charCodeAt(0) - 97) : -1,
    half: Number(half ?? 0) || 0,
  };
}

const ROW = (sq) => sq >> 3, COL = (sq) => sq & 7, ON = (r, c) => r >= 0 && r < 8 && c >= 0 && c < 8;
const KNIGHT_D = [[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]];
const KING_D = [[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]];
const BISHOP_D = [[-1,-1],[-1,1],[1,-1],[1,1]], ROOK_D = [[-1,0],[1,0],[0,-1],[0,1]];

function attacked(board, sq, by) {
  const r = ROW(sq), c = COL(sq), pr = r + by;
  for (const dc of [-1, 1]) if (ON(pr, c + dc) && board[pr * 8 + c + dc] === WP * by) return true;
  for (const [dr, dc] of KNIGHT_D) if (ON(r+dr, c+dc) && board[(r+dr)*8+c+dc] === WN * by) return true;
  for (const [dr, dc] of KING_D) if (ON(r+dr, c+dc) && board[(r+dr)*8+c+dc] === WK * by) return true;
  for (const [dr, dc] of BISHOP_D) { let rr=r+dr, cc=c+dc; while (ON(rr,cc)) { const v=board[rr*8+cc]; if (v) { if (v===WB*by||v===WQ*by) return true; break; } rr+=dr; cc+=dc; } }
  for (const [dr, dc] of ROOK_D) { let rr=r+dr, cc=c+dc; while (ON(rr,cc)) { const v=board[rr*8+cc]; if (v) { if (v===WR*by||v===WQ*by) return true; break; } rr+=dr; cc+=dc; } }
  return false;
}
function kingSq(board, color) { const k = WK * color; for (let i = 0; i < 64; i++) if (board[i] === k) return i; return -1; }

function pseudoMoves(s) {
  const out = [], { board, turn } = s;
  const push = (f, t) => out.push({ f, t });
  for (let f = 0; f < 64; f++) {
    const v = board[f];
    if (!v || Math.sign(v) !== turn) continue;
    const r = ROW(f), c = COL(f), kind = Math.abs(v);
    if (kind === WP) {
      const dir = -turn, one = (r + dir) * 8 + c, promo = r + dir === (turn === 1 ? 0 : 7);
      if (ON(r + dir, c) && !board[one]) {
        if (promo) for (const p of [WQ, WR, WB, WN]) out.push({ f, t: one, p });
        else push(f, one);
        const startRow = turn === 1 ? 6 : 1, two = (r + 2 * dir) * 8 + c;
        if (r === startRow && !board[two]) push(f, two);
      }
      for (const dc of [-1, 1]) {
        const rr = r + dir, cc = c + dc;
        if (!ON(rr, cc)) continue;
        const t = rr * 8 + cc;
        if (board[t] && Math.sign(board[t]) === -turn) {
          if (promo) for (const p of [WQ, WR, WB, WN]) out.push({ f, t, p });
          else push(f, t);
        } else if (t === s.ep) push(f, t);
      }
    } else if (kind === WN || kind === WK) {
      for (const [dr, dc] of kind === WN ? KNIGHT_D : KING_D) {
        const rr = r + dr, cc = c + dc;
        if (!ON(rr, cc)) continue;
        const t = rr * 8 + cc;
        if (!board[t] || Math.sign(board[t]) === -turn) push(f, t);
      }
      if (kind === WK) {
        const home = turn === 1 ? 56 : 0;
        const canK = turn === 1 ? s.castle.wk : s.castle.bk, canQ = turn === 1 ? s.castle.wq : s.castle.bq;
        if (f === home + 4 && !attacked(board, f, -turn)) {
          if (canK && !board[home+5] && !board[home+6] && !attacked(board, home+5, -turn) && !attacked(board, home+6, -turn)) push(f, home + 6);
          if (canQ && !board[home+3] && !board[home+2] && !board[home+1] && !attacked(board, home+3, -turn) && !attacked(board, home+2, -turn)) push(f, home + 2);
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

function makeMove(s, m) {
  const { board } = s, piece = board[m.f], kind = Math.abs(piece);
  const u = { captured: board[m.t], capSq: m.t, castle: { ...s.castle }, ep: s.ep, half: s.half, was: piece };
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
    if (m.t - m.f === 2) { board[m.f + 1] = board[m.t + 1]; board[m.t + 1] = EMPTY; }
    if (m.f - m.t === 2) { board[m.f - 1] = board[m.t - 2]; board[m.t - 2] = EMPTY; }
  }
  for (const [sq, key] of [[56, 'wq'], [63, 'wk'], [0, 'bq'], [7, 'bk']]) {
    if (m.f === sq || m.t === sq || u.capSq === sq) s.castle[key] = false;
  }
  s.turn = -s.turn;
  return u;
}
function unmake(s, m, u) {
  const { board } = s;
  s.turn = -s.turn; s.castle = u.castle; s.ep = u.ep; s.half = u.half;
  board[m.f] = u.was; board[m.t] = EMPTY;
  if (u.capSq !== m.t) board[u.capSq] = u.captured; else board[m.t] = u.captured;
  if (Math.abs(u.was) === WK) {
    if (m.t - m.f === 2) { board[m.t + 1] = board[m.f + 1]; board[m.f + 1] = EMPTY; }
    if (m.f - m.t === 2) { board[m.t - 2] = board[m.f - 1]; board[m.f - 1] = EMPTY; }
  }
}
function legalMoves(s) {
  const out = [];
  for (const m of pseudoMoves(s)) {
    const u = makeMove(s, m);
    if (!attacked(s.board, kingSq(s.board, -s.turn), s.turn)) out.push(m);
    unmake(s, m, u);
  }
  return out;
}
const inCheck = (s) => attacked(s.board, kingSq(s.board, s.turn), -s.turn);
function perft(s, depth) {
  if (depth === 0) return 1;
  let n = 0;
  for (const m of pseudoMoves(s)) {
    const u = makeMove(s, m);
    if (!attacked(s.board, kingSq(s.board, -s.turn), s.turn)) n += perft(s, depth - 1);
    unmake(s, m, u);
  }
  return n;
}

let failures = 0;
const fail = (m) => (console.error('  ✗ ' + m), failures++);

// Known perft counts (start, Kiwipete, EP-heavy Pos3, promo-heavy Pos4).
const CASES = [
  ['rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1', [20, 400, 8902], 'start position'],
  ['r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1', [48, 2039], 'Kiwipete (castling/EP/pins)'],
  ['8/2p5/3p4/KP5r/1R3p1k/8/4P1P1/8 w - - 0 1', [14, 191, 2812], 'position 3 (en passant)'],
  ['r3k2r/Pppp1ppp/1b3nbN/nP6/BBP1P3/q4N2/Pp1P2PP/R2Q1RK1 w kq - 0 1', [6, 264, 9467], 'position 4 (promotions)'],
];
for (const [fen, counts, label] of CASES) {
  let ok = true;
  for (let d = 1; d <= counts.length; d++) {
    const got = perft(fromFen(fen), d);
    if (got !== counts[d - 1]) { ok = false; fail(`${label} perft(${d}) = ${got}, expected ${counts[d - 1]}`); }
  }
  if (ok) console.log(`  ✓ ${label}: perft ${counts.join(' / ')}`);
}

// Fool's mate → checkmate for white-to-move? (white is mated)
{
  const s = fromFen('rnb1kbnr/pppp1ppp/8/4p3/6Pq/5P2/PPPPP2P/RNBQKBNR w KQkq - 1 3');
  if (legalMoves(s).length !== 0 || !inCheck(s)) fail("fool's mate not detected as checkmate");
  else console.log("  ✓ fool's mate detected (no legal moves, in check)");
}
// Classic stalemate: black to move, not in check, no moves.
{
  const s = fromFen('7k/5Q2/6K1/8/8/8/8/8 b - - 0 1');
  if (legalMoves(s).length !== 0 || inCheck(s)) fail('stalemate position not detected');
  else console.log('  ✓ stalemate detected (no legal moves, not in check)');
}
// Castling produces both O-O and O-O-O when fully available.
{
  const s = fromFen('r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1');
  const moves = legalMoves(s).filter((m) => m.f === 60 && Math.abs(m.t - m.f) === 2);
  if (moves.length !== 2) fail(`expected 2 castling moves, got ${moves.length}`);
  else console.log('  ✓ both castling moves generated when rights + path allow');
}

if (failures) { console.error(`\nFAIL: ${failures} check(s).`); process.exit(1); }
console.log('\nPASS: chess move generation verified.');
