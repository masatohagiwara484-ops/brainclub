import { getPlate, type NamePlate as Plate } from '../lib/nameplates';
import { cn } from '../lib/cn';

// Renders a player's name (and optional avatar / title / trailing badge) on
// their equipped name plate — the Clash-Royale banner. One component, used on
// the profile card, leaderboard rows and the online HUD, so identity reads the
// same everywhere. Pass `plateId` to show a specific plate (e.g. in a picker).
export default function NamePlate({
  name,
  plateId,
  avatar,
  title,
  trailing,
  size = 'md',
  className,
}: {
  name: string;
  plateId?: string;
  avatar?: string;
  title?: string;
  trailing?: React.ReactNode;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}) {
  const plate: Plate = getPlate(plateId ?? '');
  const pad = size === 'lg' ? 'px-4 py-2.5' : size === 'sm' ? 'px-2.5 py-1.5' : 'px-3 py-2';
  const nameCls = size === 'lg' ? 'text-lg' : size === 'sm' ? 'text-xs' : 'text-sm';
  return (
    <div
      className={cn('relative flex items-center gap-2.5 overflow-hidden rounded-xl ring-1 ring-white/15', pad, className)}
      style={{ background: plate.bg }}
    >
      {/* specular streak so the plate catches light like CR banners */}
      <span aria-hidden className="pointer-events-none absolute inset-0 bg-gradient-to-b from-white/20 to-transparent" />
      {avatar && (
        <span
          className={cn(
            'relative grid shrink-0 place-items-center rounded-full bg-black/25 ring-1 ring-white/20',
            size === 'lg' ? 'h-10 w-10 text-2xl' : size === 'sm' ? 'h-6 w-6 text-base' : 'h-8 w-8 text-xl',
          )}
        >
          {avatar}
        </span>
      )}
      <div className="relative min-w-0 flex-1">
        <div className={cn('truncate font-display font-bold leading-tight', nameCls)} style={{ color: plate.text }}>
          {name}
        </div>
        {title && (
          <div className="truncate text-[10px] font-semibold leading-tight" style={{ color: plate.text, opacity: 0.75 }}>
            {title}
          </div>
        )}
      </div>
      {trailing && <div className="relative shrink-0">{trailing}</div>}
    </div>
  );
}
