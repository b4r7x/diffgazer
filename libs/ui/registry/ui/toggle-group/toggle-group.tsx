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
import { ToggleGroupContext, type ToggleGroupSelectionMode } from "./toggle-group-context";

interface ToggleGroupSingleProps {
  selectionMode?: "single" | undefined;
  value?: string | null;
  defaultValue?: string | null;
  onChange?: (value: string | null) => void;
}

interface ToggleGroupMultipleProps {
  selectionMode: "multiple";
  value?: readonly string[];
  defaultValue?: readonly string[];
  onChange?: (value: readonly string[]) => void;
}

interface ToggleGroupBaseProps {
  allowDeselect?: boolean;
  disabled?: boolean;
  size?: "sm" | "md";
  orientation?: "horizontal" | "vertical";
  wrap?: boolean;
  highlighted?: string | null;
  onHighlightChange?: (value: string | null) => void;
  onNavigationBoundaryReached?: (
    direction: "previous" | "next",
    event: globalThis.KeyboardEvent,
    key: string,
  ) => void;
  onKeyDown?: (event: ReactKeyboardEvent) => void;
  label?: string;
  "aria-labelledby"?: string;
  name?: string;
  className?: string;
  children: ReactNode;
  ref?: Ref<HTMLDivElement>;
}

export type ToggleGroupProps = ToggleGroupBaseProps & (ToggleGroupSingleProps | ToggleGroupMultipleProps);

function arraysEqual(a: readonly string[], b: readonly string[]): boolean {
  if (a === b) return true;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

export function ToggleGroup(props: ToggleGroupProps) {
  const {
    allowDeselect = false,
    disabled = false,
    size = "sm",
    orientation = "horizontal",
    wrap = true,
    highlighted: controlledHighlighted,
    onHighlightChange,
    onNavigationBoundaryReached,
    onKeyDown,
    label,
    "aria-labelledby": ariaLabelledBy,
    name,
    className,
    children,
    ref,
  } = props;
  const selectionMode: ToggleGroupSelectionMode = props.selectionMode ?? "single";

  const containerRef = useRef<HTMLDivElement>(null);
  const { items, registerItem, unregisterItem } = useSelectableCollection(containerRef);

  const singleProps = selectionMode === "single" ? (props as ToggleGroupSingleProps) : null;
  const multipleProps = selectionMode === "multiple" ? (props as ToggleGroupMultipleProps) : null;

  const [singleValue, setSingleValue, isSingleControlled] = useControllableState<string | null>({
    value: singleProps?.value,
    defaultValue: singleProps?.defaultValue ?? null,
    onChange: singleProps?.onChange,
  });
  useFormReset(
    containerRef,
    singleProps?.defaultValue ?? null,
    setSingleValue,
    !isSingleControlled && selectionMode === "single",
  );

  const [multipleValue, setMultipleValue] = useControllableState<readonly string[]>({
    value: multipleProps?.value,
    defaultValue: multipleProps?.defaultValue ?? [],
    onChange: multipleProps?.onChange,
  });

  const [highlightedValue, setHighlightedValue] = useControllableState<string | null>({
    value: controlledHighlighted,
    defaultValue: null,
    onChange: onHighlightChange,
  });

  const usesButtonSemantics = selectionMode === "multiple" || allowDeselect;

  const isItemSelected = useCallback(
    (value: string): boolean => {
      if (selectionMode === "multiple") {
        return multipleValue.includes(value);
      }
      return singleValue === value;
    },
    [selectionMode, multipleValue, singleValue],
  );

  const handleValueChange = useCallback(
    (newValue: string | null) => {
      if (newValue === null) return;
      if (selectionMode === "multiple") {
        setMultipleValue((prev) => {
          const next = prev.includes(newValue)
            ? prev.filter((v) => v !== newValue)
            : [...prev, newValue];
          return arraysEqual(prev, next) ? prev : next;
        });
        return;
      }
      setSingleValue((prev) => (prev === newValue && allowDeselect) ? null : newValue);
    },
    [allowDeselect, selectionMode, setMultipleValue, setSingleValue],
  );

  const enabledItems = getEnabledSelectableCollectionItems(items, disabled);
  const activeHighlightedValue = getSelectableCollectionItemValue(enabledItems, highlightedValue);
  const selectedAnchor = selectionMode === "single" ? singleValue : null;
  const tabTargetValue = resolveSelectableCollectionItemValue(enabledItems, highlightedValue, selectedAnchor);

  const { onKeyDown: navKeyDown } = useNavigation({
    containerRef,
    role: usesButtonSemantics ? "button" : "radio",
    orientation,
    wrap,
    moveFocus: true,
    upKeys: ["ArrowUp", "ArrowLeft"],
    downKeys: ["ArrowDown", "ArrowRight"],
    highlighted: tabTargetValue,
    enabled: !disabled,
    onHighlightChange: usesButtonSemantics ? setHighlightedValue : handleValueChange,
    onNavigationBoundaryReached,
    scopeToContainer: true,
    ownerSelector: usesButtonSemantics ? '[data-diffgazer-selectable-owner="toggle"]' : undefined,
  });

  const handleKeyDown = (e: ReactKeyboardEvent) => {
    onKeyDown?.(e);
    if (e.defaultPrevented) return;
    navKeyDown(e);
  };

  const contextValue = useMemo(() => ({
    selectionMode,
    isItemSelected,
    onChange: handleValueChange,
    onHighlightChange: setHighlightedValue,
    disabled,
    size,
    highlightedValue: activeHighlightedValue,
    containerRef,
    usesButtonSemantics,
    tabTargetValue,
    registerItem,
    unregisterItem,
  }), [selectionMode, isItemSelected, handleValueChange, setHighlightedValue, disabled, size, activeHighlightedValue, usesButtonSemantics, tabTargetValue, registerItem, unregisterItem]);

  const renderHiddenInput = selectionMode === "single" && name && singleValue != null;

  return (
    <ToggleGroupContext value={contextValue}>
      <div
        ref={composeRefs(containerRef, ref)}
        role={usesButtonSemantics ? "group" : "radiogroup"}
        data-diffgazer-selectable-owner={usesButtonSemantics ? "toggle" : "radio"}
        aria-label={label}
        aria-labelledby={ariaLabelledBy}
        aria-orientation={usesButtonSemantics ? undefined : orientation}
        aria-disabled={disabled || undefined}
        onKeyDown={handleKeyDown}
        className={cn(
          "flex",
          orientation === "vertical" ? "flex-col gap-1.5" : "gap-1.5",
          wrap && orientation === "horizontal" && "flex-wrap",
          className,
        )}
      >
        {renderHiddenInput && (
          <input type="hidden" name={name} value={singleValue ?? ""} disabled={disabled} />
        )}
        {children}
      </div>
    </ToggleGroupContext>
  );
}
