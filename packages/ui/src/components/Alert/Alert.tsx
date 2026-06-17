import {
  AlertTriangle,
  CheckCircle2,
  Info,
  OctagonAlert,
  type LucideIcon,
} from "lucide-react";
import * as React from "react";
import { cn } from "../../foundations/cn";
import { tv, type VariantProps } from "../../foundations/variants";

const alertVariants = tv({
  base: "relative flex w-full gap-3 rounded-lg border p-4 text-fg",
  variants: {
    intent: {
      neutral: "[--al:var(--color-fg-muted)] border-border bg-surface-muted/60",
      info: "[--al:var(--color-info)] border-[var(--color-info)]/30 bg-info-subtle",
      success:
        "[--al:var(--color-success)] border-[var(--color-success)]/30 bg-success-subtle",
      warning:
        "[--al:var(--color-warning)] border-[var(--color-warning)]/30 bg-warning-subtle",
      danger:
        "[--al:var(--color-danger)] border-[var(--color-danger)]/30 bg-danger-subtle",
    },
  },
  defaultVariants: { intent: "info" },
});

const DEFAULT_ICONS: Record<
  NonNullable<VariantProps<typeof alertVariants>["intent"]>,
  LucideIcon
> = {
  neutral: Info,
  info: Info,
  success: CheckCircle2,
  warning: AlertTriangle,
  danger: OctagonAlert,
};

export interface AlertProps
  extends
    React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof alertVariants> {
  /** Override the default intent icon, or pass null to hide it. */
  icon?: LucideIcon | null;
}

export function Alert({
  className,
  intent = "info",
  icon,
  children,
  ...props
}: AlertProps) {
  const Icon = icon === null ? null : (icon ?? DEFAULT_ICONS[intent ?? "info"]);
  return (
    <div
      role="alert"
      className={cn(alertVariants({ intent }), className)}
      {...props}
    >
      {Icon ? (
        <Icon
          className="mt-0.5 size-5 shrink-0 text-[var(--al)]"
          aria-hidden="true"
        />
      ) : null}
      <div className="flex min-w-0 flex-col gap-1">{children}</div>
    </div>
  );
}

export function AlertTitle({
  className,
  ...props
}: React.HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p className={cn("text-sm font-semibold text-fg", className)} {...props} />
  );
}

export function AlertDescription({
  className,
  ...props
}: React.HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn("text-sm text-fg-muted", className)} {...props} />;
}
