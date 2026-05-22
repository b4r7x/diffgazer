"use client";

import { useCallback, useMemo, useRef, type ReactNode, type Ref, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { useNavigation } from "@/hooks/use-navigation";
import { useControllableState } from "@/hooks/use-controllable-state";
import { useFormReset } from "@/hooks/use-form-reset";
import { useFloatingIndicator } from "@/hooks/use-floating-indicator";
import { composeRefs } from "@/lib/compose-refs";
import {
  getEnabledSelectableCollectionItems,
  getSelectableCollectionItemValue,
  resolveSelectableCollectionItemValue,
  useSelectableCollection,
} from "@/lib/selectable-collection";
import {
  segmentedContainerVariants,
  segmentedPillIndicatorClass,
  segmentedUnderlineIndicatorClass,
  type SegmentedSize,
  type SegmentedVariant,
} from "@/lib/segmented-variants";
import { cn } from "@/lib/utils";
import { ToggleGroupContext, type ToggleGroupSelectionMode } from "./toggle-group-context";

interface ToggleGroupSingleProps<TValue extends string = string> {
  selectionMode?: "single" | undefined;
  value?: TValue | null;
  defaultValue?: TValue | null;
  onChange?: (value: TValue | null) => void;
}

interface ToggleGroupMultipleProps<TValue extends string = string> {
  selectionMode: "multiple";
  value?: readonly TValue[];
  defaultValue?: readonly TValue[];
  onChange?: (value: readonly TValue[]) => void;
}

interface ToggleGroupBaseProps<TValue extends string = string> {
  allowDeselect?: boolean;
  disabled?: boolean;
  size?: SegmentedSize;
  /**
   * Visual variant.
   *   - `default` — bordered button row; active = inverted block.
   *   - `bracket` — frameless, active item wears `[ … ]` markers.
   *   - `pill`    — joined track with a single sliding indicator.
   *   - `underline` — gapped row with a foreground underline on the active item.
   */
  variant?: SegmentedVariant;
  orientation?: "horizontal" | "vertical";
  wrap?: boolean;
  highlighted?: TValue | null;
  onHighlightChange?: (value: TValue | null) => void;
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

export type ToggleGroupProps<TValue extends string = string> =
  & ToggleGroupBaseProps<TValue>
  & (ToggleGroupSingleProps<TValue> | ToggleGroupMultipleProps<TValue>);

export function ToggleGroup<TValue extends string = string>(props: ToggleGroupProps<TValue>) {
  const {
    allowDeselect = false,
    disabled = false,
    size = "sm",
    variant = "default",
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

  // Public props narrow on TValue; internal state stays string-typed because the
  // selectable-collection layer keys items by data-value strings.
  const singleProps = selectionMode === "single" ? (props as ToggleGroupSingleProps) : null;
  const multipleProps = selectionMode === "multiple" ? (props as ToggleGroupMultipleProps) : null;

  const [singleValue, setSingleValue, isSingleControlled] = useControllableState<string | null>({
    value: singleProps?.value,
    defaultValue: singleProps?.defaultValue ?? null,
    onChange: singleProps?.onChange as ((value: string | null) => void) | undefined,
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
    onChange: multipleProps?.onChange as ((value: readonly string[]) => void) | undefined,
  });

  const [highlightedValue, setHighlightedValue] = useControllableState<string | null>({
    value: controlledHighlighted,
    defaultValue: null,
    onChange: onHighlightChange as ((value: string | null) => void) | undefined,
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
        setMultipleValue((prev) =>
          prev.includes(newValue)
            ? prev.filter((v) => v !== newValue)
            : [...prev, newValue],
        );
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
    variant,
    highlightedValue: activeHighlightedValue,
    containerRef,
    usesButtonSemantics,
    tabTargetValue,
    registerItem,
    unregisterItem,
  }), [selectionMode, isItemSelected, handleValueChange, setHighlightedValue, disabled, size, variant, activeHighlightedValue, usesButtonSemantics, tabTargetValue, registerItem, unregisterItem]);

  // Pill variant: a single absolutely-positioned indicator tracks the active
  // item's rect. The hook is null-fed for `selectionMode="multiple"` (which
  // uses button semantics with no single-active concept) and when the variant
  // doesn't use a pill indicator, so the observer is never created.
  const pillTargetValue =
    variant === "pill" && selectionMode === "single" ? singleValue : null;
  const pillRect = useFloatingIndicator(containerRef, pillTargetValue);

  const underlineTargetValue =
    variant === "underline" && selectionMode === "single" ? singleValue : null;
  const underlineRect = useFloatingIndicator(containerRef, underlineTargetValue);

  const hiddenInputValue = selectionMode === "single" && name ? singleValue : null;

  return (
    <ToggleGroupContext value={contextValue}>
      <div
        ref={composeRefs(containerRef, ref)}
        role={usesButtonSemantics ? "group" : "radiogroup"}
        data-diffgazer-selectable-owner={usesButtonSemantics ? "toggle" : "radio"}
        data-variant={variant}
        data-orientation={orientation}
        aria-label={label}
        aria-labelledby={ariaLabelledBy}
        aria-orientation={usesButtonSemantics ? undefined : orientation}
        aria-disabled={disabled || undefined}
        onKeyDown={handleKeyDown}
        className={cn(
          segmentedContainerVariants({ variant, orientation }),
          "w-fit",
          wrap && orientation === "horizontal" && variant !== "pill" && "flex-wrap",
          className,
        )}
      >
        {variant === "pill" && pillRect && (
          <span
            aria-hidden="true"
            data-slot="toggle-group-pill"
            className={segmentedPillIndicatorClass}
            style={{ left: pillRect.left, width: pillRect.width }}
          />
        )}
        {variant === "underline" && underlineRect && (
          <span
            aria-hidden="true"
            data-slot="toggle-group-underline"
            className={segmentedUnderlineIndicatorClass}
            style={
              orientation === "vertical"
                ? { top: underlineRect.top, height: underlineRect.height, right: 0, width: 1 }
                : { left: underlineRect.left, width: underlineRect.width, bottom: 0, height: 1 }
            }
          />
        )}
        {hiddenInputValue != null && (
          <input type="hidden" name={name} value={hiddenInputValue} disabled={disabled} />
        )}
        {children}
      </div>
    </ToggleGroupContext>
  );
}
