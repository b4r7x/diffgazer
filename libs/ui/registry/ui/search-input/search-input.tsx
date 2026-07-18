"use client";

import { cva } from "class-variance-authority";
import {
  type InputHTMLAttributes,
  type KeyboardEvent,
  type ReactNode,
  type Ref,
  useRef,
} from "react";
import { useComposedRefs } from "@/hooks/use-composed-refs";
import { useControllableState } from "@/hooks/use-controllable-state";
import { useFormReset } from "@/hooks/use-form-reset";
import { cn } from "@/lib/utils";

const searchInputVariants = cva(
  "flex items-center gap-2 bg-background border border-border font-mono shrink-0 transition-colors motion-reduce:transition-none focus-within:border-foreground has-[input[aria-invalid=true]]:border-error",
  {
    variants: {
      size: {
        sm: "p-2 text-xs",
        md: "p-3 text-sm",
        lg: "p-3 text-base",
      },
      disabled: {
        true: "opacity-50 pointer-events-none",
      },
    },
    defaultVariants: { size: "md" },
  },
);

const defaultPrefix = (
  <span className="text-foreground font-bold" aria-hidden="true">
    /
  </span>
);

/** Props for search input. */
export interface SearchInputProps
  extends Omit<
    InputHTMLAttributes<HTMLInputElement>,
    "value" | "defaultValue" | "onChange" | "type" | "size" | "prefix"
  > {
  /** Controlled search value. */
  value?: string;
  /** Initial search value for uncontrolled usage. */
  defaultValue?: string;
  /** Called with the next search value when the native input changes. */
  onChange?: (value: string) => void;
  /** Called when Escape is pressed and the event was not already handled. */
  onEscape?: () => void;
  /** Called when Enter is pressed and the event was not already handled. */
  onEnter?: () => void;
  /** Prefix content before the input. Pass null to hide it. */
  prefix?: ReactNode;
  /** Padding/font size token for the search wrapper. */
  size?: "sm" | "md" | "lg";
  /** Ref forwarded to the underlying element. */
  ref?: Ref<HTMLInputElement>;
}

/**
 * Terminal-styled search input with / prefix and keyboard event callbacks. Supports controlled
 * and uncontrolled modes.
 */
export function SearchInput({
  value,
  defaultValue,
  onChange,
  onEscape,
  onEnter,
  onKeyDown,
  placeholder = "Search...",
  prefix = defaultPrefix,
  className,
  ref,
  size,
  disabled,
  "aria-label": ariaLabel,
  "aria-labelledby": ariaLabelledBy,
  id,
  ...rest
}: SearchInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const composedRef = useComposedRefs(inputRef, ref);
  const [current, setValue, , resetValue] = useControllableState({
    value,
    defaultValue: defaultValue ?? "",
    onChange,
  });
  const invalidatePendingReset = useFormReset(
    inputRef,
    defaultValue ?? "",
    resetValue,
    value === undefined,
  );

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    onKeyDown?.(e);
    if (e.defaultPrevented) return;
    if (e.nativeEvent.isComposing || e.nativeEvent.keyCode === 229) return;

    if (e.key === "Escape") {
      // Only consume Escape when it does something: clear a non-empty value, or
      // call onEscape. An untouched Escape on an empty input must propagate so the
      // native search clear and a wrapping <dialog> cancel still work.
      if (current.length > 0) {
        e.preventDefault();
        invalidatePendingReset();
        setValue("");
      } else if (onEscape) {
        e.preventDefault();
        onEscape();
      }
    } else if (e.key === "Enter" && onEnter) {
      e.preventDefault();
      onEnter();
    }
  };

  return (
    <div
      data-slot="search-input"
      className={cn(searchInputVariants({ size, disabled }), className)}
    >
      {prefix}
      <input
        ref={composedRef}
        data-slot="search-input-control"
        type="search"
        value={current}
        onChange={(e) => {
          invalidatePendingReset();
          setValue(e.target.value);
        }}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        id={id}
        aria-label={ariaLabel ?? (!id && !ariaLabelledBy ? placeholder : undefined)}
        aria-labelledby={ariaLabelledBy}
        disabled={disabled}
        {...rest}
        className="flex-1 bg-transparent font-mono text-foreground placeholder:text-foreground/55 focus:outline-none disabled:cursor-not-allowed [&::-webkit-search-cancel-button]:appearance-none"
      />
    </div>
  );
}
