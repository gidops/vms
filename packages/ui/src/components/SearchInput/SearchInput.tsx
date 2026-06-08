import { Search, X } from "lucide-react";
import * as React from "react";
import { cn } from "../../foundations/cn";
import { Input, type InputProps } from "../../primitives/Input/Input";

export interface SearchInputProps extends InputProps {
  /** When provided and the field has a value, renders a clear button. */
  onClear?: () => void;
}

export const SearchInput = React.forwardRef<HTMLInputElement, SearchInputProps>(
  function SearchInput({ className, onClear, value, ...props }, ref) {
    const showClear = !!onClear && value != null && String(value).length > 0;
    return (
      <div className="relative w-full">
        <Search
          className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-fg-subtle"
          aria-hidden="true"
        />
        <Input
          ref={ref}
          type="search"
          value={value}
          className={cn("ps-9", showClear && "pe-9", className)}
          {...props}
        />
        {showClear ? (
          <button
            type="button"
            onClick={onClear}
            aria-label="Clear search"
            className="absolute end-2 top-1/2 inline-flex size-6 -translate-y-1/2 items-center justify-center rounded text-fg-subtle transition-colors hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)]"
          >
            <X className="size-4" aria-hidden="true" />
          </button>
        ) : null}
      </div>
    );
  },
);
