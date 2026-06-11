// Original vector chess art — hand-drawn Path2D piece silhouettes (a modern
// geometric set designed for this app, not a font glyph) plus per-theme board
// decor painters (cyberpunk neon circuits, matrix code rain, baroque gold
// inlay…). Pure canvas: no assets, crisp at any DPI, recolors from the active
// BoardTheme. A future Blender pipeline can swap these for 3D renders
// (docs/BLENDER_MCP.md) without touching the game logic.

import type { BoardTheme } from '../../lib/gameSkins';

type Ctx = CanvasRenderingContext2D;

// ---- piece silhouettes ---------------------------------------------------------
// Each painter draws inside a normalized 100×100 box (0,0 top-left). The caller
// scales/translates. Shapes share a common plinth so the set reads as one family.

function plinth(p: Path2D): void {
  // two-step base shared by every piece
  p.moveTo(22, 92);
  p.lineTo(78, 92);
  p.lineTo(74, 82);
  p.lineTo(26, 82);
  p.closePath();
  p.moveTo(30, 80);
  p.lineTo(70, 80);
  p.lineTo(66, 72);
  p.lineTo(34, 72);
  p.closePath();
}

function pawnPath(): Path2D {
  const p = new Path2D();
  p.arc(50, 34, 13, 0, Math.PI * 2); // head
  p.moveTo(38, 70);
  p.bezierCurveTo(40, 52, 46, 50, 46, 46);
  p.lineTo(54, 46);
  p.bezierCurveTo(54, 50, 60, 52, 62, 70);
  p.closePath();
  plinth(p);
  return p;
}

function rookPath(): Path2D {
  const p = new Path2D();
  // crenellated crown
  p.moveTo(30, 18);
  p.lineTo(40, 18); p.lineTo(40, 26); p.lineTo(46, 26); p.lineTo(46, 18);
  p.lineTo(54, 18); p.lineTo(54, 26); p.lineTo(60, 26); p.lineTo(60, 18);
  p.lineTo(70, 18); p.lineTo(70, 34); p.lineTo(64, 38);
  // tapered tower
  p.lineTo(62, 70); p.lineTo(38, 70); p.lineTo(36, 38); p.lineTo(30, 34);
  p.closePath();
  plinth(p);
  return p;
}

function knightPath(): Path2D {
  const p = new Path2D();
  // angular horse head, facing left
  p.moveTo(36, 70);
  p.lineTo(40, 48);
  p.lineTo(30, 44);
  p.lineTo(28, 36);
  p.lineTo(40, 20);          // muzzle up
  p.lineTo(46, 14);          // ear notch
  p.lineTo(50, 20);
  p.lineTo(58, 16);          // second ear
  p.lineTo(60, 24);
  p.bezierCurveTo(70, 32, 72, 48, 66, 70); // mane/back curve
  p.closePath();
  // eye (cut as separate subpath ring so it shows in stroke)
  p.moveTo(47, 30);
  p.arc(45, 30, 2.2, 0, Math.PI * 2);
  plinth(p);
  return p;
}

function bishopPath(): Path2D {
  const p = new Path2D();
  p.arc(50, 16, 5, 0, Math.PI * 2); // finial orb
  // mitre with diagonal slit
  p.moveTo(50, 22);
  p.bezierCurveTo(64, 32, 66, 44, 58, 52);
  p.lineTo(62, 58); p.lineTo(38, 58); p.lineTo(42, 52);
  p.bezierCurveTo(34, 44, 36, 32, 50, 22);
  p.closePath();
  p.moveTo(40, 70); p.lineTo(44, 60) ; p.lineTo(56, 60); p.lineTo(60, 70);
  p.closePath();
  plinth(p);
  return p;
}

function queenPath(): Path2D {
  const p = new Path2D();
  // five-point crown with orbs
  for (const [cx, cy] of [[28, 18], [39, 12], [50, 10], [61, 12], [72, 18]] as const) {
    p.moveTo(cx + 3, cy);
    p.arc(cx, cy, 3, 0, Math.PI * 2);
  }
  p.moveTo(28, 22);
  p.lineTo(39, 16); p.lineTo(50, 14); p.lineTo(61, 16); p.lineTo(72, 22);
  p.lineTo(64, 46); p.lineTo(36, 46);
  p.closePath();
  p.moveTo(36, 48); p.lineTo(64, 48); p.lineTo(60, 70); p.lineTo(40, 70);
  p.closePath();
  plinth(p);
  return p;
}

function kingPath(): Path2D {
  const p = new Path2D();
  // cross
  p.moveTo(47, 6); p.lineTo(53, 6); p.lineTo(53, 12); p.lineTo(59, 12);
  p.lineTo(59, 18); p.lineTo(53, 18); p.lineTo(53, 24); p.lineTo(47, 24);
  p.lineTo(47, 18); p.lineTo(41, 18); p.lineTo(41, 12); p.lineTo(47, 12);
  p.closePath();
  // arched crown body
  p.moveTo(32, 30);
  p.bezierCurveTo(40, 24, 60, 24, 68, 30);
  p.lineTo(62, 48); p.lineTo(38, 48);
  p.closePath();
  p.moveTo(38, 50); p.lineTo(62, 50); p.lineTo(58, 70); p.lineTo(42, 70);
  p.closePath();
  plinth(p);
  return p;
}

// kind: 1=P 2=N 3=B 4=R 5=Q 6=K (matches chessEngine piece codes)
const PIECE_PATHS: Record<number, Path2D> = {
  1: pawnPath(),
  2: knightPath(),
  3: bishopPath(),
  4: rookPath(),
  5: queenPath(),
  6: kingPath(),
};

/**
 * Draw one piece centered in a cell. `light` = the white side. Fill + contrast
 * outline + a soft theme glow keep both sides readable on every board color.
 */
export function drawPiece(
  ctx: Ctx,
  kind: number,
  light: boolean,
  cx: number,
  cy: number,
  cell: number,
  theme: BoardTheme,
): void {
  const path = PIECE_PATHS[kind];
  if (!path) return;
  const s = (cell * 0.82) / 100;
  ctx.save();
  ctx.translate(cx - 50 * s, cy - 52 * s);
  ctx.scale(s, s);
  const [hi, main] = light ? theme.light : theme.dark;
  // soft drop shadow grounds the piece
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.save();
  ctx.translate(2.5, 3.5);
  ctx.fill(path);
  ctx.restore();
  // body: vertical gradient hi→main
  const grad = ctx.createLinearGradient(0, 6, 0, 94);
  grad.addColorStop(0, hi);
  grad.addColorStop(1, main);
  ctx.fillStyle = grad;
  ctx.fill(path);
  // contrast outline (dark for light pieces, light for dark pieces)
  ctx.lineWidth = 3;
  ctx.lineJoin = 'round';
  ctx.strokeStyle = light ? 'rgba(10,12,24,0.65)' : hi;
  ctx.stroke(path);
  ctx.restore();
}

// ---- board decor ---------------------------------------------------------------
// Painted AFTER the checker squares, BEFORE highlights/pieces. Deterministic
// (seeded by cell position) so it never flickers between frames.

export function paintBoardDecor(ctx: Ctx, themeId: string, ox: number, oy: number, size: number): void {
  ctx.save();
  ctx.beginPath();
  ctx.rect(ox, oy, size, size);
  ctx.clip();
  switch (themeId) {
    case 'cyberpunk': {
      // scanlines
      ctx.fillStyle = 'rgba(34,211,238,0.05)';
      for (let y = oy; y < oy + size; y += 6) ctx.fillRect(ox, y, size, 2);
      // corner circuit traces
      ctx.strokeStyle = 'rgba(34,211,238,0.55)';
      ctx.lineWidth = 1.5;
      const t = size * 0.16;
      for (const [sx, sy, dx, dy] of [
        [ox + 4, oy + t, 1, -1], [ox + size - 4, oy + t, -1, -1],
        [ox + 4, oy + size - t, 1, 1], [ox + size - 4, oy + size - t, -1, 1],
      ] as const) {
        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.lineTo(sx + dx * t * 0.5, sy);
        ctx.lineTo(sx + dx * t * 0.5, sy + dy * t * 0.6);
        ctx.lineTo(sx + dx * t, sy + dy * t * 0.6);
        ctx.stroke();
        ctx.fillStyle = 'rgba(232,121,249,0.9)';
        ctx.beginPath();
        ctx.arc(sx + dx * t, sy + dy * t * 0.6, 2.2, 0, Math.PI * 2);
        ctx.fill();
      }
      break;
    }
    case 'matrix': {
      // faint code rain columns (deterministic glyph pattern)
      ctx.font = `${Math.max(8, size * 0.030)}px monospace`;
      ctx.fillStyle = 'rgba(74,222,128,0.18)';
      for (let c = 0; c < 12; c++) {
        const x = ox + (c + 0.5) * (size / 12);
        for (let r = 0; r < 14; r++) {
          if ((c * 7 + r * 13) % 5 > 2) continue;
          ctx.fillText(String((c * 31 + r * 17) % 10), x, oy + (r + 1) * (size / 15));
        }
      }
      break;
    }
    case 'baroque': {
      // double gold inlay + corner flourish arcs
      ctx.strokeStyle = 'rgba(245,197,66,0.65)';
      ctx.lineWidth = 2;
      ctx.strokeRect(ox + 5, oy + 5, size - 10, size - 10);
      ctx.lineWidth = 1;
      ctx.strokeRect(ox + 10, oy + 10, size - 20, size - 20);
      const r = size * 0.07;
      for (const [cx, cy, a0] of [
        [ox + 12, oy + 12, 0], [ox + size - 12, oy + 12, Math.PI / 2],
        [ox + size - 12, oy + size - 12, Math.PI], [ox + 12, oy + size - 12, -Math.PI / 2],
      ] as const) {
        ctx.beginPath();
        ctx.arc(cx, cy, r, a0, a0 + Math.PI / 2);
        ctx.stroke();
      }
      break;
    }
    case 'dragon': {
      // drifting embers + warm bottom glow
      const glow = ctx.createLinearGradient(0, oy + size * 0.6, 0, oy + size);
      glow.addColorStop(0, 'rgba(245,158,11,0)');
      glow.addColorStop(1, 'rgba(220,38,38,0.18)');
      ctx.fillStyle = glow;
      ctx.fillRect(ox, oy + size * 0.6, size, size * 0.4);
      ctx.fillStyle = 'rgba(251,191,36,0.5)';
      for (let i = 0; i < 18; i++) {
        const x = ox + ((i * 137) % 100) / 100 * size;
        const y = oy + ((i * 89 + 40) % 100) / 100 * size;
        ctx.fillRect(x, y, 2, 2);
      }
      break;
    }
    case 'crystal': {
      // diagonal facet streaks
      ctx.strokeStyle = 'rgba(255,255,255,0.16)';
      ctx.lineWidth = size * 0.02;
      for (const f of [0.2, 0.45, 0.75]) {
        ctx.beginPath();
        ctx.moveTo(ox + size * f - size * 0.3, oy + size);
        ctx.lineTo(ox + size * f + size * 0.3, oy);
        ctx.stroke();
      }
      break;
    }
    case 'fire': {
      const glow = ctx.createLinearGradient(0, oy + size * 0.55, 0, oy + size);
      glow.addColorStop(0, 'rgba(251,146,60,0)');
      glow.addColorStop(1, 'rgba(251,146,60,0.22)');
      ctx.fillStyle = glow;
      ctx.fillRect(ox, oy + size * 0.55, size, size * 0.45);
      break;
    }
    case 'darkneon': {
      ctx.strokeStyle = 'rgba(74,222,128,0.5)';
      ctx.lineWidth = 2;
      ctx.shadowColor = 'rgba(74,222,128,0.8)';
      ctx.shadowBlur = 8;
      ctx.strokeRect(ox + 3, oy + 3, size - 6, size - 6);
      ctx.shadowBlur = 0;
      break;
    }
    case 'diamond': {
      // sparkle crosses on light squares
      ctx.strokeStyle = 'rgba(255,255,255,0.5)';
      ctx.lineWidth = 1;
      for (let i = 0; i < 8; i++) {
        const x = ox + ((i * 113 + 31) % 100) / 100 * size;
        const y = oy + ((i * 71 + 17) % 100) / 100 * size;
        const r = 3;
        ctx.beginPath();
        ctx.moveTo(x - r, y); ctx.lineTo(x + r, y);
        ctx.moveTo(x, y - r); ctx.lineTo(x, y + r);
        ctx.stroke();
      }
      break;
    }
    case 'sakura': {
      // drifting petals (rounded quads, two pinks)
      for (let i = 0; i < 14; i++) {
        const x = ox + ((i * 97 + 13) % 100) / 100 * size;
        const y = oy + ((i * 61 + 47) % 100) / 100 * size;
        ctx.fillStyle = i % 2 ? 'rgba(249,168,212,0.35)' : 'rgba(244,114,182,0.25)';
        ctx.beginPath();
        ctx.ellipse(x, y, 4, 2.4, (i * 37) % 180 / 57.3, 0, Math.PI * 2);
        ctx.fill();
      }
      break;
    }
    case 'aurora': {
      // soft drifting light bands
      for (const [f, col] of [[0.25, 'rgba(34,211,238,0.10)'], [0.5, 'rgba(129,140,248,0.10)'], [0.75, 'rgba(232,121,249,0.10)']] as const) {
        const g = ctx.createLinearGradient(ox, oy + size * (f - 0.18), ox, oy + size * (f + 0.18));
        g.addColorStop(0, 'rgba(0,0,0,0)');
        g.addColorStop(0.5, col);
        g.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = g;
        ctx.fillRect(ox, oy + size * (f - 0.18), size, size * 0.36);
      }
      break;
    }
    case 'obsidian': {
      // glassy specular streak
      const g = ctx.createLinearGradient(ox, oy, ox + size, oy + size * 0.5);
      g.addColorStop(0, 'rgba(255,255,255,0.10)');
      g.addColorStop(0.25, 'rgba(255,255,255,0.02)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g;
      ctx.fillRect(ox, oy, size, size);
      break;
    }
  }
  ctx.restore();
}
