import { Search, X } from "lucide-react";
import * as React from "react";
import { cn } from "../../foundations/cn";
import { Input, type InputProps } from "../../primitives/Input/Input";
import {
  searchInputVariants,
  type SearchInputVariantProps,
} from "./SearchInput.variants";

export interface SearchInputProps extends InputProps, SearchInputVariantProps {
  /** When provided and the field has a value, renders a clear button. */
  onClear?: () => void;
}

export const SearchInput = React.forwardRef<HTMLInputElement, SearchInputProps>(
  function SearchInput({ className, onClear, value, variant, ...props }, ref) {
    const s = searchInputVariants({ variant });
    const showClear = !!onClear && value != null && String(value).length > 0;
    return (
      <div className="relative w-full">
        <Search className={s.icon()} aria-hidden="true" />
        <Input
          ref={ref}
          type="search"
          value={value}
          className={cn(s.input(), showClear && "pe-9", className)}
          {...props}
        />
        {showClear ? (
          <button
            type="button"
            onClick={onClear}
            aria-label="Clear search"
            className={s.clear()}
          >
            <X className="size-4" aria-hidden="true" />
          </button>
        ) : null}
      </div>
    );
  },
);
