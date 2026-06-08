import * as ToastPrimitive from "@radix-ui/react-toast";
import { X } from "lucide-react";
import * as React from "react";
import { cn } from "../../foundations/cn";
import { tv, type VariantProps } from "../../foundations/variants";

export const ToastProvider = ToastPrimitive.Provider;
export const ToastAction = ToastPrimitive.Action;

export const ToastViewport = React.forwardRef<
  React.ElementRef<typeof ToastPrimitive.Viewport>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitive.Viewport>
>(function ToastViewport({ className, ...props }, ref) {
  return (
    <ToastPrimitive.Viewport
      ref={ref}
      className={cn(
        "fixed bottom-0 end-0 z-[var(--z-toast)] flex max-h-screen w-full flex-col gap-2 p-4 sm:max-w-sm",
        className,
      )}
      {...props}
    />
  );
});

const toastVariants = tv({
  base: "relative flex w-full items-start gap-3 rounded-lg border bg-surface p-4 text-fg shadow-lg",
  variants: {
    intent: {
      neutral: "border-border",
      info: "border-[var(--color-info)]/40",
      success: "border-[var(--color-success)]/40",
      warning: "border-[var(--color-warning)]/40",
      danger: "border-[var(--color-danger)]/40",
    },
  },
  defaultVariants: { intent: "neutral" },
});

export interface ToastProps
  extends
    React.ComponentPropsWithoutRef<typeof ToastPrimitive.Root>,
    VariantProps<typeof toastVariants> {}

export const Toast = React.forwardRef<
  React.ElementRef<typeof ToastPrimitive.Root>,
  ToastProps
>(function Toast({ className, intent, ...props }, ref) {
  return (
    <ToastPrimitive.Root
      ref={ref}
      className={cn(toastVariants({ intent }), className)}
      {...props}
    />
  );
});

export const ToastTitle = React.forwardRef<
  React.ElementRef<typeof ToastPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitive.Title>
>(function ToastTitle({ className, ...props }, ref) {
  return (
    <ToastPrimitive.Title
      ref={ref}
      className={cn("text-sm font-semibold text-fg", className)}
      {...props}
    />
  );
});

export const ToastDescription = React.forwardRef<
  React.ElementRef<typeof ToastPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitive.Description>
>(function ToastDescription({ className, ...props }, ref) {
  return (
    <ToastPrimitive.Description
      ref={ref}
      className={cn("text-sm text-fg-muted", className)}
      {...props}
    />
  );
});

export const ToastClose = React.forwardRef<
  React.ElementRef<typeof ToastPrimitive.Close>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitive.Close>
>(function ToastClose({ className, ...props }, ref) {
  return (
    <ToastPrimitive.Close
      ref={ref}
      aria-label="Close"
      className={cn(
        "absolute end-2 top-2 inline-flex size-6 items-center justify-center rounded text-fg-subtle transition-colors hover:text-fg",
        className,
      )}
      {...props}
    >
      <X className="size-4" aria-hidden="true" />
    </ToastPrimitive.Close>
  );
});
