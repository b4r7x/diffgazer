"use client";

import { Children, isValidElement, useMemo, type AriaAttributes, type ComponentPropsWithoutRef, type ReactNode, type Ref } from "react";
import { composeRefs } from "@/lib/compose-refs";
import { cn } from "@/lib/utils";
import { SelectContext, type SelectOptionMetadata } from "./select-context";
import { SelectItem, type SelectItemProps } from "./select-item";
import { SelectSearch } from "./select-search";
import { useSelectState } from "./use-select-state";

interface SelectBaseProps extends Omit<ComponentPropsWithoutRef<"div">, "defaultValue" | "onChange" | "id"> {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  defaultOpen?: boolean;
  highlighted?: string | null;
  onHighlightChange?: (value: string | null) => void;
  disabled?: boolean;
  variant?: "default" | "card";
  /** Sets the width of the Select container. "full" fills the parent. */
  width?: "sm" | "md" | "lg" | "full";
  /** Name attribute for the hidden form input */
  name?: string;
  required?: boolean;
  "aria-invalid"?: AriaAttributes["aria-invalid"];
  /** Applied to the interactive combobox trigger so labels can target it. */
  id?: string;
  /** Applied to the trigger so description/error live on the combobox itself. */
  "aria-describedby"?: string;
  /** Applied to the trigger so a Field.Label can name the combobox. */
  "aria-labelledby"?: string;
  children: ReactNode;
  ref?: Ref<HTMLDivElement>;
}

interface SelectSingleProps extends SelectBaseProps {
  multiple?: false;
  value?: string;
  onChange?: (value: string) => void;
  defaultValue?: string;
}

interface SelectMultipleProps extends SelectBaseProps {
  multiple: true;
  value?: string[];
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

  const stateOptions = multiple
    ? {
        open,
        openControlled,
        onOpenChange,
        defaultOpen,
        value: value as string[] | undefined,
        valueControlled,
        onChange: onChange as ((value: string[]) => void) | undefined,
        defaultValue: defaultValue as string[] | undefined,
        highlighted,
        highlightedControlled,
        onHighlightChange,
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
        highlighted,
        highlightedControlled,
        onHighlightChange,
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

function containsSelectSearchElement(children: ReactNode): boolean {
  return Children.toArray(children).some((child) => {
    if (!isValidElement<{ children?: ReactNode }>(child)) return false;
    if (child.type === SelectSearch) return true;
    return containsSelectSearchElement(child.props.children);
  });
}
