import type { ButtonHTMLAttributes } from 'react';
import { Icon, type IconName } from './Icons';

// The single source of truth for interactive buttons across BrainClub. One
// component, four variants, three sizes — so every tap "feels" the same
// (chess.com / Nintendo-grade consistency): identical radius, press scale,
// timing curve and focus ring everywhere. Pure Tailwind + TS, no framer-motion.

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'sm' | 'md' | 'lg';

// Shared across all variants/sizes: layout, shape, motion, focus ring and the
// disabled treatment. Focus ring is keyboard-only (focus-visible) so a mouse
// click stays clean while keyboard users always get a clear target.
const BASE =
  'inline-flex items-center justify-center gap-2 font-semibold rounded-2xl select-none ' +
  'transition-all duration-150 ease-out active:scale-[0.985] active:shadow-sm ' +
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 ' +
  'disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none disabled:active:scale-100';

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-brand text-white shadow-md hover:bg-brandDark',
  secondary: 'bg-white text-slate-900 border border-slate-200 hover:bg-slate-50',
  ghost: 'text-slate-600 hover:bg-slate-100',
  danger: 'bg-red-600 text-white hover:bg-red-700',
};

const SIZES: Record<Size, string> = {
  sm: 'px-3 py-1.5 text-sm',
  md: 'px-4 py-2 text-base',
  lg: 'px-6 py-3 text-lg',
};

// Icons scale with the button size so the optical balance stays right.
const ICON_SIZES: Record<Size, string> = {
  sm: 'h-4 w-4',
  md: 'h-5 w-5',
  lg: 'h-6 w-6',
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  /** Optional leading icon, rendered via the shared <Icon> set. */
  leftIcon?: IconName;
  /** Optional trailing icon, rendered via the shared <Icon> set. */
  rightIcon?: IconName;
  /** Override the icon sizing (e.g. for icon-only buttons). */
  iconClassName?: string;
}

const cx = (...parts: Array<string | false | undefined>) => parts.filter(Boolean).join(' ');

export default function Button({
  variant = 'primary',
  size = 'md',
  leftIcon,
  rightIcon,
  iconClassName,
  type = 'button',
  className,
  children,
  ...rest
}: ButtonProps) {
  const iconClass = iconClassName ?? ICON_SIZES[size];
  return (
    <button type={type} className={cx(BASE, VARIANTS[variant], SIZES[size], className)} {...rest}>
      {leftIcon && <Icon name={leftIcon} className={iconClass} />}
      {children}
      {rightIcon && <Icon name={rightIcon} className={iconClass} />}
    </button>
  );
}
