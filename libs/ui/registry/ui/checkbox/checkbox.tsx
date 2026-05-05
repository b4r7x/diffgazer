"use client";

import { useId, type KeyboardEvent as ReactKeyboardEvent, type ReactNode, type Ref } from "react";
import { useControllableState } from "@/hooks/use-controllable-state";
import {
  selectableVariants,
  selectableContainerClass,
  selectableIndicatorVariants,
  selectableLabelVariants,
  selectableDescriptionVariants,
  selectableIndicators,
  type SelectableSize,
  type SelectableVariant,
} from "@/lib/selectable-variants";
import { cn } from "@/lib/utils";

function resolveCheckboxState(indeterminate: boolean, checked: boolean) {
  if (indeterminate) return "indeterminate" as const;
  if (checked) return "checked" as const;
  return "unchecked" as const;
}

export type CheckboxSize = SelectableSize;

export type CheckboxVariant = SelectableVariant;

export type CheckboxProps = {
  checked?: boolean | "indeterminate";
  defaultChecked?: boolean;
  onChange?: (checked: boolean) => void;
  onMouseEnter?: () => void;
  label?: ReactNode;
  description?: ReactNode;
  disabled?: boolean;
  highlighted?: boolean;
  size?: CheckboxSize;
  variant?: CheckboxVariant;
  strikethrough?: boolean;
  value?: string;
  name?: string;
  required?: boolean;
  invalid?: boolean;
  "aria-label"?: string;
  "aria-invalid"?: boolean;
  className?: string;
  "data-value"?: string;
  ref?: Ref<HTMLDivElement>;
};

export function Checkbox({
  checked: controlledChecked,
  defaultChecked = false,
  onChange,
  onMouseEnter,
  label,
  description,
  disabled = false,
  highlighted = false,
  size = "md",
  variant = "x",
  strikethrough = false,
  value = "on",
  name,
  required,
  invalid,
  "aria-label": ariaLabel,
  "aria-invalid": ariaInvalid,
  className,
  "data-value": dataValue,
  ref,
}: CheckboxProps) {
  const generatedId = useId();
  const labelId = `${generatedId}-label`;
  const descriptionId = `${generatedId}-desc`;
  const isIndeterminate = controlledChecked === "indeterminate";
  const controlledBool = controlledChecked === undefined
    ? undefined
    : controlledChecked === true;

  const [isChecked, setIsChecked] = useControllableState<boolean>({
    value: controlledBool,
    defaultValue: defaultChecked,
    onChange,
  });
  const state = resolveCheckboxState(isIndeterminate, isChecked);

  const toggle = () => {
    if (disabled) return;
    setIsChecked(!isChecked);
  };

  const handleKeyDown = (e: ReactKeyboardEvent) => {
    if (e.key === " ") {
      e.preventDefault();
      toggle();
    }
  };

  const indicator = selectableIndicators[variant][state];

  return (
    <div
      ref={ref}
      role="checkbox"
      data-value={dataValue}
      aria-checked={isIndeterminate ? "mixed" : isChecked}
      aria-disabled={disabled || undefined}
      aria-required={required || undefined}
      aria-invalid={invalid || ariaInvalid || undefined}
      aria-label={ariaLabel}
      aria-labelledby={!ariaLabel && label ? labelId : undefined}
      aria-describedby={description ? descriptionId : undefined}
      tabIndex={disabled ? -1 : 0}
      onClick={toggle}
      onKeyDown={handleKeyDown}
      onMouseEnter={onMouseEnter}
      className={cn(
        selectableVariants({ highlighted, disabled }),
        selectableContainerClass,
        description && "items-start",
        className,
      )}
    >
      <input
        type="checkbox"
        name={name}
        value={value}
        checked={isChecked}
        required={required}
        disabled={disabled}
        className="sr-only"
        tabIndex={-1}
        readOnly
        aria-hidden="true"
      />
      <span aria-hidden="true" className={selectableIndicatorVariants({ size, checked: isChecked, highlighted })}>
        {indicator}
      </span>
      {label && (
        <div className={cn("flex flex-col min-w-0", !description && "justify-center")}>
          <span id={labelId} className={cn(selectableLabelVariants({ size }), strikethrough && isChecked && "text-muted-foreground line-through")}>{label}</span>
          {description && (
            <span id={descriptionId} className={selectableDescriptionVariants({ highlighted })}>{description}</span>
          )}
        </div>
      )}
    </div>
  );
}
