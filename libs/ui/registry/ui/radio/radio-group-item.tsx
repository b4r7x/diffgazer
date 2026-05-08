"use client";

import { type ReactNode } from "react";
import { useRadioGroupContext } from "./radio-group-context";
import { Radio } from "./radio";

export interface RadioGroupItemProps {
  value: string;
  label: ReactNode;
  description?: ReactNode;
  disabled?: boolean;
  className?: string;
}

export function RadioGroupItem({
  value,
  label,
  description,
  disabled: itemDisabled,
  className,
}: RadioGroupItemProps) {
  const context = useRadioGroupContext();
  const isSelected = context.value === value;
  const isDisabled = context.disabled || !!itemDisabled;
  const isHighlighted = context.highlightedValue === value;
  const isTabTarget = !isDisabled && context.tabTargetValue === value;

  return (
    <Radio
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
      className={className}
    />
  );
}
