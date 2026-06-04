import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { GameDef } from '../games/registry';
import { sound } from '../lib/sound';
import GameArt from './GameArt';

// A blue box per game: a game-evoking illustration above, the game name in white
// below. "Coming soon" titles are dimmed and badged.
export default function GameCard({ game }: { game: GameDef }) {
  const { t } = useTranslation();

  const inner = (
    <div
      className={`relative flex aspect-[4/3] flex-col overflow-hidden rounded-2xl bg-brand p-4 shadow-md ring-1 ring-black/5 transition ${
        game.available ? 'hover:-translate-y-0.5 hover:bg-brandDark hover:shadow-lg' : 'opacity-50'
      }`}
    >
      <div className="flex flex-1 items-center justify-center text-white/95">
        <GameArt id={game.id} className="h-14 w-14 sm:h-16 sm:w-16" />
      </div>
      <div className="mt-2 text-center">
        <div className="font-bold leading-tight text-white">{t(game.nameKey)}</div>
        <div className="text-[11px] text-white/70">{t(game.taglineKey)}</div>
      </div>
      {!game.available && (
        <span className="absolute right-2 top-2 rounded-full bg-white/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
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
