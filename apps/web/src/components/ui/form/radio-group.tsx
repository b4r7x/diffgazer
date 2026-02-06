import { createContext, useCallback, useContext, useState, useRef, useMemo, type ReactNode } from "react";
import { cn } from "@/utils/cn";
import { useGroupNavigation } from "@/hooks/keyboard";
import {
  selectableItemVariants,
  selectableItemContainerVariants,
  selectableItemIndicatorVariants,
  selectableItemLabelVariants,
  selectableItemDescriptionVariants,
  type SelectableItemSize,
} from "./selectable-item";

export interface RadioProps {
  checked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
  label?: ReactNode;
  description?: ReactNode;
  disabled?: boolean;
  focused?: boolean;
  size?: SelectableItemSize;
  className?: string;
  "data-value"?: string;
}

export function Radio({
  checked = false,
  onCheckedChange,
  label,
  description,
  disabled = false,
  focused = false,
  size = "md",
  className,
  "data-value": dataValue,
}: RadioProps) {
  const handleClick = () => {
    if (!disabled) {
      onCheckedChange?.(!checked);
    }
  };

  return (
    <div
      role="radio"
      data-value={dataValue}
      aria-checked={checked}
      aria-disabled={disabled}
      onClick={handleClick}
      className={cn(
        selectableItemVariants({ focused, disabled }),
        selectableItemContainerVariants(),
        description && "items-start",
        className
      )}
    >
      <span className={selectableItemIndicatorVariants({ size, checked, focused })}>
        {checked ? "[ ● ]" : "[   ]"}
      </span>
      {label && !description && (
        <span className={selectableItemLabelVariants({ size })}>{label}</span>
      )}
      {label && description && (
        <div className="flex flex-col min-w-0">
          <span className={selectableItemLabelVariants({ size })}>{label}</span>
          <span className={selectableItemDescriptionVariants({ focused })}>
            {description}
          </span>
        </div>
      )}
    </div>
  );
}

interface RadioGroupContextType {
  value?: string;
  onValueChange: (value: string) => void;
  disabled: boolean;
  size: SelectableItemSize;
  isFocused: (value: string) => boolean;
  onFocusZoneEnter?: () => void;
}

const RadioGroupContext = createContext<RadioGroupContextType | undefined>(
  undefined
);

function useRadioGroupContext() {
  const context = useContext(RadioGroupContext);
  if (!context) {
    throw new Error("RadioGroup.Item must be used within RadioGroup");
  }
  return context;
}

export interface RadioGroupProps {
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  onFocus?: (value: string) => void;
  onFocusZoneEnter?: () => void;
  orientation?: "vertical" | "horizontal";
  disabled?: boolean;
  size?: SelectableItemSize;
  className?: string;
  children: ReactNode;
  wrap?: boolean;
  onBoundaryReached?: (direction: "up" | "down") => void;
}

function RadioGroupRoot({
  value: controlledValue,
  defaultValue,
  onValueChange,
  onFocus,
  onFocusZoneEnter,
  orientation = "vertical",
  disabled = false,
  size = "md",
  className,
  children,
  wrap = true,
  onBoundaryReached,
}: RadioGroupProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [uncontrolledValue, setUncontrolledValue] = useState(defaultValue);
  const isControlled = controlledValue !== undefined;
  const value = isControlled ? controlledValue : uncontrolledValue;

  const handleValueChange = useCallback((newValue: string) => {
    if (disabled) return;
    onValueChange?.(newValue);
    if (!isControlled) {
      setUncontrolledValue(newValue);
    }
  }, [disabled, onValueChange, isControlled]);

  const { isFocused } = useGroupNavigation({
    containerRef,
    role: "radio",
    onSelect: handleValueChange,
    onFocusChange: onFocus,
    wrap,
    onBoundaryReached,
    enabled: !disabled,
    initialValue: value ?? null,
  });

  const contextValue = useMemo(
    () => ({
      value,
      onValueChange: handleValueChange,
      disabled,
      size,
      isFocused,
      onFocusZoneEnter,
    }),
    [value, handleValueChange, disabled, size, isFocused, onFocusZoneEnter]
  );

  return (
    <RadioGroupContext.Provider value={contextValue}>
      <div
        ref={containerRef}
        role="radiogroup"
        aria-orientation={orientation}
        className={cn(
          "flex font-mono",
          orientation === "vertical" ? "flex-col gap-1" : "flex-row gap-4",
          className
        )}
      >
        {children}
      </div>
    </RadioGroupContext.Provider>
  );
}

export interface RadioGroupItemProps {
  value: string;
  label: ReactNode;
  description?: ReactNode;
  disabled?: boolean;
  className?: string;
}

function RadioGroupItem({
  value,
  label,
  description,
  disabled: itemDisabled,
  className,
}: RadioGroupItemProps) {
  const context = useRadioGroupContext();
  const isSelected = context.value === value;
  const isDisabled = context.disabled || itemDisabled;
  const isFocused = context.isFocused(value);

  const handleCheckedChange = () => {
    context.onFocusZoneEnter?.();
    context.onValueChange(value);
  };

  return (
    <Radio
      data-value={value}
      checked={isSelected}
      onCheckedChange={handleCheckedChange}
      label={label}
      description={description}
      disabled={isDisabled}
      focused={isFocused}
      size={context.size}
      className={className}
    />
  );
}

export const RadioGroup = RadioGroupRoot;
export { RadioGroupItem };
