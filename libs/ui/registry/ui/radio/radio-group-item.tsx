"use client";

import type { ReactNode } from "react";
import { useRadioGroupContext } from "./radio-group-context";
import { Radio } from "./radio";
import { resolveTabTarget } from "@/lib/resolve-tab-target";

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
  const hasSelection = context.value !== undefined;
  const isTabTarget = resolveTabTarget(isSelected, hasSelection, context.containerRef.current, value);

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