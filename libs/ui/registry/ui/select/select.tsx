"use client";

import { cva } from "class-variance-authority";
import { type AriaAttributes, Children, type ComponentPropsWithoutRef, isValidElement, type ReactNode, type Ref, useMemo } from "react";
import { composeRefs } from "@/lib/compose-refs";
import { cn } from "@/lib/utils";
import { SelectContext, type SelectOptionMetadata } from "./select-context";
import { SelectItem, type SelectItemProps } from "./select-item";
import { SelectSearch } from "./select-search";
import { type UseSelectStateOptions, useSelectState } from "./use-state-machine";

interface SelectBaseProps<TValue extends string = string>
  extends Omit<ComponentPropsWithoutRef<"div">, "defaultValue" | "onChange" | "id"> {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  defaultOpen?: boolean;
  highlighted?: TValue | null;
  onHighlightChange?: (value: TValue | null) => void;
  disabled?: boolean;
  variant?: "default" | "card";
  width?: "sm" | "md" | "lg" | "full";
  name?: string;
  required?: boolean;
  "aria-invalid"?: AriaAttributes["aria-invalid"];
  id?: string;
  "aria-describedby"?: string;
  "aria-labelledby"?: string;
  children: ReactNode;
  ref?: Ref<HTMLDivElement>;
}

interface SelectSingleProps<TValue extends string = string> extends SelectBaseProps<TValue> {
  multiple?: false;
  value?: TValue;
  onChange?: (value: TValue) => void;
  defaultValue?: TValue;
}

interface SelectMultipleProps<TValue extends string = string> extends SelectBaseProps<TValue> {
  multiple: true;
  value?: TValue[];
  onChange?: (value: TValue[]) => void;
  defaultValue?: TValue[];
}

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
  options: ReadonlyMap<string, SelectOptionMetadata>;
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
    options: derived.options,
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
  const options = useMemo(() => collectSelectOptions(children), [children]);
  const searchable = useMemo(() => containsSelectSearchElement(children), [children]);

  const stateOptions = buildSelectStateOptions(props, {
    openControlled: "open" in props,
    valueControlled: "value" in props,
    highlightedControlled: "highlighted" in props,
    searchable,
    options,
  });

  const { contextValue, wrapperRef } = useSelectState(stateOptions);

  return (
    <SelectContext value={contextValue}>
      <div
        {...rootProps}
        ref={composeRefs(wrapperRef, ref)}
        className={cn(
          selectRootVariants({ variant, width: width ?? undefined }),
          className
        )}
      >
        {children}
        {(name || required) && (
          Array.isArray(contextValue.value)
            ? (
                <>
                  <select
                    name={name}
                    multiple
                    value={contextValue.value}
                    required={required}
                    disabled={disabled}
                    tabIndex={-1}
                    aria-hidden={true}
                    aria-label={typeof name === "string" ? name : undefined}
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
                      <option key={v} value={v}>{v}</option>
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
                      aria-label={typeof name === "string" ? `${name} required` : undefined}
                      readOnly
                      className="sr-only"
                      onInvalid={(event) => {
                        event.preventDefault();
                        contextValue.onNativeInvalid();
                      }}
                    />
                  )}
                </>
              )
            : (
                <select
                  name={name}
                  value={contextValue.value ?? ""}
                  required={required}
                  disabled={disabled}
                  tabIndex={-1}
                  aria-hidden={true}
                  aria-label={typeof name === "string" ? name : undefined}
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
                  {contextValue.value !== null && <option value={contextValue.value}>{contextValue.value}</option>}
                </select>
              )
        )}
      </div>
    </SelectContext>
  );
}

function collectSelectOptions(children: ReactNode): ReadonlyMap<string, SelectOptionMetadata> {
  const options = new Map<string, SelectOptionMetadata>();

  Children.forEach(children, (child) => {
    if (!isValidElement<{ children?: ReactNode }>(child)) return;

    if (child.type === SelectItem) {
      const props = child.props as SelectItemProps;
      options.set(props.value, {
        label: props.textValue ?? getNodeText(props.children) ?? props.value,
        disabled: props.disabled ?? false,
      });
      return;
    }

    const nested = collectSelectOptions(child.props.children);
    for (const [value, metadata] of nested) options.set(value, metadata);
  });

  return options;
}

function getNodeText(node: ReactNode): string | undefined {
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) {
    const text = node.map(getNodeText).filter(Boolean).join("");
    return text || undefined;
  }
  if (isValidElement<{ children?: ReactNode }>(node)) return getNodeText(node.props.children);
  return undefined;
}

function containsSelectSearchElement(children: ReactNode): boolean {
  return Children.toArray(children).some((child) => {
    if (!isValidElement<{ children?: ReactNode }>(child)) return false;
    if (child.type === SelectSearch) return true;
    return containsSelectSearchElement(child.props.children);
  });
}
