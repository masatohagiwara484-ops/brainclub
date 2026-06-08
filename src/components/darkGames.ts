// Games whose screen has been converted to the dark premium design system
// (GameShell). The Layout reads this so the shared header + root background go
// dark for exactly these games — letting the full-dark rollout proceed one game
// at a time without the un-converted (still light) games getting a dark header.
// Add an id here as each game is converted.
export const DARK_GAMES = new Set<string>([
  'sudoku', 'schulte', 'lightsout', 'simon', 'whack', 'memorygrid',
  'memory', 'mastermind', '2048', 'slide',
  'flood', 'minesweeper', 'pegsolitaire', 'reaction', 'colorclash',
  'cube', 'wordle', 'watersort', 'solitaire', 'gomoku',
  'hex',
]);
