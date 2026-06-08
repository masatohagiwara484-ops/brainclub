// Zero-dependency line icons (stroke = currentColor), used by the bottom tab bar
// and the simplified header. Kept deliberately minimal and uniform (24×24,
// round caps/joins) for a clean chess.com-style look. Color/size come from the
// parent via `className`; the icons themselves never hard-code a color.

export type IconName =
  | 'home'
  | 'score'
  | 'subscription'
  | 'settings'
  | 'user'
  | 'back'
  | 'help'
  | 'trophy'
  | 'diamond';

export function Icon({
  name,
  className = 'h-6 w-6',
}: {
  name: IconName;
  className?: string;
}) {
  const common = {
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.8,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    className,
    'aria-hidden': true,
    focusable: false,
  };

  switch (name) {
    case 'home':
      return (
        <svg {...common}>
          <path d="M3 10.5 12 3l9 7.5" />
          <path d="M5 9.5V20h5v-6h4v6h5V9.5" />
        </svg>
      );
    case 'score':
      // A podium / bar chart — "where your thinking level sits".
      return (
        <svg {...common}>
          <line x1="4" y1="20.5" x2="20" y2="20.5" />
          <rect x="5.5" y="12" width="3.5" height="8" rx="1" />
          <rect x="10.25" y="7" width="3.5" height="13" rx="1" />
          <rect x="15" y="14.5" width="3.5" height="5.5" rx="1" />
        </svg>
      );
    case 'subscription':
    case 'diamond':
      // A gem — Premium / subscription.
      return (
        <svg {...common}>
          <path d="M5 4h14l3 5-10 11L2 9z" />
          <path d="M2 9h20" />
          <path d="m9 4-2 5 5 11" />
          <path d="m15 4 2 5-5 11" />
        </svg>
      );
    case 'settings':
      // Sliders — clean and modern, reads as "settings".
      return (
        <svg {...common}>
          <line x1="4" y1="7" x2="20" y2="7" />
          <line x1="4" y1="12" x2="20" y2="12" />
          <line x1="4" y1="17" x2="20" y2="17" />
          <circle cx="9" cy="7" r="2.2" fill="var(--icon-knob, #fff)" />
          <circle cx="15" cy="12" r="2.2" fill="var(--icon-knob, #fff)" />
          <circle cx="8" cy="17" r="2.2" fill="var(--icon-knob, #fff)" />
        </svg>
      );
    case 'user':
      return (
        <svg {...common}>
          <circle cx="12" cy="8.5" r="3.5" />
          <path d="M5 20c0-3.6 3.1-6 7-6s7 2.4 7 6" />
        </svg>
      );
    case 'back':
      return (
        <svg {...common}>
          <path d="M15 5l-7 7 7 7" />
        </svg>
      );
    case 'help':
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="9" />
          <path d="M9.4 9.3a2.6 2.6 0 1 1 3.7 2.4c-.9.5-1.1.9-1.1 1.8" />
          <line x1="12" y1="16.6" x2="12" y2="16.61" />
        </svg>
      );
    case 'trophy':
      // A trophy cup — the leaderboard / ranks tab.
      return (
        <svg {...common}>
          <path d="M7 4h10v4a5 5 0 0 1-10 0V4z" />
          <path d="M7 6H4.5a2.5 2.5 0 0 0 2.5 2.5M17 6h2.5a2.5 2.5 0 0 1-2.5 2.5" />
          <line x1="12" y1="13" x2="12" y2="16.5" />
          <path d="M8.5 20h7M9.5 20v-1.5a2.5 2.5 0 0 1 5 0V20" />
        </svg>
      );
  }
}
