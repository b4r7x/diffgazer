"use client";

import { useMemo, useRef, type ReactNode, type Ref, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { useNavigation } from "@/hooks/use-navigation";
import { useControllableState } from "@/hooks/use-controllable-state";
import { composeRefs } from "@/lib/compose-refs";
import { cn } from "@/lib/utils";
import type { RadioSize } from "./radio";
import type { SelectableVariant } from "@/lib/selectable-variants";
import { RadioGroupContext, type RadioGroupContextValue } from "./radio-group-context";

export interface RadioGroupProps {
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  onHighlightChange?: (value: string) => void;
  onKeyDown?: (event: ReactKeyboardEvent) => void;
  highlighted?: string | null;
  orientation?: "vertical" | "horizontal";
  wrap?: boolean;
  disabled?: boolean;
  size?: RadioSize;
  variant?: SelectableVariant;
  name?: string;
  required?: boolean;
  label?: string;
  labelledBy?: string;
  className?: string;
  children: ReactNode;
  ref?: Ref<HTMLDivElement>;
}

export function RadioGroup({
  value: controlledValue,
  defaultValue,
  onChange,
  onHighlightChange,
  onKeyDown,
  highlighted: controlledHighlighted,
  orientation = "vertical",
  wrap = true,
  disabled = false,
  size = "md",
  variant = "bullet",
  name,
  required,
  label,
  labelledBy,
  className,
  children,
  ref,
}: RadioGroupProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  const [value, setValue] = useControllableState<string | undefined>({
    value: controlledValue,
    defaultValue,
    onChange: onChange as ((value: string | undefined) => void) | undefined,
  });
  const [highlightedValue, setHighlightedValue] = useControllableState<string | null>({
    value: controlledHighlighted,
    defaultValue: null,
    onChange: onHighlightChange as ((value: string | null) => void) | undefined,
  });

  const { onKeyDown: navKeyDown } = useNavigation({
    containerRef,
    role: "radio",
    orientation,
    wrap,
    moveFocus: true,
    upKeys: ["ArrowUp", "ArrowLeft"],
    downKeys: ["ArrowDown", "ArrowRight"],
    value: highlightedValue ?? undefined,
    onValueChange: (next) => {
      setHighlightedValue(next);
      setValue(next);
    },
  });

  const handleKeyDown = (e: ReactKeyboardEvent) => {
    onKeyDown?.(e);
    if (!e.defaultPrevented) navKeyDown(e);
  };

  const contextValue: RadioGroupContextValue = useMemo(() => ({
    value,
    onChange: setValue,
    onHighlightChange: setHighlightedValue,
    disabled,
    size,
    variant,
    highlightedValue,
    name,
    required,
    containerRef,
  }), [value, setValue, setHighlightedValue, disabled, size, variant, highlightedValue, name, required]);

  return (
    <RadioGroupContext value={contextValue}>
      <div
        ref={composeRefs(containerRef, ref)}
        role="radiogroup"
        aria-label={label}
        aria-labelledby={labelledBy}
        aria-orientation={orientation}
        aria-required={required || undefined}
        aria-disabled={disabled || undefined}
        className={cn(
          "flex",
          orientation === "vertical" ? "flex-col gap-2" : "flex-row gap-4",
          className
        )}
        onKeyDown={handleKeyDown}
      >
        {children}
      </div>
    </RadioGroupContext>
  );
}
