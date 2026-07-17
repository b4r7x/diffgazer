"use client";

import { type ReactNode, useId, useLayoutEffect, useRef } from "react";
import { useComposedRefs } from "@/hooks/use-composed-refs";
import { Radio, type RadioProps } from "./radio";
import { useRadioGroupContext } from "./radio-group-context";

/** Props for radio group item. */
export interface RadioGroupItemProps<TValue extends string = string>
  extends Omit<
    RadioProps,
    | "checked"
    | "defaultChecked"
    | "isTabTarget"
    | "onChange"
    | "highlighted"
    | "size"
    | "variant"
    | "name"
    | "required"
    | "onNativeInvalid"
    | "value"
    | "data-value"
  > {
  /** Item value. Must be unique within the group. */
  value: TValue;
  /** Visible item label. */
  label: ReactNode;
  /** Visible item description wired with aria-describedby. */
  description?: ReactNode;
  /** Disables the item. */
  disabled?: boolean;
}

/** Standalone radio button (controlled or uncontrolled) */
export function RadioGroupItem<TValue extends string = string>({
  value,
  label,
  description,
  disabled: itemDisabled,
  ref,
  ...radioProps
}: RadioGroupItemProps<TValue>) {
  const context = useRadioGroupContext();
  const itemId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const composedRef = useComposedRefs(rootRef, ref);
  const isSelected = context.value === value;
  const isDisabled = context.disabled || !!itemDisabled;
  const isHighlighted = context.highlightedValue === value;
  const isTabTarget =
    !isDisabled && (!context.keyboardNavigation || context.tabTargetValue === value);
  const { registerItem, unregisterItem } = context;

  useLayoutEffect(() => {
    registerItem(itemId, value, isDisabled, rootRef.current);
    return () => unregisterItem(itemId);
  }, [registerItem, unregisterItem, itemId, value, isDisabled]);

  return (
    <Radio
      {...radioProps}
      ref={composedRef}
      data-diffgazer-radio-group-item=""
      data-value={value}
      value={value}
      checked={isSelected}
      isTabTarget={isTabTarget}
      onChange={() => context.onChange(value)}
      label={label}
      description={description}
      disabled={isDisabled}
      highlighted={isHighlighted}
      size={context.size}
      variant={context.variant}
      name={context.name}
      required={context.name ? context.required : undefined}
      onNativeInvalid={context.onRequiredInvalid}
    />
  );
}
