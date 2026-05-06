"use client";

import type { ReactNode, Ref } from "react";
import { Checkbox } from "./checkbox";
import { useCheckboxGroupContext } from "./checkbox-group-context";

export type CheckboxItemProps = {
  value: string;
  label: ReactNode;
  description?: ReactNode;
  disabled?: boolean;
  className?: string;
  ref?: Ref<HTMLDivElement>;
};

export function CheckboxItem({ value, label, description, disabled = false, className, ref }: CheckboxItemProps) {
  const ctx = useCheckboxGroupContext();
  const isDisabled = disabled || ctx.disabled;

  return (
    <Checkbox
      ref={ref}
      value={value}
      data-value={value}
      checked={ctx.value.includes(value)}
      onChange={() => ctx.toggle(value)}
      onMouseEnter={isDisabled ? undefined : () => ctx.onHighlightChange?.(value)}
      label={label}
      description={description}
      disabled={isDisabled}
      highlighted={ctx.highlightedValue === value}
      size={ctx.size}
      variant={ctx.variant}
      strikethrough={ctx.strikethrough}
      name={ctx.name}
      className={className}
    />
  );
}
