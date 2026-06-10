import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { GameDef } from '../games/registry';
import { sound } from '../lib/sound';
import { cn } from '../lib/cn';
import GameArt from './GameArt';

// The universal 2D game tile (HOLO 2.0): every grid, strip and fallback on the
// home screen renders THIS, so browsing always looks like one product. A glass
// face over the game's gradient, the bespoke SVG art as the hero, and a quiet
// label. Tiles are fully tappable (≥44px) and lift with a glow on hover.
export default function GameTile({
  game,
  size = 'md',
  className,
}: {
  game: GameDef;
  size?: 'md' | 'sm';
  className?: string;
}) {
  const { t } = useTranslation();

  const inner = (
    <div
      className={cn(
        'group relative flex flex-col overflow-hidden rounded-card transition-all duration-200 ease-out',
        size === 'md' ? 'aspect-[4/5]' : 'aspect-square',
        game.available
          ? 'hover:-translate-y-1 hover:shadow-glow-sm active:scale-[0.97]'
          : 'opacity-45',
        className,
      )}
    >
      {/* Game-bespoke gradient + a soft vignette so the art pops. */}
      <div className={cn('absolute inset-0 bg-gradient-to-br', game.gradient)} />
      <div className="absolute inset-0 bg-[radial-gradient(120%_90%_at_50%_-10%,transparent_40%,rgba(5,6,13,0.55)_100%)]" />
      {/* Glass frame: 1px border + top highlight, the HOLO surface signature. */}
      <div className="absolute inset-0 rounded-card ring-1 ring-inset ring-white/15" />
      <div className="absolute inset-x-0 top-0 h-px bg-white/25" />

      <div className="relative flex flex-1 items-center justify-center p-3 text-white/95 drop-shadow-[0_4px_10px_rgba(0,0,0,0.4)]">
        <GameArt
          id={game.id}
          className={cn(
            'transition-transform duration-200 ease-out group-hover:scale-110',
            size === 'md' ? 'h-14 w-14' : 'h-10 w-10',
          )}
        />
      </div>

      <div className="relative px-2 pb-2.5 text-center">
        <div
          className={cn(
            'font-display leading-tight text-white',
            size === 'md' ? 'text-[13px]' : 'text-[11px]',
          )}
        >
          {t(game.nameKey)}
        </div>
        {size === 'md' && (
          <div className="mt-0.5 truncate text-[10px] leading-tight text-white/65">
            {t(game.taglineKey)}
          </div>
        )}
      </div>

      {!game.available && (
        <span className="absolute right-2 top-2 rounded-full bg-black/40 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-white/90 backdrop-blur-sm">
          {t('home.comingSoon')}
        </span>
      )}
    </div>
  );

  return game.available ? (
    <Link
      to={game.route}
      aria-label={t(game.nameKey)}
      onClick={() => sound.playSelectGame()}
      className="tap-target block"
    >
      {inner}
    </Link>
  ) : (
    <div aria-disabled className="cursor-not-allowed">
      {inner}
    </div>
  );
}
