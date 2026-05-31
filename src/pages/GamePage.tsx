import { Suspense } from 'react';
import { useParams, Navigate } from 'react-router-dom';
import { getGame } from '../games/registry';

export default function GamePage() {
  const { id } = useParams<{ id: string }>();
  const game = id ? getGame(id) : undefined;

  if (!game || !game.available || !game.component) {
    return <Navigate to="/" replace />;
  }

  const Game = game.component;
  return (
    <Suspense fallback={<div className="grid h-full place-items-center text-white/40">…</div>}>
      <Game />
    </Suspense>
  );
}
