import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { GameDef } from '../games/registry';
import { sound } from '../lib/sound';
import GameArt from './GameArt';

// Each game gets a bespoke gradient so the grid reads as a collection of
// distinct-yet-harmonious cards (chess.com-style polish) rather than a wall of
// identical blue boxes. White text stays readable on every gradient below.
const GRADIENTS: Record<string, string> = {
  cube: 'from-[#1e3a8a] to-[#3b82f6]',
  sudoku: 'from-[#312e81] to-[#6366f1]',
  watersort: 'from-[#164e63] to-[#06b6d4]',
  solitaire: 'from-[#713f12] to-[#ca8a04]',
  gomoku: 'from-[#14532d] to-[#4ade80]',
  wordle: 'from-[#831843] to-[#f43f5e]',
};

const FALLBACK_GRADIENT = 'from-[#1e3a8a] to-[#3b82f6]';

// A gradient box per game: a game-evoking illustration above, the game name in
// white below. "Coming soon" titles are dimmed and badged.
export default function GameCard({ game }: { game: GameDef }) {
  const { t } = useTranslation();
  const gradient = GRADIENTS[game.id] ?? FALLBACK_GRADIENT;

  const inner = (
    <div
      // `rounded-card` is the new semantic radius token (= 1rem, identical to
      // the previous `rounded-2xl`) — demonstrates the design-token scale.
      className={`group relative flex aspect-[4/3] flex-col overflow-hidden rounded-card bg-gradient-to-br ${gradient} p-4 shadow-game ring-1 ring-black/5 transition-all duration-200 ease-out ${
        game.available
          ? 'hover:-translate-y-0.5 hover:shadow-elevated hover:brightness-[1.03] hover:ring-1 hover:ring-white/20 active:scale-[0.985] active:shadow-md'
          : 'opacity-50'
      }`}
    >
      <div className="flex flex-1 items-center justify-center text-white/95">
        <GameArt
          id={game.id}
          className="h-14 w-14 transition-transform duration-200 ease-out group-hover:scale-105 sm:h-16 sm:w-16"
        />
      </div>
      <div className="mt-2 text-center">
        <div className="font-bold leading-tight text-white">{t(game.nameKey)}</div>
        <div className="text-[11px] text-white/70">{t(game.taglineKey)}</div>
      </div>
      {!game.available && (
        <span className="absolute right-2 top-2 rounded-full bg-black/30 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white ring-1 ring-white/20 backdrop-blur-sm">
          {t('home.comingSoon')}
        </span>
      )}
    </div>
  );

  return game.available ? (
    <Link to={game.route} aria-label={t(game.nameKey)} onClick={() => sound.playSelectGame()}>
      {inner}
    </Link>
  ) : (
    <div aria-disabled className="cursor-not-allowed">
      {inner}
    </div>
  );
}
