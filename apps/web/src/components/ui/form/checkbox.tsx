import * as React from "react";
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

export type CheckboxVariant = 'x' | 'bullet';

export interface CheckboxProps {
  checked?: boolean;
  defaultChecked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
  label?: React.ReactNode;
  description?: React.ReactNode;
  disabled?: boolean;
  focused?: boolean;
  size?: SelectableItemSize;
  variant?: CheckboxVariant;
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
  variant = "x",
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
        selectableItemVariants({ focused, disabled }),
        selectableItemContainerVariants(),
        description && "items-start",
        className
      )}
    >
      <span className={selectableItemIndicatorVariants({ size, checked, focused })}>
        {variant === 'x'
          ? (checked ? "[x]" : "[ ]")
          : (checked ? "[ ● ]" : "[   ]")
        }
      </span>
      {label && (
        <div className={cn("flex flex-col min-w-0", !description && "justify-center")}>
          <span className={selectableItemLabelVariants({ size })}>{label}</span>
          {description && (
            <span className={selectableItemDescriptionVariants({ focused })}>
              {description}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

interface CheckboxGroupContextType<T extends string = string> {
  value: T[];
  toggle: (itemValue: T) => void;
  disabled: boolean;
  size: SelectableItemSize;
  variant: CheckboxVariant;
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

export interface CheckboxGroupProps<T extends string = string> {
  value?: T[];
  defaultValue?: T[];
  onValueChange?: (value: T[]) => void;
  onEnter?: (itemValue: T, newValues: T[]) => void;
  disabled?: boolean;
  size?: SelectableItemSize;
  variant?: CheckboxVariant;
  className?: string;
  children: React.ReactNode;
  wrap?: boolean;
  onBoundaryReached?: (direction: "up" | "down") => void;
}

export function CheckboxGroup<T extends string = string>({
  value: controlledValue,
  defaultValue = [] as T[],
  onValueChange,
  onEnter,
  disabled = false,
  size = "md",
  variant = "x",
  className,
  children,
  wrap = true,
  onBoundaryReached,
}: CheckboxGroupProps<T>) {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const [uncontrolledValue, setUncontrolledValue] =
    React.useState(defaultValue);
  const isControlled = controlledValue !== undefined;
  const value = isControlled ? controlledValue : uncontrolledValue;

  const handleValueChange = React.useCallback((newValue: T[]) => {
    onValueChange?.(newValue);
    if (!isControlled) {
      setUncontrolledValue(newValue);
    }
  }, [onValueChange, isControlled]);

  const toggle = React.useCallback((itemValue: string) => {
    if (disabled) return;
    const typedValue = itemValue as T;
    setUncontrolledValue(prev => {
      const current = isControlled ? controlledValue! : prev;
      const newValue = current.includes(typedValue)
        ? current.filter((v) => v !== typedValue)
        : [...current, typedValue];
      onValueChange?.(newValue);
      if (!isControlled) return newValue;
      return prev;
    });
  }, [disabled, isControlled, controlledValue, onValueChange]);

  const handleEnterKey = (itemValue: string) => {
    if (disabled) return;
    const typedValue = itemValue as T;
    const newValue = value.includes(typedValue)
      ? value.filter((v) => v !== typedValue)
      : [...value, typedValue];
    handleValueChange(newValue);

    if (onEnter) {
      onEnter(typedValue, newValue);
    }
  };

  const { isFocused } = useGroupNavigation({
    containerRef,
    role: "checkbox",
    onSelect: toggle,
    onEnter: onEnter ? handleEnterKey : undefined,
    wrap,
    onBoundaryReached,
    enabled: !disabled,
    initialValue: value[0] ?? null,
  });

  const contextValue = React.useMemo(
    () => ({ value, toggle, disabled, size, variant, isFocused }),
    [value, toggle, disabled, size, variant, isFocused]
  );

  return (
    <CheckboxGroupContext.Provider value={contextValue}>
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
      variant={context.variant}
      className={className}
    />
  );
}
