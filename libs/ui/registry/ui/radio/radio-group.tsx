"use client";

import {
  type ComponentPropsWithRef,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type Ref,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import { useControllableState } from "@/hooks/use-controllable-state";
import { useFormReset } from "@/hooks/use-form-reset";
import { composeRefs } from "@/lib/compose-refs";
import {
  getEnabledSelectableCollectionItems,
  getSelectableCollectionItemValue,
  useSelectableCollection,
  type SelectableCollectionItem,
} from "@/lib/selectable-collection";
import { cn } from "@/lib/utils";
import type { RadioSize } from "./radio";
import type { SelectableVariant } from "@/lib/selectable-variants";
import { RadioGroupContext, type RadioGroupContextValue } from "./radio-group-context";

type RadioGroupRootProps = Omit<
  ComponentPropsWithRef<"div">,
  | "children"
  | "role"
  | "onChange"
  | "onKeyDown"
  | "className"
  | "ref"
  | "aria-label"
  | "aria-labelledby"
  | "aria-orientation"
  | "aria-required"
  | "aria-invalid"
  | "aria-disabled"
>;

export interface RadioGroupProps extends RadioGroupRootProps {
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  onNavigate?: (value: string, direction: RadioGroupNavigationDirection) => void;
  onEnter?: (value: string, event: ReactKeyboardEvent<HTMLDivElement>) => void;
  onHighlightChange?: (value: string) => void;
  onKeyDown?: (event: ReactKeyboardEvent) => void;
  highlighted?: string | null;
  orientation?: "vertical" | "horizontal";
  wrap?: boolean;
  keyboardNavigation?: boolean;
  activationMode?: RadioGroupActivationMode;
  onNavigationBoundaryReached?: (direction: RadioGroupBoundaryDirection) => void;
  disabled?: boolean;
  autoFocus?: boolean;
  size?: RadioSize;
  variant?: SelectableVariant;
  name?: string;
  required?: boolean;
  label?: string;
  labelledBy?: string;
  "aria-label"?: string;
  "aria-labelledby"?: string;
  className?: string;
  children: ReactNode;
  ref?: Ref<HTMLDivElement>;
}

export type RadioGroupActivationMode = "automatic" | "manual";
export type RadioGroupBoundaryDirection = "previous" | "next";
export type RadioGroupNavigationDirection = "previous" | "next" | "first" | "last";

function isHTMLElementForContainer(value: unknown, container: HTMLElement | null): value is HTMLElement {
  const View = container?.ownerDocument.defaultView;
  return Boolean(View && value instanceof View.HTMLElement);
}

export function RadioGroup(props: RadioGroupProps) {
  const {
    value: controlledValue,
    defaultValue,
    onChange,
    onNavigate,
    onEnter,
    onHighlightChange,
    onKeyDown,
    highlighted: controlledHighlighted,
    orientation = "vertical",
    wrap = true,
    keyboardNavigation = true,
    activationMode = "automatic",
    onNavigationBoundaryReached,
    disabled = false,
    autoFocus = false,
    size = "md",
    variant = "bullet",
    name,
    required,
    label,
    labelledBy,
    "aria-label": ariaLabel,
    "aria-labelledby": ariaLabelledBy,
    className,
    children,
    ref,
    ...rootProps
  } = props;
  const containerRef = useRef<HTMLDivElement>(null);
  const hasAutoFocusedRef = useRef(false);
  const { items, registerItem, unregisterItem } = useSelectableCollection(containerRef);
  const [requiredInvalid, setRequiredInvalid] = useState(false);

  const [value, setValue] = useControllableState<string | undefined>({
    value: controlledValue,
    controlled: "value" in props,
    defaultValue,
    onChange: (next) => {
      if (next !== undefined) onChange?.(next);
    },
  });
  useFormReset(containerRef, defaultValue, setValue, !("value" in props));

  const [highlightedValue, setHighlightedValue] = useControllableState<string | null>({
    value: controlledHighlighted,
    controlled: "highlighted" in props,
    defaultValue: null,
    onChange: (next) => {
      if (next !== null) onHighlightChange?.(next);
    },
  });

  const enabledItems = getEnabledSelectableCollectionItems(items, disabled);
  const validHighlightedValue = getSelectableCollectionItemValue(enabledItems, highlightedValue);
  const validSelectedValue = getSelectableCollectionItemValue(enabledItems, value);
  const tabTargetValue =
    validSelectedValue ?? validHighlightedValue ?? enabledItems[0]?.value ?? null;

  useEffect(() => {
    if (!autoFocus || !keyboardNavigation || disabled) {
      hasAutoFocusedRef.current = false;
      return;
    }
    if (hasAutoFocusedRef.current) return;

    const activeItems = getEnabledSelectableCollectionItems(items, disabled);
    const focusValue =
      getSelectableCollectionItemValue(activeItems, highlightedValue)
      ?? getSelectableCollectionItemValue(activeItems, value)
      ?? activeItems[0]?.value
      ?? null;
    const target = activeItems.find((item) => item.value === focusValue) ?? activeItems[0];
    if (!target?.element) return;

    target.element.focus();
    setHighlightedValue(target.value);
    hasAutoFocusedRef.current = true;
  }, [autoFocus, keyboardNavigation, disabled, items, highlightedValue, value, setHighlightedValue]);

  const handleValueChange = useCallback((next: string) => {
    setRequiredInvalid(false);
    setValue(next);
  }, [setValue]);

  const handleRequiredInvalid = useCallback(() => {
    setRequiredInvalid(true);
  }, []);

  const moveToItem = (
    item: SelectableCollectionItem,
    direction: RadioGroupNavigationDirection,
  ) => {
    if (!item.element) return;
    item.element.scrollIntoView?.({ block: "nearest" });
    item.element.focus();
    setHighlightedValue(item.value);
    setRequiredInvalid(false);
    onNavigate?.(item.value, direction);
    if (activationMode === "automatic") setValue(item.value);
  };

  const getCurrentItemIndex = () => {
    const enabledItems = getEnabledSelectableCollectionItems(items, disabled);
    const activeElement = containerRef.current?.ownerDocument.activeElement;
    const focusedIndex = enabledItems.findIndex((item) => {
      return item.element !== null
        && isHTMLElementForContainer(activeElement, containerRef.current)
        && item.element.contains(activeElement);
    });
    if (focusedIndex >= 0) return focusedIndex;

    if (tabTargetValue === null) return -1;
    return enabledItems.findIndex((item) => item.value === tabTargetValue);
  };

  const getCurrentItem = () => {
    const currentIndex = getCurrentItemIndex();
    const currentItems = getEnabledSelectableCollectionItems(items, disabled);
    return currentIndex >= 0 ? currentItems[currentIndex] ?? null : null;
  };

  const focusItemAtIndex = (
    index: number,
    direction: RadioGroupNavigationDirection,
  ) => {
    const enabledItems = getEnabledSelectableCollectionItems(items, disabled);
    const item = enabledItems[index];
    if (item) moveToItem(item, direction);
  };

  const moveItem = (delta: 1 | -1) => {
    const enabledItems = getEnabledSelectableCollectionItems(items, disabled);
    if (enabledItems.length === 0) return;

    const currentIndex = getCurrentItemIndex();
    const nextIndex = currentIndex + delta;
    const direction: RadioGroupNavigationDirection = delta < 0 ? "previous" : "next";

    if (nextIndex < 0 || nextIndex >= enabledItems.length) {
      if (!wrap) {
        onNavigationBoundaryReached?.(delta < 0 ? "previous" : "next");
        return;
      }
      focusItemAtIndex(delta < 0 ? enabledItems.length - 1 : 0, direction);
      return;
    }

    focusItemAtIndex(nextIndex, direction);
  };

  const handleKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    const eventTarget = isHTMLElementForContainer(event.target, containerRef.current)
      ? event.target
      : null;
    if (
      eventTarget
      && eventTarget.closest('[role="radiogroup"]') !== containerRef.current
    ) {
      return;
    }

    onKeyDown?.(event);
    if (event.defaultPrevented || !keyboardNavigation || disabled) return;

    switch (event.key) {
      case "ArrowUp":
      case "ArrowLeft":
        event.preventDefault();
        moveItem(-1);
        return;
      case "ArrowDown":
      case "ArrowRight":
        event.preventDefault();
        moveItem(1);
        return;
      case "Home":
        event.preventDefault();
        focusItemAtIndex(0, "first");
        return;
      case "End":
        event.preventDefault();
        focusItemAtIndex(enabledItems.length - 1, "last");
        return;
      case "Enter": {
        if (!onEnter) return;
        const item = getCurrentItem();
        if (!item) return;
        event.preventDefault();
        setHighlightedValue(item.value);
        setRequiredInvalid(false);
        onEnter(item.value, event);
        return;
      }
    }
  };

  const contextValue: RadioGroupContextValue = useMemo(() => ({
    value,
    onChange: handleValueChange,
    registerItem,
    unregisterItem,
    disabled,
    keyboardNavigation,
    size,
    variant,
    highlightedValue: validHighlightedValue,
    name,
    required,
    onRequiredInvalid: handleRequiredInvalid,
    tabTargetValue,
  }), [value, handleValueChange, registerItem, unregisterItem, disabled, keyboardNavigation, size, variant, validHighlightedValue, name, required, handleRequiredInvalid, tabTargetValue]);

  return (
    <RadioGroupContext value={contextValue}>
      {required && !name && (
        <input
          type="checkbox"
          required
          checked={validSelectedValue !== null}
          disabled={disabled}
          tabIndex={-1}
          aria-hidden={true}
          aria-label={ariaLabel ?? label}
          readOnly
          className="sr-only"
          onInvalid={(event) => {
            event.preventDefault();
            handleRequiredInvalid();
            enabledItems[0]?.element?.focus();
          }}
        />
      )}
      <div
        {...rootProps}
        ref={composeRefs(containerRef, ref)}
        role="radiogroup"
        data-diffgazer-selectable-owner="radio"
        aria-label={ariaLabel ?? label}
        aria-labelledby={ariaLabelledBy ?? labelledBy}
        aria-orientation={orientation}
        aria-required={required || undefined}
        aria-invalid={requiredInvalid && validSelectedValue === null ? true : undefined}
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
