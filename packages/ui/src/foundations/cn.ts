import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/** Tailwind-aware merge, so a passed `className` overrides the defaults. */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
