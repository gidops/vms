import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Merge class names with Tailwind-aware conflict resolution. Always use this
 * when composing a component's base classes with an incoming `className` prop
 * so later utilities win (e.g. a passed `bg-surface` overrides the default).
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
