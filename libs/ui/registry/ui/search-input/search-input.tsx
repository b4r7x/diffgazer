"use client";

import type { InputHTMLAttributes, KeyboardEvent, ReactNode, Ref } from "react";
import { cva } from "class-variance-authority";
import { cn } from "@/lib/utils";
import { useControllableState } from "@/hooks/use-controllable-state";

const searchInputVariants = cva(
  "flex items-center gap-2 bg-background border-x border-b border-border font-mono shrink-0 transition-colors focus-within:border-foreground",
  {
    variants: {
      size: {
        sm: "p-2 text-xs",
        md: "p-3 text-sm",
        lg: "p-3 text-base",
      },
      error: {
        true: "border-destructive",
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
  error?: boolean;
  invalid?: boolean;
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
  error,
  invalid,
  disabled,
  "aria-label": ariaLabel,
  "aria-invalid": ariaInvalid,
  ...rest
}: SearchInputProps) {
  const isInvalid = invalid ?? error ?? ariaInvalid;
  const [current, setValue] = useControllableState({
    value,
    defaultValue: defaultValue ?? "",
    onChange,
  });

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape") {
      e.preventDefault();
      onEscape?.();
    } else if (e.key === "Enter" && onEnter) {
      e.preventDefault();
      onEnter();
    }
    onKeyDown?.(e);
  };

  return (
    <search
      className={cn(
        searchInputVariants({ size, error: !!isInvalid, disabled }),
        className,
      )}
    >
      {prefix}
      <input
        ref={ref}
        type="search"
        value={current}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        aria-label={ariaLabel ?? placeholder}
        aria-invalid={isInvalid || undefined}
        disabled={disabled}
        {...rest}
        className="flex-1 bg-transparent font-mono text-foreground placeholder:text-foreground/50 focus:outline-none disabled:cursor-not-allowed [&::-webkit-search-cancel-button]:appearance-none"
      />
    </search>
  );
}
