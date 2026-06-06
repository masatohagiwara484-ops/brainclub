// Which games have a bespoke 3D (Three.js) VisualTutorial. Kept in its own tiny,
// three-free module so HowToOverlay (which lives in the main bundle) can decide
// whether to lazy-load the heavy 3D tutorial WITHOUT pulling three into the main
// bundle itself. Games not listed here fall back to the lightweight 2D gesture
// diagram.
export const VISUAL_TUTORIAL_GAMES = new Set<string>(['cube', 'watersort', 'gomoku']);
