"use client";

import { useRef, type InputHTMLAttributes, type KeyboardEvent, type ReactNode, type Ref } from "react";
import { cva } from "class-variance-authority";
import { cn } from "@/lib/utils";
import { useControllableState } from "@/hooks/use-controllable-state";
import { useFormReset } from "@/hooks/use-form-reset";
import { composeRefs } from "@/lib/compose-refs";

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

function resolveInvalidState(
  invalid: boolean | undefined,
  error: boolean | undefined,
  ariaInvalid: InputHTMLAttributes<HTMLInputElement>["aria-invalid"],
) {
  if (invalid || error) return { isInvalid: true, ariaInvalid: true };

  if (ariaInvalid === true || ariaInvalid === "true" || ariaInvalid === "grammar" || ariaInvalid === "spelling") {
    return { isInvalid: true, ariaInvalid };
  }

  if (ariaInvalid === false || ariaInvalid === "false") {
    return { isInvalid: false, ariaInvalid };
  }

  return { isInvalid: false, ariaInvalid: undefined };
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
  const invalidState = resolveInvalidState(invalid, error, ariaInvalid);
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
    <search
      className={cn(
        searchInputVariants({ size, error: invalidState.isInvalid, disabled }),
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
        aria-invalid={invalidState.ariaInvalid}
        disabled={disabled}
        {...rest}
        className="flex-1 bg-transparent font-mono text-foreground placeholder:text-foreground/50 focus:outline-none disabled:cursor-not-allowed [&::-webkit-search-cancel-button]:appearance-none"
      />
    </search>
  );
}
