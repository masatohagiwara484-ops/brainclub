import { Suspense, useEffect, useState } from 'react';
import { Navigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { getGame, type GameDef } from '../games/registry';
import { isCloudConfigured } from '../lib/supabase';
import { useCloud } from '../lib/cloud';
import AccountPanel from '../components/AccountPanel';
import OnlineLobby from '../components/OnlineLobby';
import { GAME_BG } from '../components/GameShell';
import GameArt from '../components/GameArt';
import { Icon } from '../components/Icons';
import {
  fetchMatch,
  fetchPlayerName,
  recordMove,
  recordResult,
  seatOf,
  subscribeMatch,
  type Match,
} from '../lib/realtime';
import type { OnlineController } from '../games/types';

// Online entry for a 1v1 game: gate on sign-in → matchmaking lobby → live match.
export default function OnlineGamePage() {
  const { id } = useParams<{ id: string }>();
  const game = id ? getGame(id) : undefined;
  const cloud = useCloud();
  const [match, setMatch] = useState<Match | null>(null);

  // Online play needs both a Realtime-capable game and a configured backend.
  if (!game || !game.available || !game.component || !game.online || !isCloudConfigured) {
    return <Navigate to={id ? `/play/${id}` : '/'} replace />;
  }

  if (cloud.status !== 'signed-in') return <SignInGate game={game} />;
  if (!match) return <OnlineLobby game={game} onMatched={setMatch} />;

  return (
    <ActiveMatch
      key={match.id}
      game={game}
      initial={match}
      uid={cloud.account!.userId}
      onExit={() => setMatch(null)}
    />
  );
}

// Must sign in before playing online (AI / solo stay login-free elsewhere).
function SignInGate({ game }: { game: GameDef }) {
  const { t } = useTranslation();
  return (
    <div
      className="flex h-full flex-col items-center justify-center gap-5 px-5 py-8 text-white"
      style={{ background: GAME_BG }}
    >
      <div className="holo-border flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-space-2 to-space-3">
        <GameArt id={game.id} className="h-12 w-12" />
      </div>
      <div className="text-center">
        <h1 className="font-display flex items-center justify-center gap-2 text-2xl text-iris">
          <Icon name="globe" className="h-6 w-6 text-iris-violet" /> {t('online.title')}
        </h1>
        <p className="mt-1 text-sm text-white/60">{t('online.signInRequired')}</p>
      </div>
      <div className="w-full max-w-md">
        <AccountPanel />
      </div>
    </div>
  );
}

// A live (or pending) match: owns the Realtime subscription, builds the
// OnlineController, and renders the game once both seats are filled.
function ActiveMatch({
  game,
  initial,
  uid,
  onExit,
}: {
  game: GameDef;
  initial: Match;
  uid: string;
  onExit: () => void;
}) {
  const { t } = useTranslation();
  const [match, setMatch] = useState<Match>(initial);
  const [oppName, setOppName] = useState('Player');

  // Subscribe to live changes (moves + result) and reconcile once on mount in
  // case an update slipped between the RPC return and the subscription opening.
  useEffect(() => {
    const unsub = subscribeMatch(initial.id, setMatch);
    void fetchMatch(initial.id).then((m) => m && setMatch(m));
    return unsub;
  }, [initial.id]);

  const mySeat = seatOf(match, uid);
  const oppId = mySeat === 1 ? match.p2 : match.p1;

  useEffect(() => {
    if (oppId) void fetchPlayerName(oppId).then(setOppName);
  }, [oppId]);

  // Private room still waiting for the friend to join.
  if (match.status === 'pending') {
    return <WaitingRoom code={match.room_code ?? '----'} onCancel={onExit} />;
  }

  const Game = game.component!;
  const finished = match.status === 'finished' || match.status === 'abandoned';
  const controller: OnlineController = {
    matchId: match.id,
    mySeat,
    iMoveFirst: match.first_player === mySeat,
    opponentName: oppName,
    moves: match.moves,
    finished,
    winnerSeat: match.winner ? seatOf(match, match.winner) : null,
    sendMove: (mv) => void recordMove(match.id, mv).catch(() => {}),
    reportResult: (iWon) => {
      const winner = iWon ? uid : oppId;
      if (winner) void recordResult(match.id, winner);
    },
    resign: () => {
      if (oppId) void recordResult(match.id, oppId);
    },
    leave: onExit,
  };

  const exit = () => {
    if (!finished && oppId) void recordResult(match.id, oppId); // mid-game leave = forfeit
    onExit();
  };

  return (
    <div className="relative h-full w-full">
      <button
        onClick={exit}
        className="absolute right-3 top-3 z-30 flex h-11 w-11 items-center justify-center rounded-full bg-space-1/70 text-white/80 ring-1 ring-white/10 backdrop-blur transition hover:text-rose-400"
        aria-label={t('online.leave')}
      >
        <Icon name="close" className="h-5 w-5" />
      </button>
      <Suspense fallback={<div className="grid h-full place-items-center text-slate-400">…</div>}>
        <Game online={controller} />
      </Suspense>
    </div>
  );
}

function WaitingRoom({ code, onCancel }: { code: string; onCancel: () => void }) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard blocked — the code is shown on screen anyway */
    }
  };
  return (
    <div
      className="flex h-full flex-col items-center justify-center gap-5 px-5 text-white"
      style={{ background: GAME_BG }}
    >
      <Icon name="globe" className="h-10 w-10 text-iris-violet" />
      <p className="text-sm text-white/60">{t('online.shareCodeHint')}</p>
      <button
        onClick={() => void copy()}
        className="holo-border flex items-center gap-3 rounded-2xl bg-space-2/80 px-8 py-4 transition hover:bg-space-3/80"
      >
        <span className="font-display text-4xl tracking-[0.4em] text-iris">{code}</span>
        <Icon name="copy" className="h-5 w-5 text-white/50" />
      </button>
      <p className="h-4 text-xs text-iris-cyan">{copied ? t('online.copied') : ' '}</p>
      <div className="flex items-center gap-2 text-sm text-white/50">
        <span className="h-2 w-2 animate-ping rounded-full bg-iris-violet motion-reduce:animate-none" />
        {t('online.waitingForFriend')}
      </div>
      <button
        onClick={onCancel}
        className="tap-target mt-2 rounded-xl bg-white/[0.08] px-4 py-2 text-sm font-semibold text-white ring-1 ring-white/12 transition hover:bg-white/15"
      >
        {t('online.cancel')}
      </button>
    </div>
  );
}
