"use client";

import {
  type ComponentPropsWithRef,
  type AriaAttributes,
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
import { useNavigation } from "@/hooks/use-navigation";
import { composeRefs } from "@/lib/compose-refs";
import {
  getEnabledSelectableCollectionItems,
  getSelectableCollectionItemValue,
  resolveSelectableCollectionItem,
  resolveSelectableCollectionItemValue,
  useSelectableCollection,
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
  onHighlightChange?: (value: string | null) => void;
  onKeyDown?: (event: ReactKeyboardEvent) => void;
  highlighted?: string | null;
  orientation?: "vertical" | "horizontal";
  wrap?: boolean;
  keyboardNavigation?: boolean;
  activationMode?: RadioGroupActivationMode;
  onNavigationBoundaryReached?: (
    direction: RadioGroupBoundaryDirection,
    event: globalThis.KeyboardEvent,
    key: string,
  ) => void;
  disabled?: boolean;
  autoFocus?: boolean;
  size?: RadioSize;
  variant?: SelectableVariant;
  name?: string;
  required?: boolean;
  label?: string;
  "aria-label"?: string;
  "aria-labelledby"?: string;
  "aria-invalid"?: AriaAttributes["aria-invalid"];
  className?: string;
  children: ReactNode;
  ref?: Ref<HTMLDivElement>;
}

export type RadioGroupActivationMode = "automatic" | "manual";
export type RadioGroupBoundaryDirection = "previous" | "next";
export type RadioGroupNavigationDirection = "previous" | "next" | "first" | "last";

const RADIO_PREVIOUS_KEYS = ["ArrowUp", "ArrowLeft"] as const;
const RADIO_NEXT_KEYS = ["ArrowDown", "ArrowRight"] as const;

function isHTMLElementForContainer(value: unknown, container: HTMLElement | null): value is HTMLElement {
  const View = container?.ownerDocument.defaultView;
  return Boolean(View && value instanceof View.HTMLElement);
}

function getRadioNavigationDirection(key: string): RadioGroupNavigationDirection | null {
  if (key === "ArrowUp" || key === "ArrowLeft") return "previous";
  if (key === "ArrowDown" || key === "ArrowRight") return "next";
  if (key === "Home") return "first";
  if (key === "End") return "last";
  return null;
}

function resolveGroupAriaInvalid(
  forceInvalid: boolean | undefined,
  ariaInvalid: AriaAttributes["aria-invalid"],
) {
  if (forceInvalid) return true;
  if (ariaInvalid === true || ariaInvalid === "true" || ariaInvalid === "grammar" || ariaInvalid === "spelling") {
    return ariaInvalid;
  }
  if (ariaInvalid === false || ariaInvalid === "false") return ariaInvalid;
  return undefined;
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
    "aria-label": ariaLabel,
    "aria-labelledby": ariaLabelledBy,
    "aria-invalid": ariaInvalid,
    className,
    children,
    ref,
    ...rootProps
  } = props;
  const containerRef = useRef<HTMLDivElement>(null);
  const hasAutoFocusedRef = useRef(false);
  const navigationEventRef = useRef<ReactKeyboardEvent<HTMLDivElement> | null>(null);
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
    onChange: onHighlightChange,
  });

  const enabledItems = getEnabledSelectableCollectionItems(items, disabled);
  const validHighlightedValue = getSelectableCollectionItemValue(enabledItems, highlightedValue);
  const validSelectedValue = getSelectableCollectionItemValue(enabledItems, value);
  const tabTargetValue = activationMode === "manual"
    ? resolveSelectableCollectionItemValue(enabledItems, highlightedValue, value)
    : resolveSelectableCollectionItemValue(enabledItems, value, highlightedValue);

  useEffect(() => {
    if (!autoFocus || !keyboardNavigation || disabled) {
      hasAutoFocusedRef.current = false;
      return;
    }
    if (hasAutoFocusedRef.current) return;

    const activeItems = getEnabledSelectableCollectionItems(items, disabled);
    const target = resolveSelectableCollectionItem(activeItems, highlightedValue, value);
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

  const handleNavigatedItem = useCallback((next: string | null) => {
    if (next === null) return;
    setHighlightedValue(next);
    setRequiredInvalid(false);

    const direction = getRadioNavigationDirection(navigationEventRef.current?.key ?? "");
    if (direction !== null) onNavigate?.(next, direction);

    if (activationMode === "automatic") setValue(next);
  }, [activationMode, onNavigate, setHighlightedValue, setValue]);

  const handleNavigationEnter = useCallback((next: string) => {
    const event = navigationEventRef.current;
    if (!event) return;

    setHighlightedValue(next);
    handleValueChange(next);
    onEnter?.(next, event);
  }, [handleValueChange, onEnter, setHighlightedValue]);

  const handleNavigationBoundaryReached = useCallback((
    direction: RadioGroupBoundaryDirection,
    event: globalThis.KeyboardEvent,
    key: string,
  ) => {
    onNavigationBoundaryReached?.(direction, event, key);
  }, [onNavigationBoundaryReached]);

  const { onKeyDown: navKeyDown } = useNavigation({
    containerRef,
    role: "radio",
    highlighted: tabTargetValue,
    onHighlightChange: handleNavigatedItem,
    onEnter: handleNavigationEnter,
    wrap,
    enabled: keyboardNavigation && !disabled,
    moveFocus: true,
    scopeToContainer: true,
    upKeys: RADIO_PREVIOUS_KEYS,
    downKeys: RADIO_NEXT_KEYS,
    onNavigationBoundaryReached: handleNavigationBoundaryReached,
  });

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

    navigationEventRef.current = event;
    try {
      navKeyDown(event);
    } finally {
      navigationEventRef.current = null;
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
        aria-labelledby={ariaLabelledBy}
        aria-orientation={orientation}
        aria-required={required || undefined}
        aria-invalid={resolveGroupAriaInvalid(requiredInvalid && validSelectedValue === null, ariaInvalid)}
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
