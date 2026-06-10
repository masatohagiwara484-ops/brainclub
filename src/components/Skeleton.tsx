import { cn } from '../lib/cn';

// Loading placeholders in the HOLO language: a frosted bar with a slow shimmer
// sweep. Replaces "…"/blank gaps so async screens (leaderboards, profiles)
// never pop content in from nothing. Compose with width/height utilities:
//   <Skeleton className="h-10 w-full" />
// SkeletonRow is the common list-row shape (avatar + two lines).
export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-xl bg-white/[0.06]',
        'before:absolute before:inset-0 before:-translate-x-full',
        'before:bg-gradient-to-r before:from-transparent before:via-white/[0.07] before:to-transparent',
        'before:animate-[shimmer_1.6s_infinite] motion-reduce:before:animate-none',
        className,
      )}
      aria-hidden
    />
  );
}

export function SkeletonRow({ className }: { className?: string }) {
  return (
    <div className={cn('flex items-center gap-3 rounded-xl bg-white/[0.04] px-3 py-2.5', className)}>
      <Skeleton className="h-7 w-7 shrink-0 rounded-full" />
      <div className="flex-1 space-y-1.5">
        <Skeleton className="h-3.5 w-2/5" />
        <Skeleton className="h-2.5 w-1/4" />
      </div>
      <Skeleton className="h-4 w-10" />
    </div>
  );
}

export function SkeletonList({ rows = 6, className }: { rows?: number; className?: string }) {
  return (
    <div className={cn('space-y-1.5', className)} role="status" aria-label="Loading">
      {Array.from({ length: rows }, (_, i) => (
        <SkeletonRow key={i} />
      ))}
    </div>
  );
}
