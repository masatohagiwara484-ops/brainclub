// Which games have a bespoke 3D (Three.js) VisualTutorial. Kept in its own tiny,
// three-free module so HowToOverlay (which lives in the main bundle) can decide
// whether to lazy-load the heavy 3D tutorial WITHOUT pulling three into the main
// bundle itself. Every playable game now has one (cube / watersort / gomoku are
// bespoke scenes; the rest are authored on the shared GridScene engine).
export const VISUAL_TUTORIAL_GAMES = new Set<string>([
  'cube', 'watersort', 'gomoku',
  'sudoku', 'wordle', '2048', 'slide', 'minesweeper', 'simon', 'memorygrid',
  'whack', 'memory', 'solitaire', 'mastermind', 'pegsolitaire', 'lightsout',
  'flood', 'reaction', 'colorclash', 'schulte',
]);
