"use client";

import {
  type ComponentPropsWithRef,
  type AriaAttributes,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
  type Ref,
} from "react";
import { useNavigation } from "@/hooks/use-navigation";
import { useControllableState } from "@/hooks/use-controllable-state";
import { useFormReset } from "@/hooks/use-form-reset";
import { isHTMLElementForContainer, resolveAriaInvalid } from "@/lib/aria-utils";
import { composeRefs } from "@/lib/compose-refs";
import {
  getEnabledSelectableCollectionItems,
  resolveSelectableCollectionItem,
  useSelectableCollection,
} from "@/lib/selectable-collection";
import { cn } from "@/lib/utils";
import type { SelectableVariant } from "@/lib/selectable-variants";
import type { CheckboxSize } from "./checkbox";
import { CheckboxGroupContext } from "./checkbox-group-context";

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

export type CheckboxGroupProps<T extends string = string> = CheckboxGroupRootProps & {
  value?: T[];
  defaultValue?: T[];
  onChange?: (value: T[]) => void;
  onHighlightChange?: (value: string | null) => void;
  onKeyDown?: (event: ReactKeyboardEvent) => void;
  highlighted?: string | null;
  wrap?: boolean;
  keyboardNavigation?: boolean;
  onNavigationBoundaryReached?: (
    direction: "previous" | "next",
    event: globalThis.KeyboardEvent,
    key: string,
  ) => void;
  disabled?: boolean;
  autoFocus?: boolean;
  size?: CheckboxSize;
  variant?: SelectableVariant;
  strikethrough?: boolean;
  name?: string;
  required?: boolean;
  className?: string;
  label?: string;
  "aria-label"?: string;
  "aria-labelledby"?: string;
  "aria-invalid"?: AriaAttributes["aria-invalid"];
  children: ReactNode;
  ref?: Ref<HTMLDivElement>;
};

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
  const hasAutoFocusedRef = useRef(false);
  const { items, registerItem, unregisterItem } = useSelectableCollection(containerRef);
  const [value, setValue] = useControllableState<T[]>({
    value: "value" in props ? controlledValue ?? [] : undefined,
    controlled: "value" in props,
    defaultValue,
    onChange,
  });
  const [nativeInvalid, setNativeInvalid] = useState(false);
  useFormReset(containerRef, defaultValue, setValue, !("value" in props));

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
  }, [autoFocus, keyboardNavigation, disabled, items, highlightedValue, value, setHighlightedValue]);

  const toggle = useCallback((itemValue: string) => {
    if (disabled) return;
    setNativeInvalid(false);
    setValue((cur) => {
      const nextValue = itemValue as T;
      const selected = cur.includes(nextValue);
      return selected
        ? cur.filter((v) => v !== itemValue)
        : [...cur, nextValue];
    });
  }, [disabled, setValue]);

  const handleKeyDown = (event: ReactKeyboardEvent) => {
    const eventTarget = isHTMLElementForContainer(event.target, containerRef.current)
      ? event.target
      : null;
    if (
      eventTarget
      && eventTarget.closest('[role="group"]') !== containerRef.current
    ) {
      return;
    }

    onKeyDown?.(event);
    if (!event.defaultPrevented && event.key !== " ") navKeyDown(event);
  };

  const contextValue = useMemo(() => ({
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
  }), [value, toggle, registerItem, unregisterItem, disabled, size, variant, strikethrough, highlightedValue, name]);

  return (
    <CheckboxGroupContext value={contextValue}>
      <div
        {...rootProps}
        ref={composeRefs(containerRef, ref)}
        role="group"
        data-diffgazer-selectable-owner="checkbox"
        aria-label={ariaLabel ?? label}
        aria-labelledby={ariaLabelledBy}
        aria-disabled={disabled || undefined}
        aria-invalid={resolveAriaInvalid(ariaInvalid, nativeInvalid && required && !hasValidSelectedValue)}
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
