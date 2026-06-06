"use client";

import { cva } from "class-variance-authority";
import { type InputHTMLAttributes, type KeyboardEvent, type ReactNode, type Ref, useRef } from "react";
import { useControllableState } from "@/hooks/use-controllable-state";
import { useFormReset } from "@/hooks/use-form-reset";
import { composeRefs } from "@/lib/compose-refs";
import { cn } from "@/lib/utils";

const searchInputVariants = cva(
  "flex items-center gap-2 bg-background border border-border font-mono shrink-0 transition-colors motion-reduce:transition-none focus-within:border-foreground has-[input[aria-invalid=true]]:border-destructive",
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

const defaultPrefix = <span className="text-foreground font-bold" aria-hidden="true">/</span>;

export interface SearchInputProps
  extends Omit<
    InputHTMLAttributes<HTMLInputElement>,
    "value" | "defaultValue" | "onChange" | "type" | "size" | "prefix"
  > {
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  onEscape?: () => void;
  onEnter?: () => void;
  prefix?: ReactNode;
  size?: "sm" | "md" | "lg";
  ref?: Ref<HTMLInputElement>;
}

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
  ...rest
}: SearchInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [current, setValue] = useControllableState({
    value,
    defaultValue: defaultValue ?? "",
    onChange,
  });
  useFormReset(inputRef, defaultValue ?? "", setValue, value === undefined);

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    onKeyDown?.(e);
    if (e.defaultPrevented) return;

    if (e.key === "Escape") {
      e.preventDefault();
      onEscape?.();
    } else if (e.key === "Enter" && onEnter) {
      e.preventDefault();
      onEnter();
    }
  };

  return (
    <div
      className={cn(
        searchInputVariants({ size, disabled }),
        className,
      )}
    >
      {prefix}
      <input
        ref={composeRefs(inputRef, ref)}
        type="search"
        value={current}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        aria-label={ariaLabel ?? placeholder}
        disabled={disabled}
        {...rest}
        className="flex-1 bg-transparent font-mono text-foreground placeholder:text-foreground/50 focus:outline-none disabled:cursor-not-allowed [&::-webkit-search-cancel-button]:appearance-none"
      />
    </div>
  );
}
