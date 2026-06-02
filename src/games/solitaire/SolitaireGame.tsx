import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import {
  deal,
  draw,
  move,
  autoToFoundation,
  isWon,
  canRecycle,
  isRed,
  SUIT_CHAR,
  RANK_CHAR,
  type Game,
  type Loc,
  type Card,
} from './klondike';
import { difficultyKey, DIFFICULTY_STYLE } from '../../lib/difficulty';
import type { GameProps } from '../types';
import { saveBest } from '../../lib/storage';
import { haptics } from '../../lib/haptics';

function fmt(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

const FACE_DOWN_OFFSET = 0.16; // × card height
const FACE_UP_OFFSET = 0.28;

export default function SolitaireGame({ difficulty = 'easy' }: GameProps) {
  const { t } = useTranslation();
  const wrapRef = useRef<HTMLDivElement>(null);

  const [game, setGame] = useState<Game>(() => deal(difficulty));
  const [initial, setInitial] = useState<Game>(game);
  const [selected, setSelected] = useState<Loc | null>(null);
  const [history, setHistory] = useState<Game[]>([]);
  const [moves, setMoves] = useState(0);
  const [seconds, setSeconds] = useState(0);
  const [won, setWon] = useState(false);
  const [shareMsg, setShareMsg] = useState<string | null>(null);
  const [cardW, setCardW] = useState(48);

  const newGame = useCallback(() => {
    const g = deal(difficulty);
    setGame(g);
    setInitial(g);
    setSelected(null);
    setHistory([]);
    setMoves(0);
    setSeconds(0);
    setWon(false);
  }, [difficulty]);

  useEffect(() => {
    newGame();
  }, [newGame]);

  // Responsive card sizing: 7 columns must fit the board width.
  useEffect(() => {
    const measure = () => {
      const w = wrapRef.current?.clientWidth ?? 360;
      const gap = 5;
      setCardW(Math.floor((w - gap * 6) / 7));
    };
    measure();
    const ro = new ResizeObserver(measure);
    if (wrapRef.current) ro.observe(wrapRef.current);
    return () => ro.disconnect();
  }, []);

  // Timer.
  useEffect(() => {
    if (won) return;
    const id = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [won]);

  const apply = (next: Game | null): boolean => {
    if (!next) return false;
    setHistory((h) => [...h, game]);
    setMoves((m) => m + 1);
    setSelected(null);
    setGame(next);
    haptics.tick();
    if (isWon(next)) {
      setWon(true);
      haptics.success();
      saveBest('solitaire', difficulty, { seconds, moves: moves + 1, at: Date.now() });
    }
    return true;
  };

  const undo = () => {
    if (won || history.length === 0) return;
    setHistory((h) => {
      const prev = h[h.length - 1];
      setGame(prev);
      return h.slice(0, -1);
    });
    setMoves((m) => Math.max(0, m - 1));
    setSelected(null);
  };

  const restart = () => {
    setGame(initial);
    setSelected(null);
    setHistory([]);
    setMoves(0);
    setSeconds(0);
    setWon(false);
  };

  // ---- interaction ----
  const onStock = () => {
    if (won) return;
    apply(draw(game));
  };

  const onWaste = () => {
    if (won) return;
    if (selected?.kind === 'waste') return setSelected(null);
    setSelected(game.waste.length ? { kind: 'waste' } : null);
  };

  const onFoundation = (i: number) => {
    if (won) return;
    if (selected && apply(move(game, selected, { kind: 'foundation', i }))) return;
    setSelected(game.foundations[i].length ? { kind: 'foundation', i } : null);
  };

  const onTableauCard = (col: number, idx: number) => {
    if (won) return;
    if (selected && apply(move(game, selected, { kind: 'tableau', col }))) return;
    const card = game.tableau[col][idx];
    setSelected(card.faceUp ? { kind: 'tableau', col, idx } : null);
  };

  const onTableauEmpty = (col: number) => {
    if (won) return;
    if (selected && apply(move(game, selected, { kind: 'tableau', col }))) return;
    setSelected(null);
  };

  const onShare = async () => {
    const text = `BrainClub · ${t('games.solitaire.name')} (${t(difficultyKey(difficulty))})\n🃏 ${fmt(
      seconds,
    )} · ${moves} ${t('solitaire.moves')}\n${window.location.origin}`;
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

  const cardH = Math.round(cardW * 1.4);
  const isSel = (loc: Loc): boolean => {
    if (!selected) return false;
    if (selected.kind !== loc.kind) return false;
    if (selected.kind === 'waste') return true;
    if (selected.kind === 'foundation' && loc.kind === 'foundation') return selected.i === loc.i;
    if (selected.kind === 'tableau' && loc.kind === 'tableau')
      return selected.col === loc.col && loc.idx >= selected.idx;
    return false;
  };

  return (
    <div className="flex h-full flex-col items-center overflow-hidden px-2 py-3">
      {/* Header */}
      <div className="flex w-full max-w-md items-center justify-between text-sm">
        <span
          className="font-dot rounded-lg px-2 py-1 text-xs font-bold text-white"
          style={{ backgroundColor: DIFFICULTY_STYLE[difficulty].color }}
        >
          {t(difficultyKey(difficulty))}
        </span>
        <span className="font-semibold tabular-nums text-slate-700">
          ⏱ {fmt(seconds)} · {moves} {t('solitaire.moves')}
        </span>
        <button
          onClick={newGame}
          className="rounded-xl bg-slate-100 px-3 py-1.5 font-semibold text-slate-700 shadow-sm hover:bg-slate-200 active:scale-95"
        >
          {t('solitaire.newGame')}
        </button>
      </div>

      {/* Board */}
      <div ref={wrapRef} className="mt-3 w-full max-w-md flex-1 overflow-y-auto">
        {/* Top row: stock, waste, spacer, 4 foundations */}
        <div className="flex justify-between" style={{ gap: 5 }}>
          {/* stock */}
          <Slot w={cardW} h={cardH} onClick={onStock}>
            {game.stock.length > 0 ? (
              <CardBack w={cardW} h={cardH} />
            ) : (
              <span className="text-lg text-slate-400">{canRecycle(game) ? '↻' : ''}</span>
            )}
          </Slot>
          {/* waste */}
          <Slot w={cardW} h={cardH} onClick={onWaste}>
            {game.waste.length > 0 && (
              <CardView
                card={game.waste[game.waste.length - 1]}
                w={cardW}
                h={cardH}
                selected={isSel({ kind: 'waste' })}
                onDoubleClick={() => apply(autoToFoundation(game, { kind: 'waste' }))}
              />
            )}
          </Slot>
          {/* spacer */}
          <div style={{ width: cardW, height: cardH }} />
          {/* foundations */}
          {[0, 1, 2, 3].map((i) => (
            <Slot key={i} w={cardW} h={cardH} onClick={() => onFoundation(i)}>
              {game.foundations[i].length > 0 ? (
                <CardView
                  card={game.foundations[i][game.foundations[i].length - 1]}
                  w={cardW}
                  h={cardH}
                  selected={isSel({ kind: 'foundation', i })}
                />
              ) : (
                <span className="text-base text-slate-300">{SUIT_CHAR[i]}</span>
              )}
            </Slot>
          ))}
        </div>

        {/* Tableau */}
        <div className="mt-4 flex justify-between" style={{ gap: 5 }}>
          {game.tableau.map((col, c) => {
            // Precompute y offsets for each card in the column.
            let y = 0;
            const tops = col.map((card, i) => {
              const cur = y;
              y += (i === col.length - 1 ? 0 : card.faceUp ? FACE_UP_OFFSET : FACE_DOWN_OFFSET) * cardH;
              return cur;
            });
            const colHeight = (tops[tops.length - 1] ?? 0) + cardH;
            return (
              <div key={c} className="relative" style={{ width: cardW, height: Math.max(colHeight, cardH) }}>
                {col.length === 0 && (
                  <button
                    onClick={() => onTableauEmpty(c)}
                    className="absolute inset-0 rounded-md border-2 border-dashed border-slate-200"
                    style={{ height: cardH }}
                    aria-label="empty column"
                  />
                )}
                {col.map((card, i) => (
                  <div
                    key={card.id}
                    className="absolute left-0"
                    style={{ top: tops[i], width: cardW, zIndex: i }}
                  >
                    {card.faceUp ? (
                      <CardView
                        card={card}
                        w={cardW}
                        h={cardH}
                        selected={isSel({ kind: 'tableau', col: c, idx: i })}
                        onClick={() => onTableauCard(c, i)}
                        onDoubleClick={
                          i === col.length - 1
                            ? () => apply(autoToFoundation(game, { kind: 'tableau', col: c, idx: i }))
                            : undefined
                        }
                      />
                    ) : (
                      <button onClick={() => onTableauCard(c, i)}>
                        <CardBack w={cardW} h={cardH} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      </div>

      {/* Controls */}
      <div className="mt-3 flex flex-wrap justify-center gap-2">
        <Btn onClick={undo}>{t('solitaire.undo')}</Btn>
        <Btn onClick={restart}>{t('solitaire.restart')}</Btn>
      </div>

      {/* Win modal */}
      {won && (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-900/40 p-6 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-3xl bg-white p-6 text-center text-slate-900 shadow-2xl ring-1 ring-black/5">
            <div className="text-4xl">🎉</div>
            <h2 className="font-cyber mt-2 text-2xl">{t('solitaire.solved')}</h2>
            <p className="mt-1 text-slate-500">
              {t(difficultyKey(difficulty))} · ⏱ {fmt(seconds)} · {moves} {t('solitaire.moves')}
            </p>
            <div className="mt-5 flex justify-center gap-2">
              <button onClick={onShare} className="rounded-xl bg-brand px-4 py-2 font-semibold text-white">
                {t('solitaire.share')}
              </button>
              <button onClick={newGame} className="rounded-xl bg-slate-100 px-4 py-2 font-semibold text-slate-700">
                {t('solitaire.again')}
              </button>
            </div>
            {shareMsg && <p className="mt-3 text-sm text-accent">{shareMsg}</p>}
          </div>
        </div>
      )}
    </div>
  );
}

// ---- presentational pieces ----
function Slot({
  w,
  h,
  onClick,
  children,
}: {
  w: number;
  h: number;
  onClick: () => void;
  children?: ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className="flex items-center justify-center rounded-md border border-slate-200 bg-slate-50"
      style={{ width: w, height: h }}
    >
      {children}
    </button>
  );
}

function CardBack({ w, h }: { w: number; h: number }) {
  return (
    <div
      className="rounded-md border border-blue-300 bg-blue-500"
      style={{
        width: w,
        height: h,
        backgroundImage:
          'repeating-linear-gradient(45deg, rgba(255,255,255,0.18) 0 4px, transparent 4px 8px)',
      }}
    />
  );
}

function CardView({
  card,
  w,
  h,
  selected,
  onClick,
  onDoubleClick,
}: {
  card: Card;
  w: number;
  h: number;
  selected?: boolean;
  onClick?: () => void;
  onDoubleClick?: () => void;
}) {
  const red = isRed(card.suit);
  const fs = Math.max(10, Math.round(w * 0.32));
  return (
    <div
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      className={`relative rounded-md border bg-white shadow-sm ${
        selected ? 'border-brand ring-2 ring-brand' : 'border-slate-300'
      }`}
      style={{ width: w, height: h, transform: selected ? 'translateY(-4px)' : undefined }}
    >
      <div
        className={`absolute left-1 top-0.5 font-bold leading-none ${red ? 'text-red-500' : 'text-slate-900'}`}
        style={{ fontSize: fs }}
      >
        {RANK_CHAR[card.rank]}
      </div>
      <div
        className={`absolute bottom-0.5 right-1 leading-none ${red ? 'text-red-500' : 'text-slate-900'}`}
        style={{ fontSize: Math.round(fs * 0.9) }}
      >
        {SUIT_CHAR[card.suit]}
      </div>
    </div>
  );
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
