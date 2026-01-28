"use client";

import { createContext, useContext, useState, useRef, type ReactNode } from "react";
import { cn } from "../../lib/utils";
import { useGroupNavigation } from "@/hooks/keyboard";

const radioVariants = {
  base: "flex cursor-pointer select-none font-mono relative",
  container: "flex items-center gap-3 px-3 py-2",
  indicator: "font-bold min-w-5",
  label: "text-base",
  states: {
    focused: "bg-tui-selection text-white font-bold",
    focusedAccent:
      "before:absolute before:left-0 before:top-0 before:bottom-0 before:w-1 before:bg-tui-blue",
    unfocused: "text-tui-fg hover:bg-tui-selection/50",
    disabled: "opacity-50 cursor-not-allowed",
    checkedIndicator: "text-tui-green",
  },
};

export interface RadioProps {
  checked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
  label?: ReactNode;
  description?: ReactNode;
  disabled?: boolean;
  focused?: boolean;
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
        radioVariants.base,
        radioVariants.container,
        description && "items-start",
        focused
          ? radioVariants.states.focused
          : radioVariants.states.unfocused,
        focused && radioVariants.states.focusedAccent,
        disabled && radioVariants.states.disabled,
        className
      )}
    >
      <span
        className={cn(
          radioVariants.indicator,
          checked && !focused && radioVariants.states.checkedIndicator
        )}
      >
        {checked ? "(x)" : "( )"}
      </span>
      {label && !description && (
        <span className={radioVariants.label}>{label}</span>
      )}
      {label && description && (
        <div className="flex flex-col min-w-0">
          <span className={radioVariants.label}>{label}</span>
          <span
            className={cn(
              "text-sm mt-0.5",
              focused ? "text-white/70" : "text-tui-muted"
            )}
          >
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
  isFocused: (value: string) => boolean;
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
  orientation?: "vertical" | "horizontal";
  disabled?: boolean;
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
  orientation = "vertical",
  disabled = false,
  className,
  children,
  wrap = true,
  onBoundaryReached,
}: RadioGroupProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [uncontrolledValue, setUncontrolledValue] = useState(defaultValue);
  const isControlled = controlledValue !== undefined;
  const value = isControlled ? controlledValue : uncontrolledValue;

  const handleValueChange = (newValue: string) => {
    if (disabled) return;
    onValueChange?.(newValue);
    if (!isControlled) {
      setUncontrolledValue(newValue);
    }
  };

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

  return (
    <RadioGroupContext.Provider
      value={{
        value,
        onValueChange: handleValueChange,
        disabled,
        isFocused,
      }}
    >
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

  return (
    <Radio
      data-value={value}
      checked={isSelected}
      onCheckedChange={() => context.onValueChange(value)}
      label={label}
      description={description}
      disabled={isDisabled}
      focused={isFocused}
      className={className}
    />
  );
}

export const RadioGroup = Object.assign(RadioGroupRoot, {
  Item: RadioGroupItem,
});

export { radioVariants };
