import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { GameDef } from '../games/registry';

export default function GameCard({ game }: { game: GameDef }) {
  const { t } = useTranslation();

  const inner = (
    <div
      className={`relative flex aspect-[4/3] flex-col justify-between overflow-hidden rounded-2xl bg-gradient-to-br ${game.gradient} p-4 shadow-lg transition ${
        game.available ? 'hover:scale-[1.02]' : 'opacity-60'
      }`}
    >
      <div className="text-3xl drop-shadow">{game.emoji}</div>
      <div>
        <div className="font-bold leading-tight text-white drop-shadow">{t(game.nameKey)}</div>
        <div className="text-xs text-white/90 drop-shadow">{t(game.taglineKey)}</div>
      </div>
      {!game.available && (
        <span className="absolute right-2 top-2 rounded-full bg-black/40 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
          {t('home.comingSoon')}
        </span>
      )}
    </div>
  );

  return game.available ? (
    <Link to={game.route} aria-label={t(game.nameKey)}>
      {inner}
    </Link>
  ) : (
    <div aria-disabled className="cursor-not-allowed">
      {inner}
    </div>
  );
}
