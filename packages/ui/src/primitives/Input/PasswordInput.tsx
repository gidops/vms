import { Eye, EyeOff } from "lucide-react";
import * as React from "react";
import { cn } from "../../foundations/cn";
import { Input, type InputProps } from "./Input";

export interface PasswordInputProps extends Omit<InputProps, "type"> {
  /** Accessible label for the toggle while the password is hidden. */
  showLabel?: string;
  /** Accessible label for the toggle while the password is visible. */
  hideLabel?: string;
}

/** The eye toggle is a real button (aria-pressed) that never submits the form. */
export const PasswordInput = React.forwardRef<
  HTMLInputElement,
  PasswordInputProps
>(function PasswordInput(
  {
    className,
    showLabel = "Show password",
    hideLabel = "Hide password",
    disabled,
    ...props
  },
  ref,
) {
  const [visible, setVisible] = React.useState(false);
  const Icon = visible ? EyeOff : Eye;
  return (
    <div className="relative w-full">
      <Input
        ref={ref}
        type={visible ? "text" : "password"}
        disabled={disabled}
        className={cn("pe-10", className)}
        {...props}
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        disabled={disabled}
        aria-pressed={visible}
        aria-label={visible ? hideLabel : showLabel}
        className="absolute inset-y-0 end-0 flex w-10 items-center justify-center rounded-e-md text-fg-subtle outline-none transition-colors hover:text-fg focus-visible:ring-2 focus-visible:ring-[var(--color-ring)] disabled:pointer-events-none disabled:opacity-50"
      >
        <Icon className="size-4" aria-hidden="true" />
      </button>
    </div>
  );
});
