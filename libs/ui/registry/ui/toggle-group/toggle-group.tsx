"use client";

import { useCallback, useMemo, useRef, type ReactNode, type Ref, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { useNavigation } from "@/hooks/use-navigation";
import { useControllableState } from "@/hooks/use-controllable-state";
import { useFormReset } from "@/hooks/use-form-reset";
import { composeRefs } from "@/lib/compose-refs";
import {
  getEnabledSelectableCollectionItems,
  getSelectableCollectionItemValue,
  resolveSelectableCollectionItemValue,
  useSelectableCollection,
} from "@/lib/selectable-collection";
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
  name?: string;
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
  name,
  className,
  children,
  ref,
}: ToggleGroupProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const { items, registerItem, unregisterItem } = useSelectableCollection(containerRef);

  const [value, setValue, isControlled] = useControllableState<string | null>({
    value: controlledValue,
    defaultValue: defaultValue ?? null,
    onChange,
  });
  useFormReset(containerRef, defaultValue ?? null, setValue, !isControlled);

  const [highlightedValue, setHighlightedValue] = useControllableState<string | null>({
    value: controlledHighlighted,
    defaultValue: null,
    onChange: onHighlightChange,
  });

  const handleValueChange = useCallback((newValue: string) => {
    setValue((prev) => (prev === newValue && allowDeselect) ? null : newValue);
  }, [allowDeselect, setValue]);

  const enabledItems = getEnabledSelectableCollectionItems(items, disabled);
  const validHighlightedValue = getSelectableCollectionItemValue(enabledItems, highlightedValue);
  const tabTargetValue = resolveSelectableCollectionItemValue(enabledItems, highlightedValue, value);

  const { onKeyDown: navKeyDown } = useNavigation({
    containerRef,
    role: allowDeselect ? "button" : "radio",
    orientation,
    wrap,
    moveFocus: true,
    upKeys: ["ArrowUp", "ArrowLeft"],
    downKeys: ["ArrowDown", "ArrowRight"],
    highlighted: tabTargetValue,
    enabled: !disabled,
    onHighlightChange: allowDeselect ? setHighlightedValue : handleValueChange,
    scopeToContainer: true,
    ownerSelector: allowDeselect ? '[data-diffgazer-selectable-owner="toggle"]' : undefined,
  });

  const handleKeyDown = (e: ReactKeyboardEvent) => {
    onKeyDown?.(e);
    if (e.defaultPrevented) return;
    navKeyDown(e);
  };

  const contextValue = useMemo(() => ({
    value,
    onChange: handleValueChange,
    onHighlightChange: setHighlightedValue,
    disabled,
    size,
    highlightedValue: validHighlightedValue,
    containerRef,
    allowDeselect,
    tabTargetValue,
    registerItem,
    unregisterItem,
  }), [value, handleValueChange, setHighlightedValue, disabled, size, validHighlightedValue, allowDeselect, tabTargetValue, registerItem, unregisterItem]);

  return (
    <ToggleGroupContext value={contextValue}>
      <div
        ref={composeRefs(containerRef, ref)}
        role={allowDeselect ? "group" : "radiogroup"}
        data-diffgazer-selectable-owner={allowDeselect ? "toggle" : "radio"}
        aria-label={label}
        aria-labelledby={ariaLabelledBy}
        aria-orientation={allowDeselect ? undefined : orientation}
        aria-disabled={disabled || undefined}
        onKeyDown={handleKeyDown}
        className={cn(
          "flex",
          orientation === "vertical" ? "flex-col gap-1.5" : "gap-1.5",
          wrap && orientation === "horizontal" && "flex-wrap",
          className,
        )}
      >
        {name && value != null && (
          <input type="hidden" name={name} value={value} disabled={disabled} />
        )}
        {children}
      </div>
    </ToggleGroupContext>
  );
}
