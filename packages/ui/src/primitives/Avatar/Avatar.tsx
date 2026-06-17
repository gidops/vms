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

// Fixed accent pairs (primitive palette) for deterministic, color-coded avatars.
const ACCENTS = [
  "bg-teal-100 text-teal-800",
  "bg-orange-100 text-orange-800",
  "bg-green-100 text-green-800",
  "bg-amber-100 text-amber-900",
  "bg-blue-100 text-blue-800",
  "bg-red-100 text-red-800",
] as const;

function accentFor(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return ACCENTS[hash % ACCENTS.length] ?? ACCENTS[0];
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
}

export interface AvatarProps extends VariantProps<typeof avatarVariants> {
  /** Used for the initials fallback and the deterministic accent color. */
  name: string;
  src?: string;
  className?: string;
}

export function Avatar({ name, src, size, className }: AvatarProps) {
  return (
    <AvatarPrimitive.Root
      className={cn(avatarVariants({ size }), accentFor(name), className)}
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
