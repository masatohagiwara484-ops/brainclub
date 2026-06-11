import type { ReactNode } from 'react';
import { rarityMeta, type Rarity } from '../lib/rarity';
import { Icon } from './Icons';
import { cn } from '../lib/cn';

// A cosmetic swatch in the collectible language: a rarity-gradient frame over a
// dark face, selected ring, lock badge, and a foil sheen for legendary+. Used
// by every cosmetic picker (skins, frames, nameplates, titles, pass rewards) so
// the whole collection looks like one set.
export default function RarityTile({
  rarity,
  selected = false,
  locked = false,
  onClick,
  children,
  className,
  ariaLabel,
}: {
  rarity: Rarity;
  selected?: boolean;
  locked?: boolean;
  onClick?: () => void;
  children: ReactNode;
  className?: string;
  ariaLabel?: string;
}) {
  const meta = rarityMeta(rarity);
  const shine = meta.rank >= 3; // legendary + mythic get the moving foil
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel}
      style={{ ['--rar' as string]: meta.gradient }}
      className={cn(
        'rarity-tile tap-target relative flex flex-col items-center justify-center gap-1 overflow-hidden p-2 transition',
        shine && 'rarity-shine',
        selected && 'ring-2 ring-white/90',
        onClick && 'active:scale-95',
        className,
      )}
    >
      {children}
      {locked && (
        <span className="absolute inset-0 z-10 grid place-items-center bg-black/55">
          <Icon name="lock" className="h-4 w-4 text-white/90" />
        </span>
      )}
      {selected && !locked && (
        <span className="absolute right-1 top-1 z-10 grid h-4 w-4 place-items-center rounded-full bg-white">
          <Icon name="check" className="h-3 w-3 text-space-1" />
        </span>
      )}
    </button>
  );
}
