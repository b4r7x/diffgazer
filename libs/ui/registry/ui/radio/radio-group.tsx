"use client";

import {
  type AriaAttributes,
  type ComponentPropsWithRef,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
  type Ref,
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import { useComposedRefs } from "@/hooks/use-composed-refs";
import { useControllableState } from "@/hooks/use-controllable-state";
import { useFormReset } from "@/hooks/use-form-reset";
import { useNavigation } from "@/hooks/use-navigation";
import { isHTMLElementForContainer, mergeIds, resolveAriaInvalid } from "@/lib/aria";
import {
  getEnabledSelectableCollectionItems,
  getSelectableCollectionItemValue,
  resolveSelectableCollectionItem,
  resolveSelectableCollectionItemValue,
  useSelectableCollection,
} from "@/lib/selectable-collection";
import { type SelectableVariant, selectableLabelVariants } from "@/lib/selectable-variants";
import { cn } from "@/lib/utils";
import { warnUnregisteredValue } from "@/lib/warn-unregistered-value";
import type { RadioSize } from "./radio";
import { RadioGroupContext, type RadioGroupContextValue } from "./radio-group-context";

/** Props for radio group root. */
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

/**
 * @typeParam TValue - Convenience assertion for the value union surfaced through
 * `value`/`onChange`/`onNavigate`/`onEnter`. Values originate from the rendered
 * items' `data-value` strings and are asserted to `TValue`, not validated; in
 * development an unregistered value warns (see `warnUnregisteredValue`).
 */
export interface RadioGroupProps<TValue extends string = string> extends RadioGroupRootProps {
  /** Controlled selected value. */
  value?: TValue;
  /** Initial selected value for uncontrolled usage. */
  defaultValue?: TValue;
  /** Called when the selected value changes. */
  onChange?: (value: TValue) => void;
  /** Called when arrow, Home, or End navigation moves to an item. */
  onNavigate?: (value: TValue, direction: RadioGroupNavigationDirection) => void;
  /** Called when Enter commits the focused item. */
  onEnter?: (value: TValue, event: ReactKeyboardEvent<HTMLDivElement>) => void;
  /** Called when keyboard navigation highlights a new item or clears highlight. */
  onHighlightChange?: (value: TValue | null) => void;
  /** Called after the built-in radiogroup key handling runs. */
  onKeyDown?: (event: ReactKeyboardEvent) => void;
  /** Controlled highlighted item value for keyboard navigation. */
  highlighted?: TValue | null;
  /** Layout orientation. All four arrow keys still navigate per APG radio behavior. */
  orientation?: "vertical" | "horizontal";
  /** Whether arrow-key navigation wraps at the first and last item. */
  wrap?: boolean;
  /** Enable built-in arrow-key navigation. */
  keyboardNavigation?: boolean;
  /**
   * Automatic selects on arrow navigation; manual moves focus/highlight until Space or Enter
   * commits.
   */
  activationMode?: RadioGroupActivationMode;
  /** Called when non-wrapping navigation reaches the first or last item. */
  onNavigationBoundaryReached?: (
    direction: RadioGroupBoundaryDirection,
    event: globalThis.KeyboardEvent,
    key: string,
  ) => void;
  /** Disables the custom control and hidden input. */
  disabled?: boolean;
  /** Focuses the highlighted, selected, or first enabled item when the group becomes active. */
  autoFocus?: boolean;
  /** Selectable control size token. */
  size?: RadioSize;
  /** Indicator style. */
  variant?: SelectableVariant;
  /** Shared hidden native input name for grouped form submission. */
  name?: string;
  /** Requires one enabled item to be selected. */
  required?: boolean;
  /** Visible group label. */
  label?: string;
  /** Accessible name for the radiogroup. Overrides the visible label when supplied. */
  "aria-label"?: string;
  /** ID of the element that labels this component. */
  "aria-labelledby"?: string;
  /** ARIA invalid state forwarded to the rendered control. */
  "aria-invalid"?: AriaAttributes["aria-invalid"];
  /** Additional class names merged onto the rendered element. */
  className?: string;
  /** Content rendered inside the component. */
  children: ReactNode;
  /** Ref forwarded to the underlying element. */
  ref?: Ref<HTMLDivElement>;
}

/** Whether arrow navigation immediately selects or only highlights until commit. */
export type RadioGroupActivationMode = "automatic" | "manual";
/** Boundary reached by non-wrapping radio navigation. */
export type RadioGroupBoundaryDirection = "previous" | "next";
/** Direction emitted by radiogroup navigation callbacks. */
export type RadioGroupNavigationDirection = "previous" | "next" | "first" | "last";

const RADIO_PREVIOUS_KEYS = ["ArrowUp", "ArrowLeft"] as const;
const RADIO_NEXT_KEYS = ["ArrowDown", "ArrowRight"] as const;

function getRadioNavigationDirection(key: string): RadioGroupNavigationDirection | null {
  if (key === "ArrowUp" || key === "ArrowLeft") return "previous";
  if (key === "ArrowDown" || key === "ArrowRight") return "next";
  if (key === "Home") return "first";
  if (key === "End") return "last";
  return null;
}

/** Group root with context, selection state, and keyboard navigation. */
export function RadioGroup<TValue extends string = string>(props: RadioGroupProps<TValue>) {
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
  const composedRef = useComposedRefs(containerRef, ref);
  const generatedId = useId();
  const labelId = `${generatedId}-label`;
  const hasAutoFocusedRef = useRef(false);
  const navigationEventRef = useRef<ReactKeyboardEvent<HTMLDivElement> | null>(null);
  const { items, registerItem, unregisterItem } = useSelectableCollection(containerRef);
  const [requiredInvalid, setRequiredInvalid] = useState(false);

  // Public props narrow on TValue; internal state stays string-typed because the
  // selectable-collection layer keys items by data-value strings.
  const [value, setValue] = useControllableState<string | undefined>({
    value: controlledValue,
    controlled: "value" in props,
    defaultValue,
    onChange: (next) => {
      if (next === undefined) return;
      warnUnregisteredValue(
        "RadioGroup",
        next,
        items.map((item) => item.value),
      );
      onChange?.(next as TValue);
    },
  });
  useFormReset(
    containerRef,
    defaultValue,
    (value) => {
      setRequiredInvalid(false);
      setValue(value);
    },
    !("value" in props),
  );

  const [highlightedValue, setHighlightedValue] = useControllableState<string | null>({
    value: controlledHighlighted,
    controlled: "highlighted" in props,
    defaultValue: null,
    onChange: onHighlightChange as ((value: string | null) => void) | undefined,
  });

  const enabledItems = getEnabledSelectableCollectionItems(items, disabled);
  const validHighlightedValue = getSelectableCollectionItemValue(enabledItems, highlightedValue);
  const validSelectedValue = getSelectableCollectionItemValue(enabledItems, value);
  const resolvedAriaLabelledBy = ariaLabel
    ? undefined
    : mergeIds(ariaLabelledBy, label ? labelId : undefined);
  const tabTargetValue =
    activationMode === "manual"
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
  }, [
    autoFocus,
    keyboardNavigation,
    disabled,
    items,
    highlightedValue,
    value,
    setHighlightedValue,
  ]);

  // Stable ref required: dep of the contextValue memo below.
  const handleValueChange = useCallback(
    (next: string) => {
      setRequiredInvalid(false);
      setValue(next);
    },
    [setValue],
  );

  // Stable ref required: dep of the contextValue memo below.
  const handleRequiredInvalid = useCallback(() => {
    setRequiredInvalid(true);
  }, []);

  const handleNavigatedItem = (next: string | null) => {
    if (next === null) return;
    setHighlightedValue(next);
    setRequiredInvalid(false);

    const direction = getRadioNavigationDirection(navigationEventRef.current?.key ?? "");
    if (direction !== null) {
      warnUnregisteredValue(
        "RadioGroup",
        next,
        items.map((item) => item.value),
      );
      onNavigate?.(next as TValue, direction);
    }

    if (activationMode === "automatic") setValue(next);
  };

  const handleNavigationEnter = (next: string) => {
    const event = navigationEventRef.current;
    if (!event) return;

    setHighlightedValue(next);
    handleValueChange(next);
    warnUnregisteredValue(
      "RadioGroup",
      next,
      items.map((item) => item.value),
    );
    onEnter?.(next as TValue, event);
  };

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
    onNavigationBoundaryReached,
  });

  const handleKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    const eventTarget = isHTMLElementForContainer(event.target, containerRef.current)
      ? event.target
      : null;
    if (eventTarget && eventTarget.closest('[role="radiogroup"]') !== containerRef.current) {
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

  const contextValue: RadioGroupContextValue = useMemo(
    () => ({
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
    }),
    [
      value,
      handleValueChange,
      registerItem,
      unregisterItem,
      disabled,
      keyboardNavigation,
      size,
      variant,
      validHighlightedValue,
      name,
      required,
      handleRequiredInvalid,
      tabTargetValue,
    ],
  );

  return (
    <RadioGroupContext value={contextValue}>
      {label && (
        <div
          id={labelId}
          data-slot="radio-group-label"
          className={cn(
            "mb-2 font-mono font-bold text-muted-foreground",
            selectableLabelVariants({ size }),
          )}
        >
          {label}
        </div>
      )}
      {required && !name && (
        <input
          type="checkbox"
          required
          checked={validSelectedValue !== null}
          disabled={disabled}
          tabIndex={-1}
          aria-hidden={true}
          aria-label={ariaLabel}
          aria-labelledby={resolvedAriaLabelledBy}
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
        ref={composedRef}
        role="radiogroup"
        data-diffgazer-selectable-owner="radio"
        aria-label={ariaLabel}
        aria-labelledby={resolvedAriaLabelledBy}
        aria-orientation={orientation}
        aria-required={required || undefined}
        aria-invalid={resolveAriaInvalid(
          ariaInvalid,
          requiredInvalid && validSelectedValue === null,
        )}
        aria-disabled={disabled || undefined}
        className={cn(
          "flex",
          orientation === "vertical" ? "flex-col gap-2" : "flex-row gap-4",
          className,
        )}
        onKeyDown={handleKeyDown}
      >
        {children}
      </div>
    </RadioGroupContext>
  );
}
