"use client";

import { Children, isValidElement, useMemo, type AriaAttributes, type ComponentPropsWithoutRef, type ReactNode, type Ref } from "react";
import { cva } from "class-variance-authority";
import { composeRefs } from "@/lib/compose-refs";
import { cn } from "@/lib/utils";
import { SelectContext, type SelectOptionMetadata } from "./select-context";
import { SelectItem, type SelectItemProps } from "./select-item";
import { SelectSearch } from "./select-search";
import { useSelectState } from "./use-select-state";

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

export function Select<TValue extends string = string>(props: SelectProps<TValue>) {
  const {
    open,
    onOpenChange,
    defaultOpen,
    value,
    onChange,
    defaultValue,
    highlighted,
    onHighlightChange,
    multiple,
    disabled = false,
    variant = "default",
    width,
    name,
    required,
    "aria-invalid": ariaInvalid,
    id: triggerIdProp,
    "aria-describedby": ariaDescribedBy,
    "aria-labelledby": ariaLabelledBy,
    children,
    className,
    ref,
    ...rootProps
  } = props;
  const openControlled = "open" in props;
  const valueControlled = "value" in props;
  const highlightedControlled = "highlighted" in props;
  const options = useMemo(() => collectSelectOptions(children), [children]);
  const searchable = useMemo(() => containsSelectSearchElement(children), [children]);

  // Public props narrow on TValue; internal state machine works with `string`/`string[]`
  // and DOM-derived data attributes. The relevant runtime values flow through unchanged.
  const stateOptions = multiple
    ? {
        open,
        openControlled,
        onOpenChange,
        defaultOpen,
        value: value as readonly string[] | undefined as string[] | undefined,
        valueControlled,
        onChange: onChange as ((value: string[]) => void) | undefined,
        defaultValue: defaultValue as readonly string[] | undefined as string[] | undefined,
        highlighted: highlighted as string | null | undefined,
        highlightedControlled,
        onHighlightChange: onHighlightChange as ((value: string | null) => void) | undefined,
        multiple: true as const,
        disabled,
        searchable,
        variant,
        ariaInvalid,
        ariaDescribedBy,
        ariaLabelledBy,
        triggerIdProp,
        required,
        options,
      }
    : {
        open,
        openControlled,
        onOpenChange,
        defaultOpen,
        value: value as string | undefined,
        valueControlled,
        onChange: onChange as ((value: string) => void) | undefined,
        defaultValue: defaultValue as string | undefined,
        highlighted: highlighted as string | null | undefined,
        highlightedControlled,
        onHighlightChange: onHighlightChange as ((value: string | null) => void) | undefined,
        multiple: false as const,
        disabled,
        searchable,
        variant,
        ariaInvalid,
        ariaDescribedBy,
        ariaLabelledBy,
        triggerIdProp,
        required,
        options,
      };

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
