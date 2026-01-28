"use client";

import * as React from "react";
import { cn } from "../../lib/utils";
import { useGroupNavigation } from "@/hooks/keyboard";

type CheckboxSize = "sm" | "md" | "lg";

const checkboxVariants = {
  base: "flex items-center cursor-pointer select-none font-mono relative",
  container: "flex items-center gap-3 px-3 py-2",
  indicator: {
    sm: "text-sm font-bold min-w-4",
    md: "font-bold min-w-5",
    lg: "text-lg font-bold min-w-6",
  },
  label: {
    sm: "text-sm",
    md: "text-base",
    lg: "text-lg",
  },
  states: {
    focused: "bg-tui-selection text-white font-bold",
    focusedAccent:
      "before:absolute before:left-0 before:top-0 before:bottom-0 before:w-1 before:bg-tui-blue",
    unfocused: "text-tui-fg hover:bg-tui-selection/50",
    disabled: "opacity-50 cursor-not-allowed",
    checkedIndicator: "text-tui-green",
  },
};

export interface CheckboxProps {
  checked?: boolean;
  defaultChecked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
  label?: React.ReactNode;
  description?: React.ReactNode;
  disabled?: boolean;
  focused?: boolean;
  size?: CheckboxSize;
  className?: string;
  "data-value"?: string;
}

export function Checkbox({
  checked: controlledChecked,
  defaultChecked = false,
  onCheckedChange,
  label,
  description,
  disabled = false,
  focused = false,
  size = "md",
  className,
  "data-value": dataValue,
}: CheckboxProps) {
  const [uncontrolledChecked, setUncontrolledChecked] =
    React.useState(defaultChecked);
  const isControlled = controlledChecked !== undefined;
  const checked = isControlled ? controlledChecked : uncontrolledChecked;

  const handleChange = (newChecked: boolean) => {
    if (disabled) return;
    onCheckedChange?.(newChecked);
    if (!isControlled) {
      setUncontrolledChecked(newChecked);
    }
  };

  const handleClick = () => {
    handleChange(!checked);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return;
    if (e.key === " " || e.key === "Enter") {
      e.preventDefault();
      handleChange(!checked);
    }
  };

  return (
    <div
      role="checkbox"
      data-value={dataValue}
      aria-checked={checked}
      aria-disabled={disabled}
      tabIndex={disabled ? -1 : 0}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      className={cn(
        checkboxVariants.base,
        checkboxVariants.container,
        description && "items-start",
        focused
          ? checkboxVariants.states.focused
          : checkboxVariants.states.unfocused,
        focused && checkboxVariants.states.focusedAccent,
        disabled && checkboxVariants.states.disabled,
        className
      )}
    >
      <span
        className={cn(
          checkboxVariants.indicator[size],
          checked && !focused && checkboxVariants.states.checkedIndicator
        )}
      >
        {checked ? "[x]" : "[ ]"}
      </span>
      {label && !description && (
        <span className={checkboxVariants.label[size]}>{label}</span>
      )}
      {label && description && (
        <div className="flex flex-col min-w-0">
          <span className={checkboxVariants.label[size]}>{label}</span>
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

interface CheckboxGroupContextType {
  value: string[];
  toggle: (itemValue: string) => void;
  disabled: boolean;
  size: CheckboxSize;
  isFocused: (value: string) => boolean;
}

const CheckboxGroupContext = React.createContext<
  CheckboxGroupContextType | undefined
>(undefined);

function useCheckboxGroupContext() {
  const context = React.useContext(CheckboxGroupContext);
  if (!context) {
    throw new Error("CheckboxItem must be used within CheckboxGroup");
  }
  return context;
}

export interface CheckboxGroupProps {
  value?: string[];
  defaultValue?: string[];
  onValueChange?: (value: string[]) => void;
  disabled?: boolean;
  size?: CheckboxSize;
  className?: string;
  children: React.ReactNode;
  wrap?: boolean;
  onBoundaryReached?: (direction: "up" | "down") => void;
}

export function CheckboxGroup({
  value: controlledValue,
  defaultValue = [],
  onValueChange,
  disabled = false,
  size = "md",
  className,
  children,
  wrap = true,
  onBoundaryReached,
}: CheckboxGroupProps) {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const [uncontrolledValue, setUncontrolledValue] =
    React.useState(defaultValue);
  const isControlled = controlledValue !== undefined;
  const value = isControlled ? controlledValue : uncontrolledValue;

  const handleValueChange = (newValue: string[]) => {
    onValueChange?.(newValue);
    if (!isControlled) {
      setUncontrolledValue(newValue);
    }
  };

  const toggle = (itemValue: string) => {
    if (disabled) return;
    const newValue = value.includes(itemValue)
      ? value.filter((v) => v !== itemValue)
      : [...value, itemValue];
    handleValueChange(newValue);
  };

  const { isFocused } = useGroupNavigation({
    containerRef,
    role: "checkbox",
    onSelect: toggle,
    wrap,
    onBoundaryReached,
    enabled: !disabled,
    initialValue: value[0] ?? null,
  });

  return (
    <CheckboxGroupContext.Provider
      value={{
        value,
        toggle,
        disabled,
        size,
        isFocused,
      }}
    >
      <div
        ref={containerRef}
        role="group"
        className={cn("flex flex-col gap-2", className)}
      >
        {children}
      </div>
    </CheckboxGroupContext.Provider>
  );
}

export interface CheckboxItemProps {
  value: string;
  label: React.ReactNode;
  description?: React.ReactNode;
  disabled?: boolean;
  className?: string;
}

export function CheckboxItem({
  value,
  label,
  description,
  disabled = false,
  className,
}: CheckboxItemProps) {
  const context = useCheckboxGroupContext();
  const isChecked = context.value.includes(value);
  const isDisabled = disabled || context.disabled;
  const isFocused = context.isFocused(value);

  return (
    <Checkbox
      data-value={value}
      checked={isChecked}
      onCheckedChange={() => context.toggle(value)}
      label={label}
      description={description}
      disabled={isDisabled}
      focused={isFocused}
      size={context.size}
      className={className}
    />
  );
}

export { checkboxVariants };
