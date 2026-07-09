"use client";

import { cva } from "class-variance-authority";
import {
  type AriaAttributes,
  Children,
  type ComponentPropsWithoutRef,
  isValidElement,
  type ReactNode,
  type Ref,
  useMemo,
} from "react";
import { useComposedRefs } from "@/hooks/use-composed-refs";
import { cn } from "@/lib/utils";
import { SelectContext, type SelectOptionMetadata } from "./select-context";
import { SelectItem, type SelectItemProps } from "./select-item";
import { SelectSearch } from "./select-search";
import { containsSelectSearchElement, getNodeText } from "./selection";
import { type UseSelectStateOptions, useSelectState } from "./use-state";

/** Props for select base. */
interface SelectBaseProps<TValue extends string = string>
  extends Omit<ComponentPropsWithoutRef<"div">, "defaultValue" | "onChange" | "id"> {
  /** Controlled open state. Pair with onOpenChange. */
  open?: boolean;
  /** Called when open state changes. */
  onOpenChange?: (open: boolean) => void;
  /**
   * Initial open state for uncontrolled usage. Useful with variant="card" for a settings-panel
   * layout that renders its list immediately.
   */
  defaultOpen?: boolean;
  /** Controlled highlighted item id. Pair with onHighlightChange. */
  highlighted?: TValue | null;
  /** Called when the highlighted item changes via keyboard or search. */
  onHighlightChange?: (value: TValue | null) => void;
  /** Disable the trigger and prevent open. */
  disabled?: boolean;
  /**
   * Visual treatment. "card" renders the inline settings-panel layout (combine with
   * defaultOpen).
   */
  variant?: "default" | "card";
  /** Width preset for the Select container. "full" fills the parent. */
  width?: "sm" | "md" | "lg" | "full";
  /** Name for the hidden form input that participates in native form submission. */
  name?: string;
  /** Mark the select as required for native form validation. */
  required?: boolean;
  /** ARIA invalid state forwarded to the rendered control. */
  "aria-invalid"?: AriaAttributes["aria-invalid"];
  /** ID applied to the rendered element. */
  id?: string;
  /** ID of the element that describes this component. */
  "aria-describedby"?: string;
  /** ID of the element that labels this component. */
  "aria-labelledby"?: string;
  /** Content rendered inside the component. */
  children: ReactNode;
  /** Ref forwarded to the underlying element. */
  ref?: Ref<HTMLDivElement>;
}

/** Props for select in single-selection mode. */
interface SelectSingleProps<TValue extends string = string> extends SelectBaseProps<TValue> {
  /** Enable multi-select. value/onChange become string[]. */
  multiple?: false;
  /** Controlled selected value. string[] when multiple, string in single mode. */
  value?: TValue;
  /** Called when the selection changes. */
  onChange?: (value: TValue) => void;
  /** Initial selected value for uncontrolled usage. */
  defaultValue?: TValue;
}

/** Props for select in multiple-selection mode. */
interface SelectMultipleProps<TValue extends string = string> extends SelectBaseProps<TValue> {
  /** Enable multi-select. value/onChange become string[]. */
  multiple: true;
  /** Controlled selected value. string[] when multiple, string in single mode. */
  value?: TValue[];
  /** Called when the selection changes. */
  onChange?: (value: TValue[]) => void;
  /** Initial selected value for uncontrolled usage. */
  defaultValue?: TValue[];
}

/** Props for select. */
export type SelectProps<TValue extends string = string> =
  | SelectSingleProps<TValue>
  | SelectMultipleProps<TValue>;

const selectRootVariants = cva("relative", {
  variants: {
    variant: {
      default: "",
      card: "border border-foreground bg-background shadow-[8px_8px_0px_0px_color-mix(in_srgb,var(--border)_50%,transparent)]",
    },
    width: {
      sm: "w-48",
      md: "w-64",
      lg: "w-80",
      full: "w-full",
    },
  },
  defaultVariants: { variant: "default" },
});

interface DerivedSelectStateOptions {
  openControlled: boolean;
  valueControlled: boolean;
  highlightedControlled: boolean;
  searchable: boolean;
  seedOptions: ReadonlyMap<string, SelectOptionMetadata>;
}

// Single typed boundary for the public TValue -> internal string narrowing.
// value/defaultValue/highlighted widen covariantly; only the value/highlight
// callbacks are contravariant, so they get an explicit (identity-preserving)
// cast here instead of scattering casts across the component body.
function buildSelectStateOptions<TValue extends string>(
  props: SelectProps<TValue>,
  derived: DerivedSelectStateOptions,
): UseSelectStateOptions {
  const shared = {
    open: props.open,
    openControlled: derived.openControlled,
    onOpenChange: props.onOpenChange,
    defaultOpen: props.defaultOpen,
    valueControlled: derived.valueControlled,
    highlighted: props.highlighted ?? undefined,
    highlightedControlled: derived.highlightedControlled,
    onHighlightChange: props.onHighlightChange as ((value: string | null) => void) | undefined,
    disabled: props.disabled ?? false,
    searchable: derived.searchable,
    variant: props.variant ?? "default",
    ariaInvalid: props["aria-invalid"],
    ariaDescribedBy: props["aria-describedby"],
    ariaLabelledBy: props["aria-labelledby"],
    triggerIdProp: props.id,
    required: props.required,
    seedOptions: derived.seedOptions,
  };

  if (props.multiple) {
    return {
      ...shared,
      multiple: true,
      value: props.value,
      defaultValue: props.defaultValue,
      onChange: props.onChange as ((value: string[]) => void) | undefined,
    };
  }
  return {
    ...shared,
    multiple: false,
    value: props.value,
    defaultValue: props.defaultValue,
    onChange: props.onChange as ((value: string) => void) | undefined,
  };
}

/**
 * Dropdown select with search, multiple selection, card variant, and controlled keyboard
 * integration points. 8 composable parts.
 */
export function Select<TValue extends string = string>(props: SelectProps<TValue>) {
  const {
    children,
    className,
    ref,
    width,
    name,
    required,
    disabled = false,
    variant = "default",
    // Destructured only to keep select-specific props off the wrapper <div>;
    // the state machine reads them from the discriminated `props` below.
    open: _open,
    onOpenChange: _onOpenChange,
    defaultOpen: _defaultOpen,
    value: _value,
    onChange: _onChange,
    defaultValue: _defaultValue,
    highlighted: _highlighted,
    onHighlightChange: _onHighlightChange,
    multiple: _multiple,
    "aria-invalid": _ariaInvalid,
    id: _id,
    "aria-describedby": _ariaDescribedBy,
    "aria-labelledby": _ariaLabelledBy,
    ...rootProps
  } = props;
  const searchable = containsSelectSearchElement(children, isSelectSearchElement);
  // Seed labels for direct-child items so the trigger/value display works while
  // the (portaled) dropdown is closed and its items are unmounted. Registration
  // is authoritative whenever items are mounted (open) and is the only path that
  // resolves wrapper-rendered or dynamically composed items.
  const seedOptions = useMemo(() => collectSeedOptions(children), [children]);

  const stateOptions = buildSelectStateOptions(props, {
    openControlled: "open" in props,
    valueControlled: "value" in props,
    highlightedControlled: "highlighted" in props,
    searchable,
    seedOptions,
  });

  const { contextValue, wrapperRef } = useSelectState(stateOptions);
  const composedRef = useComposedRefs(wrapperRef, ref);

  return (
    <SelectContext value={contextValue}>
      <div
        {...rootProps}
        ref={composedRef}
        className={cn(selectRootVariants({ variant, width: width ?? undefined }), className)}
      >
        {children}
        {(name || required) &&
          (Array.isArray(contextValue.value) ? (
            <>
              <select
                name={name}
                multiple
                value={contextValue.value}
                required={required}
                disabled={disabled}
                tabIndex={-1}
                aria-hidden={true}
                className="sr-only"
                // Value is driven by the custom select; the no-op keeps this
                // hidden form mirror controlled without React's warning.
                onChange={() => {}}
                onInvalid={(event) => {
                  event.preventDefault();
                  contextValue.onNativeInvalid();
                }}
              >
                {contextValue.value.map((v) => (
                  <option key={v} value={v}>
                    {v}
                  </option>
                ))}
              </select>
              {required && (
                <input
                  type="checkbox"
                  required
                  checked={contextValue.value.length > 0}
                  disabled={disabled}
                  tabIndex={-1}
                  aria-hidden={true}
                  readOnly
                  className="sr-only"
                  onInvalid={(event) => {
                    event.preventDefault();
                    contextValue.onNativeInvalid();
                  }}
                />
              )}
            </>
          ) : (
            <select
              name={name}
              value={contextValue.value ?? ""}
              required={required}
              disabled={disabled}
              tabIndex={-1}
              aria-hidden={true}
              className="sr-only"
              // Value is driven by the custom select; the no-op keeps this
              // hidden form mirror controlled without React's warning.
              onChange={() => {}}
              onInvalid={(event) => {
                event.preventDefault();
                contextValue.onNativeInvalid();
              }}
            >
              <option value="" />
              {contextValue.value !== null && (
                <option value={contextValue.value}>{contextValue.value}</option>
              )}
            </select>
          ))}
      </div>
    </SelectContext>
  );
}

// Static seed for direct-child SelectItems. Used only to display the selected
// label while the dropdown is closed (items unmounted). It deliberately does NOT
// gate selectability — mounted items register through context, which is the only
// path that resolves wrapper-rendered or dynamic items.
function collectSeedOptions(children: ReactNode): ReadonlyMap<string, SelectOptionMetadata> {
  const seed = new Map<string, SelectOptionMetadata>();

  Children.forEach(children, (child) => {
    if (!isValidElement<{ children?: ReactNode }>(child)) return;

    if (child.type === SelectItem) {
      const itemProps = child.props as SelectItemProps;
      seed.set(itemProps.value, {
        label: itemProps.textValue ?? getNodeText(itemProps.children) ?? itemProps.value,
        disabled: itemProps.disabled ?? false,
      });
      return;
    }

    for (const [value, metadata] of collectSeedOptions(child.props.children)) {
      seed.set(value, metadata);
    }
  });

  return seed;
}

function isSelectSearchElement(child: ReactNode): boolean {
  return isValidElement(child) && child.type === SelectSearch;
}
