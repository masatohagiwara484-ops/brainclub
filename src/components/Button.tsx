import type { ButtonHTMLAttributes } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../lib/cn';
import { Icon, type IconName } from './Icons';

// The single source of truth for interactive buttons across BrainClub, in the
// HOLO 2.0 language: every variant sits on the dark glass system, every size
// guarantees a ≥44px touch target, and the press/focus behavior is identical
// everywhere. Variants:
//   primary  — the iridescent hero CTA (gradient + glow)
//   secondary— frosted glass chip (default for in-game / panel actions)
//   ghost    — borderless, for quiet inline actions
//   danger   — destructive (resign / delete / reset)
const button = cva(
  'inline-flex items-center justify-center gap-2 font-semibold rounded-2xl select-none ' +
    'transition-all duration-150 ease-out active:scale-[0.97] ' +
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-iris-violet focus-visible:ring-offset-2 focus-visible:ring-offset-space-1 ' +
    'disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none disabled:active:scale-100',
  {
    variants: {
      variant: {
        primary:
          'bg-gradient-to-r from-iris-cyan via-iris-violet to-iris-magenta text-white ' +
          'shadow-glow-sm hover:shadow-glow hover:brightness-110',
        secondary:
          'glass-panel text-white hover:bg-white/10',
        ghost: 'text-white/70 hover:bg-white/10 hover:text-white',
        danger: 'bg-danger/90 text-white hover:bg-danger shadow-md',
      },
      size: {
        sm: 'min-h-[44px] px-3.5 py-1.5 text-sm',
        md: 'min-h-[44px] px-5 py-2.5 text-base',
        lg: 'min-h-[52px] px-7 py-3 text-lg',
      },
    },
    defaultVariants: { variant: 'primary', size: 'md' },
  },
);

// Icons scale with the button size so the optical balance stays right.
const ICON_SIZES = { sm: 'h-4 w-4', md: 'h-5 w-5', lg: 'h-6 w-6' } as const;

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof button> {
  /** Optional leading icon, rendered via the shared <Icon> set. */
  leftIcon?: IconName;
  /** Optional trailing icon, rendered via the shared <Icon> set. */
  rightIcon?: IconName;
  /** Override the icon sizing (e.g. for icon-only buttons). */
  iconClassName?: string;
}

export default function Button({
  variant,
  size,
  leftIcon,
  rightIcon,
  iconClassName,
  type = 'button',
  className,
  children,
  ...rest
}: ButtonProps) {
  const iconClass = iconClassName ?? ICON_SIZES[size ?? 'md'];
  return (
    <button type={type} className={cn(button({ variant, size }), className)} {...rest}>
      {leftIcon && <Icon name={leftIcon} className={iconClass} />}
      {children}
      {rightIcon && <Icon name={rightIcon} className={iconClass} />}
    </button>
  );
}
