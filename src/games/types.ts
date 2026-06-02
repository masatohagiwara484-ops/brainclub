import type { Difficulty } from '../lib/difficulty';

/**
 * Props passed to a game component. Difficulty-enabled games receive the level
 * chosen on the difficulty screen; games without difficulty (e.g. the cube)
 * simply ignore it.
 */
export type GameProps = { difficulty?: Difficulty };
