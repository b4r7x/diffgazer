"use client";

import {
  type AriaAttributes,
  type ComponentPropsWithRef,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
  type Ref,
  useCallback,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import { useComposedRefs } from "@/hooks/use-composed-refs";
import { useControllableState } from "@/hooks/use-controllable-state";
import { useFormReset } from "@/hooks/use-form-reset";
import { useNavigation } from "@/hooks/use-navigation";
import { isAriaInvalid, isHTMLElementForContainer, mergeIds, resolveAriaInvalid } from "@/lib/aria";
import { useFieldsetDisabled } from "@/lib/fieldset-disabled";
import {
  getEnabledSelectableCollectionItems,
  useSelectableCollection,
} from "@/lib/selectable-collection";
import { useSelectableGroupAutoFocus } from "@/lib/selectable-group";
import { type SelectableVariant, selectableGroupLabelVariants } from "@/lib/selectable-variants";
import { cn } from "@/lib/utils";
import type { CheckboxSize } from "./checkbox";
import { CheckboxGroupContext } from "./checkbox-group-context";

// Stable identity so the controlled-undefined path and the default do not
// invalidate the context memo on every render. Frozen because one array is
// shared by every group in the process and reaches consumers through onChange.
const EMPTY_VALUES = Object.freeze<string[]>([]) as string[];

// k/j mirror ArrowUp/ArrowDown -- the vim contract RadioGroup lists already
// follow. useNavigation ignores editable targets, so the aliases stay safe
// next to nested inputs.
const CHECKBOX_PREVIOUS_KEYS = ["ArrowUp", "k"] as const;
const CHECKBOX_NEXT_KEYS = ["ArrowDown", "j"] as const;

/** Props for checkbox group root. */
type CheckboxGroupRootProps = Omit<
  ComponentPropsWithRef<"div">,
  | "children"
  | "role"
  | "value"
  | "defaultValue"
  | "onChange"
  | "onKeyDown"
  | "className"
  | "ref"
  | "aria-label"
  | "aria-labelledby"
  | "aria-disabled"
  | "aria-invalid"
>;

export type CheckboxGroupProps = CheckboxGroupRootProps & {
  /** Controlled selected item values. */
  value?: string[];
  /** Initial selected values for uncontrolled usage. */
  defaultValue?: string[];
  /** Called when the selected values change. */
  onChange?: (value: string[]) => void;
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
export function CheckboxGroup(props: CheckboxGroupProps) {
  const {
    value: controlledValue,
    defaultValue = EMPTY_VALUES,
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
  const fieldsetDisabled = useFieldsetDisabled(containerRef);
  const isDisabled = disabled || fieldsetDisabled;
  const { items, registerItem, unregisterItem } = useSelectableCollection(containerRef);

  const [value, setValue, , resetValue] = useControllableState<string[]>(
    "value" in props
      ? { controlled: true, value: controlledValue ?? EMPTY_VALUES, defaultValue, onChange }
      : { defaultValue, onChange },
  );
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
  const resolvedAriaInvalid = resolveAriaInvalid(
    ariaInvalid,
    nativeInvalid && required && !hasValidSelectedValue,
  );

  const [highlightedValue, setHighlightedValue] = useControllableState<string | null>(
    "highlighted" in props
      ? {
          controlled: true,
          value: controlledHighlighted ?? null,
          defaultValue: null,
          onChange: onHighlightChange,
        }
      : { defaultValue: null, onChange: onHighlightChange },
  );

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
    upKeys: CHECKBOX_PREVIOUS_KEYS,
    downKeys: CHECKBOX_NEXT_KEYS,
    ownerSelector: '[data-diffgazer-selectable-owner="checkbox"]',
  });

  useSelectableGroupAutoFocus({
    autoFocus,
    keyboardNavigation,
    disabled: isDisabled,
    items,
    highlightedValue,
    selectedValue: value,
    setHighlightedValue,
  });

  const toggle = useCallback(
    (itemValue: string) => {
      if (isDisabled) return;
      invalidatePendingReset();
      setNativeInvalid(false);
      setValue((cur) => {
        const selected = cur.includes(itemValue);
        return selected ? cur.filter((value) => value !== itemValue) : [...cur, itemValue];
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
    // Space belongs to the item toggle, never to group navigation.
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
      {/* Single wrapper so the visible label always stacks above the items,
          including when the group is dropped into a flex-row parent. */}
      <div data-slot="checkbox-group-root" className="flex flex-col gap-2">
        {label && (
          <div
            id={labelId}
            data-slot="checkbox-group-label"
            className={selectableGroupLabelVariants({
              invalid: isAriaInvalid(resolvedAriaInvalid),
              size,
            })}
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
          aria-invalid={resolvedAriaInvalid}
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
      </div>
    </CheckboxGroupContext>
  );
}
