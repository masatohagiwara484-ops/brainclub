import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { GameDef } from '../games/registry';
import { useCloud } from '../lib/cloud';
import {
  createPrivateMatch,
  findMatch,
  joinPrivateMatch,
  leaveQueue,
  waitForMatch,
  type Match,
} from '../lib/realtime';
import { eloRank } from '../lib/elo';
import GameArt from './GameArt';
import { GAME_BG } from './GameShell';

// The online entry screen for a 1v1 game (shown once the player is signed in).
// Three paths: Quick Match (anonymous matchmaking via find_match + a Realtime
// wait), Create a friend room (hands the pending match up so the match page can
// show the share code and await the joiner), and Join by code.
type Mode = 'idle' | 'searching' | 'joining';

export default function OnlineLobby({
  game,
  onMatched,
}: {
  game: GameDef;
  onMatched: (m: Match) => void;
}) {
  const { t } = useTranslation();
  const cloud = useCloud();
  const uid = cloud.account?.userId ?? '';
  const elo = (cloud.account as { elo?: number } | null)?.elo;
  const [mode, setMode] = useState<Mode>('idle');
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const cleanupRef = useRef<(() => void) | null>(null);

  // Always drop out of the queue / tear down the wait subscription on unmount.
  useEffect(
    () => () => {
      cleanupRef.current?.();
      void leaveQueue();
    },
    [],
  );

  const startQuick = async () => {
    setError(null);
    setMode('searching');
    try {
      const m = await findMatch(game.id);
      if (m) {
        onMatched(m);
        return;
      }
      // Queued: discover the pairing when another player joins us as p1.
      cleanupRef.current = waitForMatch(uid, (mm) => {
        cleanupRef.current?.();
        onMatched(mm);
      });
    } catch {
      setError(t('online.error'));
      setMode('idle');
    }
  };

  const cancelQuick = async () => {
    cleanupRef.current?.();
    cleanupRef.current = null;
    await leaveQueue();
    setMode('idle');
  };

  const createRoom = async () => {
    setError(null);
    try {
      const m = await createPrivateMatch(game.id);
      // Hand the pending match up immediately; the match page shows the share
      // code and listens for the friend to join (status → active).
      onMatched(m);
    } catch {
      setError(t('online.error'));
    }
  };

  const joinRoom = async () => {
    setError(null);
    try {
      const m = await joinPrivateMatch(code.trim());
      onMatched(m);
    } catch {
      setError(t('online.roomNotFound'));
    }
  };

  const card = 'w-full rounded-2xl border border-white/10 bg-white/[0.05] p-4';

  return (
    <div
      className="flex h-full flex-col items-center overflow-y-auto px-5 py-8 text-white"
      style={{ background: GAME_BG }}
    >
      <div className="flex w-full max-w-md flex-col items-center">
        <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-accent-cyan text-white shadow-premium">
          <GameArt id={game.id} className="h-12 w-12" />
        </div>
        <h1 className="font-cyber mt-4 text-2xl">{t(game.nameKey)}</h1>
        <p className="font-dot mt-1 flex items-center gap-2 text-sm text-white/60">
          🌐 {t('online.title')}
          {typeof elo === 'number' && (
            <span className="rounded-md bg-white/10 px-2 py-0.5 text-xs text-accent-cyan">
              {t(`online.rank.${eloRank(elo).id}`)} · {elo}
            </span>
          )}
        </p>

        {mode === 'searching' ? (
          <div className={`${card} mt-7 text-center`}>
            <div className="text-3xl">🔎</div>
            <p className="mt-2 animate-pulse text-sm text-white/70">{t('online.searching')}</p>
            <button
              onClick={() => void cancelQuick()}
              className="mt-4 rounded-xl bg-white/[0.08] px-4 py-2 text-sm font-semibold text-white ring-1 ring-white/12 transition hover:bg-white/15"
            >
              {t('online.cancel')}
            </button>
          </div>
        ) : (
          <div className="mt-7 flex w-full flex-col gap-3">
            <button
              onClick={() => void startQuick()}
              className="flex items-center justify-between rounded-2xl bg-gradient-to-r from-primary to-accent-cyan px-5 py-4 font-semibold text-white shadow-premium transition active:scale-[0.98]"
            >
              <span className="text-lg">⚡ {t('online.quickMatch')}</span>
              <span className="text-sm text-white/80">{t('online.quickMatchHint')}</span>
            </button>

            <button
              onClick={() => void createRoom()}
              className="flex items-center justify-between rounded-2xl bg-white/[0.07] px-5 py-4 font-semibold text-white ring-1 ring-white/12 transition hover:bg-white/12 active:scale-[0.98]"
            >
              <span className="text-lg">🔗 {t('online.createRoom')}</span>
              <span className="text-sm text-white/50">{t('online.createRoomHint')}</span>
            </button>

            {mode === 'joining' ? (
              <div className={card}>
                <label className="text-xs font-semibold text-white/55">{t('online.enterCode')}</label>
                <div className="mt-1 flex gap-2">
                  <input
                    value={code}
                    onChange={(e) => setCode(e.target.value.toUpperCase())}
                    maxLength={4}
                    autoFocus
                    placeholder="ABCD"
                    className="min-w-0 flex-1 rounded-xl border border-white/15 bg-white/[0.06] px-3 py-2 text-center text-lg font-bold tracking-[0.3em] text-white outline-none focus:border-brand"
                  />
                  <button
                    onClick={() => void joinRoom()}
                    disabled={code.trim().length < 4}
                    className="shrink-0 rounded-xl bg-brand px-4 py-2 text-sm font-semibold text-white transition hover:bg-brandDark disabled:opacity-50"
                  >
                    {t('online.join')}
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setMode('joining')}
                className="flex items-center justify-between rounded-2xl bg-white/[0.07] px-5 py-4 font-semibold text-white ring-1 ring-white/12 transition hover:bg-white/12 active:scale-[0.98]"
              >
                <span className="text-lg">⌨️ {t('online.joinRoom')}</span>
                <span className="text-sm text-white/50">{t('online.joinRoomHint')}</span>
              </button>
            )}
          </div>
        )}

        {error && <p className="mt-3 text-sm text-rose-400">{error}</p>}
      </div>
    </div>
  );
}
