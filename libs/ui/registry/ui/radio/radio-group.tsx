"use client";

import {
  type AriaAttributes,
  Children,
  type ComponentPropsWithRef,
  isValidElement,
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
import { useFieldsetDisabled } from "@/lib/fieldset-disabled";
import {
  getEnabledSelectableCollectionItems,
  resolveSelectableCollectionItem,
  useSelectableCollection,
} from "@/lib/selectable-collection";
import { type SelectableVariant, selectableLabelVariants } from "@/lib/selectable-variants";
import { cn } from "@/lib/utils";
import { warnUnregisteredValue } from "@/lib/warn-unregistered-value";
import type { RadioSize } from "./radio";
import { RadioGroupContext, type RadioGroupContextValue } from "./radio-group-context";
import { RadioGroupItem, type RadioGroupItemProps } from "./radio-group-item";

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
  /** Called before the built-in group key handling; call event.preventDefault() to suppress it. */
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

function collectEnabledDirectRadioValues(children: ReactNode): string[] {
  return Children.toArray(children).flatMap((child) => {
    if (!isValidElement<RadioGroupItemProps>(child) || child.type !== RadioGroupItem) return [];
    const props = child.props;
    if (
      props.disabled ||
      props.hidden ||
      props.inert ||
      props["aria-hidden"] === true ||
      props["aria-hidden"] === "true"
    ) {
      return [];
    }
    return [props.value];
  });
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
  const validationInputRef = useRef<HTMLInputElement>(null);
  const composedRef = useComposedRefs(containerRef, ref);
  const generatedId = useId();
  const labelId = `${generatedId}-label`;
  const hasAutoFocusedRef = useRef(false);
  const navigationEventRef = useRef<ReactKeyboardEvent<HTMLDivElement> | null>(null);
  const fieldsetDisabled = useFieldsetDisabled(containerRef);
  const isDisabled = disabled || fieldsetDisabled;
  const { items, registerItem, unregisterItem } = useSelectableCollection(containerRef);
  const [hasLiveRegistrations, setHasLiveRegistrations] = useState(false);
  const [requiredInvalid, setRequiredInvalid] = useState(false);

  const registerLiveItem = useCallback(
    (itemId: string, itemValue: string, itemDisabled: boolean, element: HTMLElement | null) => {
      setHasLiveRegistrations(true);
      registerItem(itemId, itemValue, itemDisabled, element);
    },
    [registerItem],
  );

  // Public props narrow on TValue; internal state stays string-typed because the
  // selectable-collection layer keys items by data-value strings.
  const [value, setValue, , resetValue] = useControllableState<string | undefined>({
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
  const [highlightedValue, setHighlightedValue] = useControllableState<string | null>({
    value: controlledHighlighted,
    controlled: "highlighted" in props,
    defaultValue: null,
    onChange: onHighlightChange as ((value: string | null) => void) | undefined,
  });

  const enabledItems = getEnabledSelectableCollectionItems(items, isDisabled);
  const seededEnabledValues = isDisabled ? [] : collectEnabledDirectRadioValues(children);
  const enabledValues = hasLiveRegistrations
    ? enabledItems.map((item) => item.value)
    : seededEnabledValues;
  const effectiveRequired = !!required && enabledValues.length > 0;
  const validHighlightedValue =
    highlightedValue !== null && enabledValues.includes(highlightedValue) ? highlightedValue : null;
  const validSelectedValue = value !== undefined && enabledValues.includes(value) ? value : null;
  const isValueControlled = "value" in props;
  const controlledFormReset = isValueControlled
    ? {
        syncResetBaseline: () => {
          for (const input of containerRef.current?.querySelectorAll<HTMLInputElement>(
            'input[data-slot="radio-form-mirror"]',
          ) ?? []) {
            const item = input.nextElementSibling;
            if (!item?.hasAttribute("data-diffgazer-radio-group-item")) continue;
            if (item.closest('[data-slot="radio-group"]') !== containerRef.current) continue;
            input.defaultChecked = input.value === value;
          }
          const validation = validationInputRef.current;
          if (validation) validation.defaultChecked = validSelectedValue !== null;
        },
        onReset: () => setRequiredInvalid(false),
      }
    : undefined;
  const invalidatePendingReset = useFormReset(
    containerRef,
    defaultValue,
    (value) => {
      setRequiredInvalid(false);
      resetValue(value);
    },
    !isValueControlled,
    controlledFormReset,
  );
  const resolvedAriaLabelledBy = ariaLabel
    ? undefined
    : mergeIds(ariaLabelledBy, label ? labelId : undefined);
  const preferredTabValues =
    activationMode === "manual" ? [highlightedValue, value] : [value, highlightedValue];
  const tabTargetValue =
    preferredTabValues.find(
      (candidate): candidate is string =>
        candidate !== null && candidate !== undefined && enabledValues.includes(candidate),
    ) ??
    enabledValues[0] ??
    null;

  useEffect(() => {
    if (!autoFocus || !keyboardNavigation || isDisabled) {
      hasAutoFocusedRef.current = false;
      return;
    }
    if (hasAutoFocusedRef.current) return;

    const activeItems = getEnabledSelectableCollectionItems(items, isDisabled);
    const target = resolveSelectableCollectionItem(activeItems, highlightedValue, value);
    if (!target?.element) return;

    target.element.focus();
    setHighlightedValue(target.value);
    hasAutoFocusedRef.current = true;
  }, [
    autoFocus,
    keyboardNavigation,
    isDisabled,
    items,
    highlightedValue,
    value,
    setHighlightedValue,
  ]);

  // Stable ref required: dep of the contextValue memo below.
  const handleValueChange = useCallback(
    (next: string) => {
      invalidatePendingReset();
      setRequiredInvalid(false);
      setValue(next);
    },
    [invalidatePendingReset, setValue],
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

    if (activationMode === "automatic") {
      invalidatePendingReset();
      setValue(next);
    }
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
    enabled: keyboardNavigation && !isDisabled,
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
    if (event.defaultPrevented || !keyboardNavigation || isDisabled) return;

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
      registerItem: registerLiveItem,
      unregisterItem,
      disabled: isDisabled,
      keyboardNavigation,
      size,
      variant,
      highlightedValue: validHighlightedValue,
      name,
      required: effectiveRequired,
      onRequiredInvalid: handleRequiredInvalid,
      tabTargetValue,
    }),
    [
      value,
      handleValueChange,
      registerLiveItem,
      unregisterItem,
      isDisabled,
      keyboardNavigation,
      size,
      variant,
      validHighlightedValue,
      name,
      effectiveRequired,
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
      {effectiveRequired && !name && (
        <input
          ref={validationInputRef}
          type="checkbox"
          data-slot="radio-group-validation"
          required
          checked={validSelectedValue !== null}
          disabled={isDisabled}
          tabIndex={-1}
          aria-hidden={true}
          className="sr-only"
          onChange={() => {}}
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
        data-slot="radio-group"
        data-diffgazer-selectable-owner="radio"
        aria-label={ariaLabel}
        aria-labelledby={resolvedAriaLabelledBy}
        aria-orientation={orientation}
        aria-required={effectiveRequired || undefined}
        aria-invalid={resolveAriaInvalid(
          ariaInvalid,
          effectiveRequired && requiredInvalid && validSelectedValue === null,
        )}
        aria-disabled={isDisabled || undefined}
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
