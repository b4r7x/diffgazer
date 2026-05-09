"use client";

import { useId, useLayoutEffect, useRef, type ReactNode, type Ref } from "react";
import { composeRefs } from "@/lib/compose-refs";
import { Checkbox, type CheckboxProps } from "./checkbox";
import { useCheckboxGroupContext } from "./checkbox-group-context";

export type CheckboxItemProps = Omit<
  CheckboxProps,
  | "checked"
  | "defaultChecked"
  | "onChange"
  | "highlighted"
  | "size"
  | "variant"
  | "strikethrough"
  | "name"
  | "value"
  | "data-value"
  | "required"
> & {
  value: string;
  label: ReactNode;
  description?: ReactNode;
  disabled?: boolean;
  ref?: Ref<HTMLDivElement>;
};

export function CheckboxItem({ value, label, description, disabled = false, ref, ...checkboxProps }: CheckboxItemProps) {
  const ctx = useCheckboxGroupContext();
  const itemId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const isDisabled = disabled || ctx.disabled;
  const { registerItem, unregisterItem } = ctx;

  useLayoutEffect(() => {
    registerItem(itemId, value, disabled, rootRef.current);
    return () => unregisterItem(itemId);
  }, [registerItem, unregisterItem, itemId, value, disabled]);

  return (
    <Checkbox
      {...checkboxProps}
      ref={composeRefs(rootRef, ref)}
      value={value}
      data-value={value}
      checked={ctx.value.includes(value)}
      onChange={() => ctx.toggle(value)}
      label={label}
      description={description}
      disabled={isDisabled}
      highlighted={ctx.highlightedValue === value}
      size={ctx.size}
      variant={ctx.variant}
      strikethrough={ctx.strikethrough}
      name={ctx.name}
    />
  );
}
