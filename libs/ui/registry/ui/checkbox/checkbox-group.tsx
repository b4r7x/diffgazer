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
  useLayoutEffect,
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
import type { CheckboxSize } from "./checkbox";
import { CheckboxGroupContext } from "./checkbox-group-context";

/** Props for checkbox group root. */
type CheckboxGroupRootProps = Omit<
  ComponentPropsWithRef<"div">,
  | "children"
  | "role"
  | "onChange"
  | "onKeyDown"
  | "className"
  | "ref"
  | "aria-label"
  | "aria-labelledby"
  | "aria-disabled"
  | "aria-invalid"
>;

/**
 * @typeParam T - Convenience assertion for the value union surfaced through
 * `value`/`onChange`. Values originate from the rendered items' `data-value`
 * strings and are asserted to `T`, not validated; in development an unregistered
 * value warns (see `warnUnregisteredValue`).
 */
export type CheckboxGroupProps<T extends string = string> = CheckboxGroupRootProps & {
  /** Controlled selected item values. */
  value?: T[];
  /** Initial selected values for uncontrolled usage. */
  defaultValue?: T[];
  /** Called when the selected values change. */
  onChange?: (value: T[]) => void;
  /** Called when keyboard navigation highlights a new item or clears highlight. */
  onHighlightChange?: (value: string | null) => void;
  /** Called before the built-in group key handling; call event.preventDefault() to suppress it. */
  onKeyDown?: (event: ReactKeyboardEvent) => void;
  /** Controlled highlighted item value for keyboard navigation. */
  highlighted?: string | null;
  /** Whether arrow-key navigation wraps at the first and last item. */
  wrap?: boolean;
  /** Enable built-in arrow-key navigation. */
  keyboardNavigation?: boolean;
  /** Called when non-wrapping navigation reaches the first or last item. */
  onNavigationBoundaryReached?: (
    direction: "previous" | "next",
    event: globalThis.KeyboardEvent,
    key: string,
  ) => void;
  /** Disables the group and all items. */
  disabled?: boolean;
  /** Focuses the highlighted, selected, or first enabled item when the group becomes active. */
  autoFocus?: boolean;
  /** Selectable control size token. */
  size?: CheckboxSize;
  /** Indicator style. */
  variant?: SelectableVariant;
  /** Applies muted line-through styling to checked item labels. */
  strikethrough?: boolean;
  /** Shared hidden native input name for grouped form submission. */
  name?: string;
  /** Requires at least one enabled item to be selected. */
  required?: boolean;
  /** Additional class names merged onto the rendered element. */
  className?: string;
  /** Visible group label. Also provides the accessible name when aria-label is omitted. */
  label?: string;
  /** Accessible name for the group. Overrides the label-derived fallback when supplied. */
  "aria-label"?: string;
  /** ID reference for an external label. Use when another element already names the group. */
  "aria-labelledby"?: string;
  /** ARIA invalid state forwarded to the rendered control. */
  "aria-invalid"?: AriaAttributes["aria-invalid"];
  /** Checkbox item children rendered inside the group. */
  children: ReactNode;
  /** Ref forwarded to the underlying group element. */
  ref?: Ref<HTMLDivElement>;
};

/** Multi-select group with context and keyboard navigation. */
export function CheckboxGroup<T extends string = string>(props: CheckboxGroupProps<T>) {
  const {
    value: controlledValue,
    defaultValue = [] as T[],
    onChange,
    onHighlightChange,
    onKeyDown,
    highlighted: controlledHighlighted,
    wrap = true,
    keyboardNavigation = true,
    onNavigationBoundaryReached,
    disabled = false,
    autoFocus = false,
    size = "md",
    variant = "x",
    strikethrough = false,
    name,
    required,
    className,
    label,
    "aria-label": ariaLabel,
    "aria-labelledby": ariaLabelledBy,
    "aria-invalid": ariaInvalid,
    children,
    ref,
    ...rootProps
  } = props;
  const containerRef = useRef<HTMLDivElement>(null);
  const composedRef = useComposedRefs(containerRef, ref);
  const generatedId = useId();
  const labelId = `${generatedId}-label`;
  const hasAutoFocusedRef = useRef(false);
  const fieldsetDisabled = useFieldsetDisabled(containerRef);
  const isDisabled = disabled || fieldsetDisabled;
  const { items, registerItem, unregisterItem } = useSelectableCollection(containerRef);
  // Read through a ref so the dev-mode unregistered-value guard does not pull
  // `items` into the stable `toggle` callback's deps.
  const itemsRef = useRef(items);

  useLayoutEffect(() => {
    itemsRef.current = items;
  }, [items]);

  const [value, setValue, , resetValue] = useControllableState<T[]>({
    value: "value" in props ? (controlledValue ?? []) : undefined,
    controlled: "value" in props,
    defaultValue,
    onChange,
  });
  const [nativeInvalid, setNativeInvalid] = useState(false);
  const enabledItemValues = new Set(
    getEnabledSelectableCollectionItems(items, isDisabled).map((item) => item.value),
  );
  const hasValidSelectedValue = value.some((itemValue) => enabledItemValues.has(itemValue));
  const isValueControlled = "value" in props;
  const controlledFormReset = isValueControlled
    ? {
        syncResetBaseline: () => {
          const selectedValues = new Set<string>(value);
          for (const input of containerRef.current?.querySelectorAll<HTMLInputElement>(
            'input[data-slot="checkbox-form-mirror"]',
          ) ?? []) {
            const item = input.nextElementSibling;
            if (!item?.hasAttribute("data-diffgazer-checkbox-group-item")) continue;
            if (item.closest('[data-slot="checkbox-group"]') !== containerRef.current) continue;
            input.defaultChecked = selectedValues.has(input.value);
          }
          const validation = containerRef.current?.querySelector<HTMLInputElement>(
            ':scope > input[data-slot="checkbox-group-validation"]',
          );
          if (validation) validation.defaultChecked = hasValidSelectedValue;
        },
        onReset: () => setNativeInvalid(false),
      }
    : undefined;
  const invalidatePendingReset = useFormReset(
    containerRef,
    defaultValue,
    (value) => {
      setNativeInvalid(false);
      resetValue(value);
    },
    !isValueControlled,
    controlledFormReset,
  );
  const resolvedAriaLabelledBy = ariaLabel
    ? undefined
    : mergeIds(ariaLabelledBy, label ? labelId : undefined);

  const [highlightedValue, setHighlightedValue] = useControllableState<string | null>({
    value: controlledHighlighted,
    controlled: "highlighted" in props,
    defaultValue: null,
    onChange: onHighlightChange,
  });

  const { onKeyDown: navKeyDown } = useNavigation({
    containerRef,
    role: "checkbox",
    wrap,
    enabled: keyboardNavigation && !isDisabled,
    onNavigationBoundaryReached,
    highlighted: highlightedValue,
    onHighlightChange: setHighlightedValue,
    onEnter: (itemValue) => toggle(itemValue),
    moveFocus: true,
    scopeToContainer: true,
    ownerSelector: '[data-diffgazer-selectable-owner="checkbox"]',
  });

  useEffect(() => {
    if (!autoFocus || !keyboardNavigation || isDisabled) {
      hasAutoFocusedRef.current = false;
      return;
    }
    if (hasAutoFocusedRef.current) return;

    const activeItems = getEnabledSelectableCollectionItems(items, isDisabled);
    const target = resolveSelectableCollectionItem(activeItems, highlightedValue, ...value);
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

  const toggle = useCallback(
    (itemValue: string) => {
      if (isDisabled) return;
      warnUnregisteredValue(
        "CheckboxGroup",
        itemValue,
        itemsRef.current.map((item) => item.value),
      );
      invalidatePendingReset();
      setNativeInvalid(false);
      setValue((cur) => {
        const nextValue = itemValue as T;
        const selected = cur.includes(nextValue);
        return selected ? cur.filter((v) => v !== itemValue) : [...cur, nextValue];
      });
    },
    [invalidatePendingReset, isDisabled, setValue],
  );

  const handleKeyDown = (event: ReactKeyboardEvent) => {
    const eventTarget = isHTMLElementForContainer(event.target, containerRef.current)
      ? event.target
      : null;
    if (eventTarget && eventTarget.closest('[role="group"]') !== containerRef.current) {
      return;
    }

    onKeyDown?.(event);
    if (!event.defaultPrevented && event.key !== " ") navKeyDown(event);
  };

  const contextValue = useMemo(
    () => ({
      value,
      toggle,
      registerItem,
      unregisterItem,
      disabled: isDisabled,
      size,
      variant,
      strikethrough,
      highlightedValue: highlightedValue ?? null,
      name,
    }),
    [
      value,
      toggle,
      registerItem,
      unregisterItem,
      isDisabled,
      size,
      variant,
      strikethrough,
      highlightedValue,
      name,
    ],
  );

  return (
    <CheckboxGroupContext value={contextValue}>
      {label && (
        <div
          id={labelId}
          data-slot="checkbox-group-label"
          className={cn(
            "mb-2 font-mono font-bold text-muted-foreground",
            selectableLabelVariants({ size }),
          )}
        >
          {label}
        </div>
      )}
      {/* biome-ignore lint/a11y/useSemanticElements: role="group" labels the set of related checkboxes; <fieldset> would impose default form styling/structure and break the group layout. */}
      <div
        {...rootProps}
        ref={composedRef}
        role="group"
        data-slot="checkbox-group"
        data-diffgazer-selectable-owner="checkbox"
        aria-label={ariaLabel}
        aria-labelledby={resolvedAriaLabelledBy}
        aria-disabled={isDisabled || undefined}
        aria-invalid={resolveAriaInvalid(
          ariaInvalid,
          nativeInvalid && required && !hasValidSelectedValue,
        )}
        className={cn("flex flex-col gap-2", className)}
        onKeyDown={handleKeyDown}
      >
        {required && (
          // Validation-only mirror: aria-hidden keeps it out of the a11y tree,
          // so naming and invalid state live on the visible role="group".
          <input
            type="checkbox"
            data-slot="checkbox-group-validation"
            required
            checked={hasValidSelectedValue}
            disabled={isDisabled}
            tabIndex={-1}
            aria-hidden={true}
            className="sr-only"
            onChange={() => {}}
            onInvalid={(event) => {
              event.preventDefault();
              setNativeInvalid(true);
              getEnabledSelectableCollectionItems(items, isDisabled)[0]?.element?.focus();
            }}
          />
        )}
        {children}
      </div>
    </CheckboxGroupContext>
  );
}
