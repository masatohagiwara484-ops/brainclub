// Wordle-style sharing: a spoiler-free result that proves *how well* you did
// without revealing the solution. One tap to copy / native-share.

export type ShareResult = {
  title: string; // e.g. "BrainClub Cube 3×3"
  seconds: number;
  moves: number;
  /** Optional abstract visual (emoji grid) that conveys performance, no spoilers. */
  grid?: string;
  url?: string;
};

function fmtTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

/** Build the shareable text block. */
export function buildShareText(r: ShareResult): string {
  const lines = [
    `${r.title} — ⏱ ${fmtTime(r.seconds)} · ${r.moves} moves`,
  ];
  if (r.grid) lines.push('', r.grid);
  lines.push('', r.url ?? 'Play free at BrainClub');
  return lines.join('\n');
}

/** Share via the Web Share API, falling back to clipboard. Returns how it was shared. */
export async function share(r: ShareResult): Promise<'shared' | 'copied' | 'failed'> {
  const text = buildShareText(r);
  try {
    if (navigator.share) {
      await navigator.share({ title: r.title, text });
      return 'shared';
    }
  } catch {
    /* user cancelled or unsupported — fall through to clipboard */
  }
  try {
    await navigator.clipboard.writeText(text);
    return 'copied';
  } catch {
    return 'failed';
  }
}
