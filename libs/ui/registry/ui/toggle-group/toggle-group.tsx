"use client";

import { useEffectEvent, useMemo, useRef, type ReactNode, type Ref, type KeyboardEvent as ReactKeyboardEvent } from "react";
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

  const handleValueChange = useEffectEvent((newValue: string) => {
    setValue((prev) => (prev === newValue && allowDeselect) ? null : newValue);
  });

  const { onKeyDown: navKeyDown } = useNavigation({
    containerRef,
    role: "radio",
    orientation,
    wrap,
    moveFocus: true,
    value: highlightedValue ?? undefined,
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
  }), [value, disabled, size, highlightedValue]);

  return (
    <ToggleGroupContext value={contextValue}>
      <div
        ref={composeRefs(containerRef, ref)}
        role="radiogroup"
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
