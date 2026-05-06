"use client";

import { useCallback, useMemo, useRef, useState, type ReactNode, type Ref, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { useNavigation } from "@/hooks/use-navigation";
import { useControllableState } from "@/hooks/use-controllable-state";
import { composeRefs } from "@/lib/compose-refs";
import { cn } from "@/lib/utils";
import { ToggleGroupContext } from "./toggle-group-context";

export interface ToggleGroupProps {
  value?: string | null;
  defaultValue?: string | null;
  onChange?: (value: string | null) => void;
  allowDeselect?: boolean;
  disabled?: boolean;
  size?: "sm" | "md";
  orientation?: "horizontal" | "vertical";
  wrap?: boolean;
  highlighted?: string | null;
  onHighlightChange?: (value: string | null) => void;
  onKeyDown?: (event: ReactKeyboardEvent) => void;
  label?: string;
  "aria-labelledby"?: string;
  className?: string;
  children: ReactNode;
  ref?: Ref<HTMLDivElement>;
}

export function ToggleGroup({
  value: controlledValue,
  defaultValue,
  onChange,
  allowDeselect = false,
  disabled = false,
  size = "sm",
  orientation = "horizontal",
  wrap = true,
  highlighted: controlledHighlighted,
  onHighlightChange,
  onKeyDown,
  label,
  "aria-labelledby": ariaLabelledBy,
  className,
  children,
  ref,
}: ToggleGroupProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [items, setItems] = useState<Array<{ value: string; disabled: boolean }>>([]);

  const [value, setValue] = useControllableState<string | null>({
    value: controlledValue,
    defaultValue: defaultValue ?? null,
    onChange,
  });

  const [highlightedValue, setHighlightedValue] = useControllableState<string | null>({
    value: controlledHighlighted,
    defaultValue: null,
    onChange: onHighlightChange,
  });

  const handleValueChange = useCallback((newValue: string) => {
    setValue((prev) => (prev === newValue && allowDeselect) ? null : newValue);
  }, [allowDeselect, setValue]);

  const registerItem = useCallback((itemValue: string, itemDisabled: boolean) => {
    setItems((current) => {
      const index = current.findIndex((item) => item.value === itemValue);
      if (index === -1) return [...current, { value: itemValue, disabled: itemDisabled }];
      const next = [...current];
      next[index] = { value: itemValue, disabled: itemDisabled };
      return next;
    });
    return () => {
      setItems((current) => current.filter((item) => item.value !== itemValue));
    };
  }, []);

  const firstEnabledValue = items.find((item) => !item.disabled)?.value ?? null;

  const { onKeyDown: navKeyDown } = useNavigation({
    containerRef,
    role: allowDeselect ? "button" : "radio",
    orientation,
    wrap,
    moveFocus: true,
    value: highlightedValue,
    enabled: !disabled,
    onValueChange: handleValueChange,
  });

  const handleKeyDown = (e: ReactKeyboardEvent) => {
    // Support 4-directional arrow navigation regardless of orientation
    const crossAxisMap: Record<string, string> = orientation === "horizontal"
      ? { ArrowUp: "ArrowLeft", ArrowDown: "ArrowRight" }
      : { ArrowLeft: "ArrowUp", ArrowRight: "ArrowDown" };

    const mappedKey = crossAxisMap[e.key];
    if (mappedKey) {
      const syntheticEvent = Object.create(e, {
        key: { value: mappedKey },
      }) as ReactKeyboardEvent;
      navKeyDown(syntheticEvent);
    } else {
      navKeyDown(e);
    }
    onKeyDown?.(e);
  };

  const contextValue = useMemo(() => ({
    value,
    onChange: handleValueChange,
    onHighlightChange: setHighlightedValue,
    disabled,
    size,
    highlightedValue,
    containerRef,
    allowDeselect,
    firstEnabledValue,
    registerItem,
  }), [value, handleValueChange, setHighlightedValue, disabled, size, highlightedValue, allowDeselect, firstEnabledValue, registerItem]);

  return (
    <ToggleGroupContext value={contextValue}>
      <div
        ref={composeRefs(containerRef, ref)}
        role={allowDeselect ? "group" : "radiogroup"}
        aria-label={label}
        aria-labelledby={ariaLabelledBy}
        aria-orientation={orientation}
        aria-disabled={disabled || undefined}
        onKeyDown={handleKeyDown}
        className={cn(
          "flex",
          orientation === "vertical" ? "flex-col gap-1.5" : "gap-1.5",
          wrap && orientation === "horizontal" && "flex-wrap",
          className,
        )}
      >
        {children}
      </div>
    </ToggleGroupContext>
  );
}
