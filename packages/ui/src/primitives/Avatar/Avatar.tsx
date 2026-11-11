import * as AvatarPrimitive from "@radix-ui/react-avatar";
import { cn } from "../../foundations/cn";
import { tv, type VariantProps } from "../../foundations/variants";

const avatarVariants = tv({
  base: "relative inline-flex shrink-0 select-none items-center justify-center overflow-hidden rounded-full font-medium",
  variants: {
    size: {
      sm: "size-7 text-xs",
      md: "size-9 text-sm",
      lg: "size-11 text-base",
    },
  },
  defaultVariants: { size: "md" },
});

// Fixed accent pairs (primitive palette) for deterministic, color-coded avatars;
// dark mode uses a low tint of the same hue so they stay quiet on dark surfaces.
const ACCENTS = [
  "bg-teal-100 text-teal-800 dark:bg-teal-400/15 dark:text-teal-200",
  "bg-orange-100 text-orange-800 dark:bg-orange-400/15 dark:text-orange-200",
  "bg-green-100 text-green-800 dark:bg-green-400/15 dark:text-green-200",
  "bg-amber-100 text-amber-900 dark:bg-amber-400/15 dark:text-amber-200",
  "bg-blue-100 text-blue-800 dark:bg-blue-500/20 dark:text-blue-100",
  "bg-red-100 text-red-800 dark:bg-red-400/15 dark:text-red-200",
] as const;

function accentFor(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return ACCENTS[hash % ACCENTS.length] ?? ACCENTS[0];
}

/** Override the name hash; both keep a 2px border so single and group avatars share a footprint. */
const NAMED_ACCENTS = {
  single:
    "border-2 border-[var(--color-avatar-single-bg)] bg-[var(--color-avatar-single-bg)] text-white",
  group:
    "border-2 border-[var(--color-avatar-group-border)] bg-[var(--color-avatar-group-bg)] text-white",
} as const;

export type AvatarAccent = keyof typeof NAMED_ACCENTS;

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
}

export interface AvatarProps extends VariantProps<typeof avatarVariants> {
  name: string;
  src?: string;
  accent?: AvatarAccent;
  className?: string;
}

export function Avatar({ name, src, size, accent, className }: AvatarProps) {
  return (
    <AvatarPrimitive.Root
      className={cn(
        avatarVariants({ size }),
        accent ? NAMED_ACCENTS[accent] : accentFor(name),
        className,
      )}
    >
      {src ? (
        <AvatarPrimitive.Image
          src={src}
          alt={name}
          className="size-full object-cover"
        />
      ) : null}
      <AvatarPrimitive.Fallback
        className="flex size-full items-center justify-center"
        delayMs={src ? 300 : 0}
      >
        {initials(name)}
      </AvatarPrimitive.Fallback>
    </AvatarPrimitive.Root>
  );
}
