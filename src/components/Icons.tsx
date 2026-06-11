// The app's single icon system, backed by lucide-react (tree-shaken — only the
// icons imported here ship in the bundle). The `Icon name=` API is kept so
// existing call sites don't change, while every glyph is now a professionally
// drawn, optically consistent 24×24 stroke icon (round caps, 2px). Color/size
// come from the parent via `className`; icons never hard-code a color.
//
// Add new names here rather than importing lucide directly in components, so
// the available vocabulary stays curated and consistent.

import {
  House,
  ChartNoAxesColumn,
  Gem,
  SlidersHorizontal,
  User,
  ChevronLeft,
  CircleQuestionMark,
  Trophy,
  Flame,
  Play,
  Globe,
  Swords,
  Zap,
  Star,
  Crown,
  Share2,
  RotateCcw,
  Undo2,
  X,
  Check,
  Copy,
  LogIn,
  Sparkles,
  Timer,
  Medal,
  ArrowRight,
  Pause,
  Volume2,
  Languages,
  Lock,
  Gift,
  Ticket,
  MessageSquareText,
  Hash,
  ChevronRight,
  type LucideIcon,
} from 'lucide-react';

export type IconName =
  | 'home'
  | 'score'
  | 'subscription'
  | 'settings'
  | 'user'
  | 'back'
  | 'help'
  | 'trophy'
  | 'diamond'
  | 'flame'
  | 'play'
  | 'globe'
  | 'swords'
  | 'zap'
  | 'star'
  | 'crown'
  | 'share'
  | 'retry'
  | 'undo'
  | 'close'
  | 'check'
  | 'copy'
  | 'signin'
  | 'sparkles'
  | 'timer'
  | 'medal'
  | 'arrowRight'
  | 'pause'
  | 'sound'
  | 'language'
  | 'lock'
  | 'gift'
  | 'ticket'
  | 'emote'
  | 'hash'
  | 'chevronRight';

const ICONS: Record<IconName, LucideIcon> = {
  home: House,
  score: ChartNoAxesColumn,
  subscription: Gem,
  settings: SlidersHorizontal,
  user: User,
  back: ChevronLeft,
  help: CircleQuestionMark,
  trophy: Trophy,
  diamond: Gem,
  flame: Flame,
  play: Play,
  globe: Globe,
  swords: Swords,
  zap: Zap,
  star: Star,
  crown: Crown,
  share: Share2,
  retry: RotateCcw,
  undo: Undo2,
  close: X,
  check: Check,
  copy: Copy,
  signin: LogIn,
  sparkles: Sparkles,
  timer: Timer,
  medal: Medal,
  arrowRight: ArrowRight,
  pause: Pause,
  sound: Volume2,
  language: Languages,
  lock: Lock,
  gift: Gift,
  ticket: Ticket,
  emote: MessageSquareText,
  hash: Hash,
  chevronRight: ChevronRight,
};

export function Icon({
  name,
  className = 'h-6 w-6',
  style,
}: {
  name: IconName;
  className?: string;
  style?: React.CSSProperties;
}) {
  const C = ICONS[name];
  return <C className={className} style={style} strokeWidth={2} aria-hidden focusable={false} />;
}
