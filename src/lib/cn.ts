// Class-name combinator: clsx for conditionals + tailwind-merge so a caller's
// override (e.g. `p-0`) cleanly beats a component's default (`px-4`) instead of
// fighting it in specificity. Use for every component that accepts className.
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
