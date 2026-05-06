"use client";

import { useLayoutEffect, type ReactNode } from "react";
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
  const { registerItem } = context;
  const isSelected = context.value === value;
  const isDisabled = context.disabled || !!itemDisabled;
  const isHighlighted = context.highlightedValue === value;
  const hasSelection = context.value !== undefined;
  const isTabTarget = !isDisabled && (isSelected || (!hasSelection && context.firstEnabledValue === value));

  useLayoutEffect(() => {
    return registerItem(value, isDisabled);
  }, [isDisabled, registerItem, value]);

  return (
    <Radio
      data-value={value}
      checked={isSelected}
      isTabTarget={isTabTarget}
      onChange={() => context.onChange(value)}
      onMouseEnter={isDisabled ? undefined : () => context.onHighlightChange(value)}
      label={label}
      description={description}
      disabled={isDisabled}
      highlighted={isHighlighted}
      size={context.size}
      variant={context.variant}
      name={context.name}
      required={context.required}
      className={className}
    />
  );
}
