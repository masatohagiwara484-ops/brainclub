import { Suspense, useEffect } from 'react';
import { useParams, Navigate } from 'react-router-dom';
import { getGame } from '../games/registry';
import { isDifficulty } from '../lib/difficulty';
import { howto } from '../lib/howto';
import DifficultyScreen from '../components/DifficultyScreen';

export default function GamePage() {
  const { id, difficulty } = useParams<{ id: string; difficulty?: string }>();
  const game = id ? getGame(id) : undefined;
  const ready = !!game && game.available && !!game.component && (!game.hasDifficulty || isDifficulty(difficulty));

  // The very first time a game actually starts, auto-play its textless tutorial
  // once (Mission 9). Runs only when the game itself renders — not on the
  // difficulty-select screen — and never again (persisted per game).
  useEffect(() => {
    if (ready && game) howto.autoOpen(game.id);
  }, [ready, game]);

  if (!game || !game.available || !game.component) {
    return <Navigate to="/" replace />;
  }

  // Difficulty-enabled games show the difficulty-select screen first.
  if (game.hasDifficulty && !isDifficulty(difficulty)) {
    return <DifficultyScreen game={game} />;
  }

  const Game = game.component;
  return (
    <Suspense fallback={<div className="grid h-full place-items-center text-slate-400">…</div>}>
      <Game difficulty={isDifficulty(difficulty) ? difficulty : undefined} />
    </Suspense>
  );
}
