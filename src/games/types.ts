import type { Difficulty } from '../lib/difficulty';
import type { Seat } from '../lib/realtime';

/**
 * Handle a game receives when it is played online (1v1). The match's `moves`
 * array is authoritative — the game renders its board as a pure function of it
 * (move i was played by the first mover when i is even, the other when odd), so
 * there is no optimistic state to reconcile and a reconnecting client rebuilds
 * the board for free. The game pushes the local player's move with sendMove and
 * declares the outcome it detects with reportResult (the RPC is idempotent, so
 * both clients reporting the same winner is safe).
 */
export type OnlineController = {
  mySeat: Seat;
  /** True when the local player moves first (and so plays the "first" color). */
  iMoveFirst: boolean;
  opponentName: string;
  /** Authoritative, append-only move log; grows as either player moves. */
  moves: unknown[];
  finished: boolean;
  /** Winning seat once finished (e.g. via resign/forfeit), else null. */
  winnerSeat: Seat | null;
  /** Persist the local player's move (server validates turn order). */
  sendMove: (move: unknown) => void;
  /** Settle the game + apply Elo. iWon reflects the local player's result. */
  reportResult: (iWon: boolean) => void;
  /** Forfeit the game (the opponent wins). */
  resign: () => void;
  /** Leave the match and return to the online lobby (e.g. "new opponent"). */
  leave: () => void;
};

/**
 * Props passed to a game component. Difficulty-enabled games receive the level
 * chosen on the difficulty screen; games without difficulty (e.g. the cube)
 * simply ignore it. `online` is present only for live 1v1 matches.
 */
export type GameProps = { difficulty?: Difficulty; online?: OnlineController };
