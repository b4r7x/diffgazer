"use client";

import {
  type AriaAttributes,
  type ComponentPropsWithRef,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
  type Ref,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useComposedRefs } from "@/hooks/use-composed-refs";
import { useControllableState } from "@/hooks/use-controllable-state";
import { useFormReset } from "@/hooks/use-form-reset";
import { useNavigation } from "@/hooks/use-navigation";
import { isHTMLElementForContainer, resolveAriaInvalid } from "@/lib/aria";
import {
  getEnabledSelectableCollectionItems,
  resolveSelectableCollectionItem,
  useSelectableCollection,
} from "@/lib/selectable-collection";
import type { SelectableVariant } from "@/lib/selectable-variants";
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
  /** Called after the built-in group key handling runs. */
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
  const hasAutoFocusedRef = useRef(false);
  const { items, registerItem, unregisterItem } = useSelectableCollection(containerRef);
  // Read through a ref so the dev-mode unregistered-value guard does not pull
  // `items` into the stable `toggle` callback's deps.
  const itemsRef = useRef(items);
  itemsRef.current = items;
  const [value, setValue] = useControllableState<T[]>({
    value: "value" in props ? (controlledValue ?? []) : undefined,
    controlled: "value" in props,
    defaultValue,
    onChange,
  });
  const [nativeInvalid, setNativeInvalid] = useState(false);
  useFormReset(
    containerRef,
    defaultValue,
    (value) => {
      setNativeInvalid(false);
      setValue(value);
    },
    !("value" in props),
  );

  const enabledItemValues = new Set(
    getEnabledSelectableCollectionItems(items, disabled).map((item) => item.value),
  );
  const hasValidSelectedValue = value.some((itemValue) => enabledItemValues.has(itemValue));

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
    enabled: keyboardNavigation && !disabled,
    onNavigationBoundaryReached,
    highlighted: highlightedValue,
    onHighlightChange: setHighlightedValue,
    onEnter: (itemValue) => toggle(itemValue),
    moveFocus: true,
    scopeToContainer: true,
    ownerSelector: '[data-diffgazer-selectable-owner="checkbox"]',
  });

  useEffect(() => {
    if (!autoFocus || !keyboardNavigation || disabled) {
      hasAutoFocusedRef.current = false;
      return;
    }
    if (hasAutoFocusedRef.current) return;

    const activeItems = getEnabledSelectableCollectionItems(items, disabled);
    const target = resolveSelectableCollectionItem(activeItems, highlightedValue, ...value);
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

  const toggle = useCallback(
    (itemValue: string) => {
      if (disabled) return;
      warnUnregisteredValue(
        "CheckboxGroup",
        itemValue,
        itemsRef.current.map((item) => item.value),
      );
      setNativeInvalid(false);
      setValue((cur) => {
        const nextValue = itemValue as T;
        const selected = cur.includes(nextValue);
        return selected ? cur.filter((v) => v !== itemValue) : [...cur, nextValue];
      });
    },
    [disabled, setValue],
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
      disabled,
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
      disabled,
      size,
      variant,
      strikethrough,
      highlightedValue,
      name,
    ],
  );

  return (
    <CheckboxGroupContext value={contextValue}>
      {/* biome-ignore lint/a11y/useSemanticElements: role="group" labels the set of related checkboxes; <fieldset> would impose default form styling/structure and break the group layout. */}
      <div
        {...rootProps}
        ref={composedRef}
        role="group"
        data-diffgazer-selectable-owner="checkbox"
        aria-label={ariaLabel ?? label}
        aria-labelledby={ariaLabelledBy}
        aria-disabled={disabled || undefined}
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
            required
            checked={hasValidSelectedValue}
            disabled={disabled}
            tabIndex={-1}
            aria-hidden={true}
            readOnly
            className="sr-only"
            onInvalid={(event) => {
              event.preventDefault();
              setNativeInvalid(true);
              getEnabledSelectableCollectionItems(items, disabled)[0]?.element?.focus();
            }}
          />
        )}
        {children}
      </div>
    </CheckboxGroupContext>
  );
}
