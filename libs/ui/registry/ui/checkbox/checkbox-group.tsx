"use client";

import { useCallback, useMemo, useRef, type KeyboardEvent as ReactKeyboardEvent, type ReactNode, type Ref } from "react";
import { useNavigation } from "@/hooks/use-navigation";
import { useControllableState } from "@/hooks/use-controllable-state";
import { composeRefs } from "@/lib/compose-refs";
import { cn } from "@/lib/utils";
import type { SelectableVariant } from "@/lib/selectable-variants";
import type { CheckboxSize } from "./checkbox";
import { CheckboxGroupContext } from "./checkbox-group-context";

export type CheckboxGroupProps<T extends string = string> = {
  value?: T[];
  defaultValue?: T[];
  onChange?: (value: T[]) => void;
  onHighlightChange?: (value: string) => void;
  onKeyDown?: (event: ReactKeyboardEvent) => void;
  highlighted?: string | null;
  wrap?: boolean;
  disabled?: boolean;
  size?: CheckboxSize;
  variant?: SelectableVariant;
  strikethrough?: boolean;
  name?: string;
  required?: boolean;
  className?: string;
  label?: string;
  labelledBy?: string;
  children: ReactNode;
  ref?: Ref<HTMLDivElement>;
};

export function CheckboxGroup<T extends string = string>({
  value: controlledValue,
  defaultValue = [] as T[],
  onChange,
  onHighlightChange,
  onKeyDown,
  highlighted: controlledHighlighted,
  wrap = true,
  disabled = false,
  size = "md",
  variant = "x",
  strikethrough = false,
  name,
  required,
  className,
  label,
  labelledBy,
  children,
  ref,
}: CheckboxGroupProps<T>) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [value, setValue] = useControllableState<T[]>({
    value: controlledValue,
    defaultValue,
    onChange,
  });

  const [highlightedValue, setHighlightedValue] = useControllableState<string | null>({
    value: controlledHighlighted,
    defaultValue: null,
    onChange: onHighlightChange as ((value: string | null) => void) | undefined,
  });

  const { onKeyDown: navKeyDown } = useNavigation({
    containerRef,
    role: "checkbox",
    wrap,
    value: highlightedValue ?? undefined,
    onValueChange: setHighlightedValue,
  });

  const handleHighlightChange = useCallback((value: string) => setHighlightedValue(value), [setHighlightedValue]);

  const toggle = useCallback((itemValue: string) => {
    if (disabled) return;
    const typed = itemValue as T;
    setValue((cur) => (cur.includes(typed) ? cur.filter((v) => v !== typed) : [...cur, typed]));
  }, [disabled, setValue]);

  const handleKeyDown = (e: ReactKeyboardEvent) => {
    onKeyDown?.(e);
    if (!e.defaultPrevented && e.key !== " ") navKeyDown(e);
  };

  const contextValue = useMemo(() => ({ value, toggle, disabled, size, variant, strikethrough, onHighlightChange: handleHighlightChange, highlightedValue: highlightedValue ?? null, name, required }), [value, toggle, disabled, size, variant, strikethrough, handleHighlightChange, highlightedValue, name, required]);

  return (
    <CheckboxGroupContext value={contextValue}>
      <div
        ref={composeRefs(containerRef, ref)}
        role="group"
        aria-label={label}
        aria-labelledby={labelledBy}
        aria-disabled={disabled || undefined}
        aria-required={required || undefined}
        className={cn("flex flex-col gap-2", className)}
        onKeyDown={handleKeyDown}
      >
        {required && (
          <input
            type="checkbox"
            required
            checked={value.length > 0}
            disabled={disabled}
            tabIndex={-1}
            aria-hidden="true"
            readOnly
            className="sr-only"
          />
        )}
        {children}
      </div>
    </CheckboxGroupContext>
  );
}
