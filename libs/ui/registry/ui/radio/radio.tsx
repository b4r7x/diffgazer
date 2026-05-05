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

export type RadioSize = SelectableSize;

export interface RadioProps {
  checked?: boolean;
  defaultChecked?: boolean;
  isTabTarget?: boolean;
  onChange?: (checked: boolean) => void;
  onMouseEnter?: () => void;
  label?: ReactNode;
  description?: ReactNode;
  disabled?: boolean;
  highlighted?: boolean;
  size?: RadioSize;
  name?: string;
  required?: boolean;
  invalid?: boolean;
  variant?: SelectableVariant;
  "aria-label"?: string;
  "aria-invalid"?: boolean;
  className?: string;
  ref?: Ref<HTMLDivElement>;
  "data-value"?: string;
}

export function Radio({
  checked,
  defaultChecked = false,
  isTabTarget = true,
  onChange,
  onMouseEnter,
  label,
  description,
  disabled = false,
  highlighted = false,
  size = "md",
  variant = "bullet",
  name,
  required,
  invalid,
  "aria-label": ariaLabel,
  "aria-invalid": ariaInvalid,
  className,
  ref,
  "data-value": dataValue,
}: RadioProps) {
  const generatedId = useId();
  const labelId = `${generatedId}-label`;
  const descriptionId = `${generatedId}-desc`;

  const [isChecked, setIsChecked] = useControllableState<boolean>({
    value: checked,
    defaultValue: defaultChecked,
    onChange,
  });

  const toggle = () => {
    if (disabled) return;
    setIsChecked(true);
  };

  const handleKeyDown = (e: ReactKeyboardEvent) => {
    if (disabled) return;
    if (e.key === " ") {
      e.preventDefault();
      toggle();
    }
  };

  return (
    <div
      ref={ref}
      role="radio"
      data-value={dataValue}
      aria-checked={isChecked}
      aria-disabled={disabled || undefined}
      aria-invalid={invalid || ariaInvalid || undefined}
      aria-label={ariaLabel}
      aria-labelledby={!ariaLabel && label ? labelId : undefined}
      aria-describedby={description ? descriptionId : undefined}
      tabIndex={!disabled && isTabTarget ? 0 : -1}
      onClick={toggle}
      onKeyDown={handleKeyDown}
      onMouseEnter={onMouseEnter}
      className={cn(
        selectableVariants({ highlighted, disabled }),
        selectableContainerClass,
        description && "items-start",
        className
      )}
    >
      <input
        type="radio"
        name={name}
        value={dataValue ?? ""}
        checked={isChecked}
        required={required}
        disabled={disabled}
        className="sr-only"
        tabIndex={-1}
        readOnly
        aria-hidden="true"
      />
      <span
        aria-hidden="true"
        className={selectableIndicatorVariants({
          size,
          checked: isChecked,
          highlighted,
        })}
      >
        {selectableIndicators[variant][isChecked ? "checked" : "unchecked"]}
      </span>
      {label && (
        <div
          className={cn(
            "flex flex-col min-w-0",
            !description && "justify-center"
          )}
        >
          <span id={labelId} className={selectableLabelVariants({ size })}>{label}</span>
          {description && (
            <span id={descriptionId} className={selectableDescriptionVariants({ highlighted })}>
              {description}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
