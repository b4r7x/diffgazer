"use client";

import {
  Children,
  isValidElement,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
  type Ref,
  useCallback,
  useMemo,
  useRef,
  useState,
} from "react";
import { useComposedRefs } from "@/hooks/use-composed-refs";
import { useControllableState } from "@/hooks/use-controllable-state";
import { useFloatingIndicator } from "@/hooks/use-floating-indicator";
import { useFormReset } from "@/hooks/use-form-reset";
import { useNavigation } from "@/hooks/use-navigation";
import {
  type SegmentedSize,
  type SegmentedVariant,
  segmentedContainerVariants,
  segmentedPillIndicatorClass,
  segmentedUnderlineIndicatorClass,
} from "@/lib/segmented-variants";
import {
  getEnabledSelectableCollectionItems,
  useSelectableCollection,
} from "@/lib/selectable-collection";
import { cn } from "@/lib/utils";
import { ToggleGroupContext, type ToggleGroupSelectionMode } from "./toggle-group-context";
import { ToggleGroupItem } from "./toggle-group-item";

/** Props for toggle group in single-selection mode. */
interface ToggleGroupSingleProps<TValue extends string = string> {
  /**
   * Switches between radio-style single selection and pressed-button-style multiple selection.
   * Switches value/onChange/defaultValue from string|null to readonly string[].
   */
  selectionMode?: "single" | undefined;
  /** Controlled selected value(s). string|null for single mode, readonly string[] for multiple. */
  value?: TValue | null;
  /** Initial selected value(s) for uncontrolled mode. */
  defaultValue?: TValue | null;
  /** Fired when the selected value(s) change. */
  onChange?: (value: TValue | null) => void;
}

/** Props for toggle group in multiple-selection mode. */
interface ToggleGroupMultipleProps<TValue extends string = string> {
  /**
   * Switches between radio-style single selection and pressed-button-style multiple selection.
   * Switches value/onChange/defaultValue from string|null to readonly string[].
   */
  selectionMode: "multiple";
  /** Controlled selected value(s). string|null for single mode, readonly string[] for multiple. */
  value?: readonly TValue[];
  /** Initial selected value(s) for uncontrolled mode. */
  defaultValue?: readonly TValue[];
  /** Fired when the selected value(s) change. */
  onChange?: (value: readonly TValue[]) => void;
}

/** Props for toggle group base. */
interface ToggleGroupBaseProps<TValue extends string = string> {
  /** Single mode only. When true, clicking the active item deselects it (allowing a null value). */
  allowDeselect?: boolean;
  /** Disables the entire group. */
  disabled?: boolean;
  /** Item size token. */
  size?: SegmentedSize;
  /** Visual style variant. */
  variant?: SegmentedVariant;
  /** Layout axis and arrow-key navigation direction. */
  orientation?: "horizontal" | "vertical";
  /** When true, arrow navigation wraps and horizontal items flex-wrap. */
  wrap?: boolean;
  /** Controlled highlighted (focused) value for cross-component navigation. */
  highlighted?: TValue | null;
  /** Fired when the highlighted value changes. */
  onHighlightChange?: (value: TValue | null) => void;
  /** Fired when arrow navigation reaches the first/last item with wrap disabled. */
  onNavigationBoundaryReached?: (
    direction: "previous" | "next",
    event: globalThis.KeyboardEvent,
    key: string,
  ) => void;
  /** Called when key down occurs. */
  onKeyDown?: (event: ReactKeyboardEvent) => void;
  /** Accessible name for the group container. */
  label?: string;
  /** ID of the element labelling the group. */
  "aria-labelledby"?: string;
  /** Single mode only. Form field name; renders a hidden input for native form submission. */
  name?: string;
  /** Additional class names merged onto the rendered element. */
  className?: string;
  /** ToggleGroup.Item children. */
  children: ReactNode;
  /** Ref forwarded to the underlying element. */
  ref?: Ref<HTMLDivElement>;
}

/** Props for toggle group. */
export type ToggleGroupProps<TValue extends string = string> = ToggleGroupBaseProps<TValue> &
  (ToggleGroupSingleProps<TValue> | ToggleGroupMultipleProps<TValue>);

interface ToggleGroupSeedElementProps {
  children?: ReactNode;
  value?: string;
  disabled?: boolean;
  hidden?: boolean;
  inert?: boolean;
  "aria-hidden"?: boolean | "true" | "false";
}

function isToggleSeedElementSkipped(props: ToggleGroupSeedElementProps): boolean {
  return (
    props.hidden === true ||
    props.inert === true ||
    props["aria-hidden"] === true ||
    props["aria-hidden"] === "true"
  );
}

function collectEnabledToggleValues(children: ReactNode, skippedAncestor = false): string[] {
  const enabledValues: string[] = [];

  Children.forEach(children, (child) => {
    if (!isValidElement<ToggleGroupSeedElementProps>(child)) return;
    if (child.type === ToggleGroup) return;

    const skipped = skippedAncestor || isToggleSeedElementSkipped(child.props);
    if (child.type === ToggleGroupItem && typeof child.props.value === "string") {
      if (!child.props.disabled && !skipped) enabledValues.push(child.props.value);
      return;
    }

    enabledValues.push(...collectEnabledToggleValues(child.props.children, skipped));
  });

  return enabledValues;
}

/** Compound toggle button group with keyboard navigation for single or multiple selection. */
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
  const composedRef = useComposedRefs(containerRef, ref);
  const { items, registeredItems, registerItem, unregisterItem } =
    useSelectableCollection(containerRef);
  const [hasLiveRegistrations, setHasLiveRegistrations] = useState(false);
  const registerLiveItem = useCallback(
    (itemId: string, itemValue: string, itemDisabled: boolean, element: HTMLElement | null) => {
      setHasLiveRegistrations(true);
      registerItem(itemId, itemValue, itemDisabled, element);
    },
    [registerItem],
  );

  // Public props narrow on TValue; internal state stays string-typed because the
  // selectable-collection layer keys items by data-value strings.
  const singleProps = selectionMode === "single" ? (props as ToggleGroupSingleProps) : null;
  const multipleProps = selectionMode === "multiple" ? (props as ToggleGroupMultipleProps) : null;

  const isValueControlled = "value" in props;
  const [singleValue, setSingleValue, , resetSingleValue] = useControllableState<string | null>({
    value: isValueControlled ? (singleProps?.value ?? null) : undefined,
    controlled: isValueControlled,
    defaultValue: singleProps?.defaultValue ?? null,
    onChange: singleProps?.onChange as ((value: string | null) => void) | undefined,
  });
  const invalidatePendingSingleReset = useFormReset(
    containerRef,
    singleProps?.defaultValue ?? null,
    resetSingleValue,
    !isValueControlled && selectionMode === "single",
  );

  const [multipleValue, setMultipleValue, , resetMultipleValue] = useControllableState<
    readonly string[]
  >({
    value: isValueControlled ? (multipleProps?.value ?? []) : undefined,
    controlled: isValueControlled,
    defaultValue: multipleProps?.defaultValue ?? [],
    onChange: multipleProps?.onChange as ((value: readonly string[]) => void) | undefined,
  });
  const invalidatePendingMultipleReset = useFormReset(
    containerRef,
    multipleProps?.defaultValue ?? [],
    resetMultipleValue,
    !isValueControlled && selectionMode === "multiple",
  );

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
        invalidatePendingMultipleReset();
        setMultipleValue((prev) =>
          prev.includes(newValue) ? prev.filter((v) => v !== newValue) : [...prev, newValue],
        );
        return;
      }
      invalidatePendingSingleReset();
      setSingleValue((prev) => (prev === newValue && allowDeselect ? null : newValue));
    },
    [
      allowDeselect,
      invalidatePendingMultipleReset,
      invalidatePendingSingleReset,
      selectionMode,
      setMultipleValue,
      setSingleValue,
    ],
  );

  const enabledItems = getEnabledSelectableCollectionItems(items, disabled);
  const seededEnabledValues = disabled ? [] : collectEnabledToggleValues(children);
  const enabledValues = hasLiveRegistrations
    ? enabledItems.map((item) => item.value)
    : seededEnabledValues;
  const activeHighlightedValue =
    highlightedValue !== null && enabledValues.includes(highlightedValue) ? highlightedValue : null;
  const selectedAnchor = selectionMode === "single" ? singleValue : null;
  const tabTargetValue =
    [highlightedValue, selectedAnchor].find(
      (candidate): candidate is string => candidate !== null && enabledValues.includes(candidate),
    ) ??
    enabledValues[0] ??
    null;

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

  const contextValue = useMemo(
    () => ({
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
      registerItem: registerLiveItem,
      unregisterItem,
    }),
    [
      selectionMode,
      isItemSelected,
      handleValueChange,
      setHighlightedValue,
      disabled,
      size,
      variant,
      activeHighlightedValue,
      usesButtonSemantics,
      tabTargetValue,
      registerLiveItem,
      unregisterItem,
    ],
  );

  // Pill variant: a single absolutely-positioned indicator tracks the active
  // item's rect. The hook is null-fed for `selectionMode="multiple"` (which
  // uses button semantics with no single-active concept) and when the variant
  // doesn't use a pill indicator, so the observer is never created.
  const usesWrappedPillLayout = variant === "pill" && orientation === "horizontal" && wrap;
  const pillTargetValue =
    variant === "pill" && selectionMode === "single" && !usesWrappedPillLayout ? singleValue : null;
  const pillRect = useFloatingIndicator(containerRef, pillTargetValue);

  const underlineTargetValue =
    variant === "underline" && selectionMode === "single" ? singleValue : null;
  const underlineRect = useFloatingIndicator(containerRef, underlineTargetValue);

  const hiddenInputValue = selectionMode === "single" && name ? singleValue : null;
  const selectedItem = registeredItems.find((item) => item.value === hiddenInputValue);
  const isHiddenInputDisabled =
    disabled ||
    (hasLiveRegistrations
      ? selectedItem === undefined ||
        selectedItem.disabled ||
        selectedItem.element?.matches(":disabled") === true
      : !seededEnabledValues.includes(hiddenInputValue ?? ""));

  return (
    <ToggleGroupContext value={contextValue}>
      {/* biome-ignore lint/a11y/noStaticElementInteractions: role is dynamically "group"/"radiogroup" and the container owns roving keyboard handling for its items; Biome cannot resolve the dynamic role. */}
      {/* biome-ignore lint/a11y/useAriaPropsSupportedByRole: the aria props apply to the dynamic group/radiogroup role, which Biome cannot statically resolve. */}
      <div
        ref={composedRef}
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
          "w-fit max-w-full",
          wrap && orientation === "horizontal" && "flex-wrap",
          usesWrappedPillLayout && "gap-1 [&>[data-state=on]]:bg-primary",
          className,
        )}
      >
        {!usesWrappedPillLayout && variant === "pill" && pillRect && (
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
          <input
            type="hidden"
            name={name}
            value={hiddenInputValue}
            disabled={isHiddenInputDisabled}
          />
        )}
        {children}
      </div>
    </ToggleGroupContext>
  );
}
