"use client";

import { Children, isValidElement, useMemo, type AriaAttributes, type ComponentPropsWithoutRef, type ReactNode, type Ref } from "react";
import { composeRefs } from "@/lib/compose-refs";
import { cn } from "@/lib/utils";
import { SelectContext, type SelectOptionMetadata } from "./select-context";
import { SelectItem, type SelectItemProps } from "./select-item";
import { useSelectState } from "./use-select-state";

interface SelectBaseProps extends Omit<ComponentPropsWithoutRef<"div">, "defaultValue" | "onChange"> {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  defaultOpen?: boolean;
  highlighted?: string | null;
  onHighlightChange?: (value: string | null) => void;
  /** @deprecated Use `onHighlightChange` for controlled highlight updates. */
  onHighlight?: (value: string | null) => void;
  disabled?: boolean;
  variant?: "default" | "card";
  /** Sets the width of the Select container. "full" fills the parent. */
  width?: "sm" | "md" | "lg" | "full";
  /** Name attribute for the hidden form input */
  name?: string;
  required?: boolean;
  "aria-invalid"?: AriaAttributes["aria-invalid"];
  children: ReactNode;
  ref?: Ref<HTMLDivElement>;
}

interface SelectSingleProps extends SelectBaseProps {
  multiple?: false;
  value?: string;
  onValueChange?: (value: string) => void;
  /** @deprecated Use `onValueChange` for controlled value updates. */
  onChange?: (value: string) => void;
  defaultValue?: string;
}

interface SelectMultipleProps extends SelectBaseProps {
  multiple: true;
  value?: string[];
  onValueChange?: (value: string[]) => void;
  /** @deprecated Use `onValueChange` for controlled value updates. */
  onChange?: (value: string[]) => void;
  defaultValue?: string[];
}

export type SelectProps = SelectSingleProps | SelectMultipleProps;

const widthClasses = {
  sm: "w-48",
  md: "w-64",
  lg: "w-80",
  full: "w-full",
} satisfies Record<NonNullable<SelectBaseProps["width"]>, string>;

export function Select(props: SelectProps) {
  const {
    open,
    onOpenChange,
    defaultOpen,
    value,
    onValueChange,
    onChange,
    defaultValue,
    highlighted,
    onHighlightChange,
    onHighlight,
    multiple,
    disabled = false,
    variant = "default",
    width,
    name,
    required,
    "aria-invalid": ariaInvalid,
    children,
    className,
    ref,
    ...rootProps
  } = props;
  const openControlled = "open" in props;
  const valueControlled = "value" in props;
  const highlightedControlled = "highlighted" in props;
  const options = useMemo(() => collectSelectOptions(children), [children]);

  const stateOptions = props.multiple
    ? {
        open,
        openControlled,
        onOpenChange,
        defaultOpen,
        value: props.value,
        valueControlled,
        onValueChange: props.onValueChange,
        onChange: props.onChange,
        defaultValue: props.defaultValue,
        highlighted,
        highlightedControlled,
        onHighlightChange,
        onHighlight,
        multiple: true as const,
        disabled,
        variant,
        ariaInvalid,
        required,
        options,
      }
    : {
        open,
        openControlled,
        onOpenChange,
        defaultOpen,
        value: props.value,
        valueControlled,
        onValueChange: props.onValueChange,
        onChange: props.onChange,
        defaultValue: props.defaultValue,
        highlighted,
        highlightedControlled,
        onHighlightChange,
        onHighlight,
        multiple: false as const,
        disabled,
        variant,
        ariaInvalid,
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
          "relative",
          width && widthClasses[width],
          variant === "card" && "border border-foreground bg-background shadow-[8px_8px_0px_0px_color-mix(in_srgb,var(--border)_50%,transparent)]",
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
