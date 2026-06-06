"use client";

import { type ReactNode, useId, useLayoutEffect, useRef } from "react";
import { composeRefs } from "@/lib/compose-refs";
import { Radio, type RadioProps } from "./radio";
import { useRadioGroupContext } from "./radio-group-context";

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
  value: TValue;
  label: ReactNode;
  description?: ReactNode;
  disabled?: boolean;
}

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
  const isSelected = context.value === value;
  const isDisabled = context.disabled || !!itemDisabled;
  const isHighlighted = context.highlightedValue === value;
  const isTabTarget = !isDisabled && (!context.keyboardNavigation || context.tabTargetValue === value);
  const { registerItem, unregisterItem } = context;

  useLayoutEffect(() => {
    registerItem(itemId, value, itemDisabled === true, rootRef.current);
    return () => unregisterItem(itemId);
  }, [registerItem, unregisterItem, itemId, value, itemDisabled]);

  return (
    <Radio
      {...radioProps}
      ref={composeRefs(rootRef, ref)}
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
