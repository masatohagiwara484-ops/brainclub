import { lazy, Suspense, useEffect, useState } from 'react';
import { useParams, Navigate } from 'react-router-dom';
import { getGame, type GameDef } from '../games/registry';
import { isDifficulty, type Difficulty } from '../lib/difficulty';
import { howto } from '../lib/howto';
import DifficultyScreen from '../components/DifficultyScreen';

// Lazy so framer-motion stays out of the main bundle; GamePage paints an
// identical instant dark-blur backdrop as the Suspense fallback below, so the
// launch sequence reads as instantaneous even on the very first play.
const CountdownOverlay = lazy(() => import('../components/CountdownOverlay'));

// GameLauncher gates the real game behind a universal "3 · 2 · 1 · GO!"
// countdown. Crucially the game is NOT mounted until GO! — many games start
// their timers on mount (Schulte, Whack, …), so this guarantees the clock
// begins exactly when play does, for every title, with zero per-game code. The
// game's code chunk is warmed during the countdown so it appears instantly.
function GameLauncher({ game, difficulty }: { game: GameDef; difficulty?: Difficulty }) {
  const [started, setStarted] = useState(false); // game mounted? (flips at GO!)
  const [counting, setCounting] = useState(true); // overlay present?

  // Warm the game's code chunk while the countdown plays.
  useEffect(() => {
    void game.load?.();
  }, [game]);

  // Auto-play the textless tutorial once the countdown has fully cleared, so it
  // lands on a clean game screen rather than over the fading overlay (Mission 9).
  useEffect(() => {
    if (!counting) howto.autoOpen(game.id);
  }, [counting, game]);

  const Game = game.component!;
  return (
    <div className="relative h-full w-full">
      {started && (
        <Suspense fallback={<div className="grid h-full place-items-center text-slate-400">…</div>}>
          <Game difficulty={difficulty} />
        </Suspense>
      )}
      {counting && (
        <Suspense fallback={<div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xl" />}>
          <CountdownOverlay onGo={() => setStarted(true)} onComplete={() => setCounting(false)} />
        </Suspense>
      )}
    </div>
  );
}

export default function GamePage() {
  const { id, difficulty } = useParams<{ id: string; difficulty?: string }>();
  const game = id ? getGame(id) : undefined;

  if (!game || !game.available || !game.component) {
    return <Navigate to="/" replace />;
  }

  // Difficulty-enabled games show the difficulty-select screen first.
  if (game.hasDifficulty && !isDifficulty(difficulty)) {
    return <DifficultyScreen game={game} />;
  }

  const diff = isDifficulty(difficulty) ? difficulty : undefined;
  // Key on id+difficulty so picking a new game/level remounts the launcher and
  // replays the countdown from the top.
  return <GameLauncher key={`${game.id}:${diff ?? ''}`} game={game} difficulty={diff} />;
}
