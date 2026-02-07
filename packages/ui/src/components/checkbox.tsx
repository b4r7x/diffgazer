import * as React from "react";
import { useGroupNavigation } from "@stargazer/keyboard";
import { cn } from "../lib/cn";
import {
  selectableItemVariants,
  selectableItemContainerVariants,
  selectableItemIndicatorVariants,
  selectableItemLabelVariants,
  selectableItemDescriptionVariants,
  type SelectableItemSize,
} from "../internal/selectable-item";

export type CheckboxVariant = "x" | "bullet";

export interface CheckboxProps {
  checked?: boolean | "indeterminate";
  defaultChecked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
  label?: React.ReactNode;
  description?: React.ReactNode;
  disabled?: boolean;
  focused?: boolean;
  size?: SelectableItemSize;
  variant?: CheckboxVariant;
  name?: string;
  required?: boolean;
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
  name,
  required,
  className,
  "data-value": dataValue,
}: CheckboxProps) {
  const [uncontrolledChecked, setUncontrolledChecked] =
    React.useState(defaultChecked);
  const isControlled = controlledChecked !== undefined;
  const checked = isControlled ? controlledChecked : uncontrolledChecked;
  const isChecked = checked === true;
  const isIndeterminate = checked === "indeterminate";

  const handleChange = (newChecked: boolean) => {
    if (disabled) return;
    onCheckedChange?.(newChecked);
    if (!isControlled) {
      setUncontrolledChecked(newChecked);
    }
  };

  const handleClick = () => {
    handleChange(!isChecked);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return;
    if (e.key === " " || e.key === "Enter") {
      e.preventDefault();
      handleChange(!isChecked);
    }
  };

  const renderIndicator = () => {
    if (isIndeterminate) {
      return variant === "x" ? "[-]" : "[ - ]";
    }
    if (variant === "x") {
      return isChecked ? "[x]" : "[ ]";
    }
    return isChecked ? "[\u00a0\u25cf\u00a0]" : "[\u00a0\u00a0\u00a0]";
  };

  return (
    <div
      role="checkbox"
      data-value={dataValue}
      aria-checked={isIndeterminate ? "mixed" : isChecked}
      aria-disabled={disabled}
      aria-required={required || undefined}
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
      {name && (
        <input
          type="checkbox"
          name={name}
          checked={isChecked}
          required={required}
          disabled={disabled}
          className="sr-only"
          tabIndex={-1}
          onChange={() => {}}
          aria-hidden="true"
        />
      )}
      <span
        className={selectableItemIndicatorVariants({
          size,
          checked: isChecked,
          focused,
        })}
      >
        {renderIndicator()}
      </span>
      {label && (
        <div
          className={cn(
            "flex flex-col min-w-0",
            !description && "justify-center"
          )}
        >
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
  name?: string;
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
  disabled?: boolean;
  size?: SelectableItemSize;
  variant?: CheckboxVariant;
  name?: string;
  required?: boolean;
  loop?: boolean;
  onBoundaryReached?: (direction: "up" | "down") => void;
  className?: string;
  children: React.ReactNode;
}

export function CheckboxGroup<T extends string = string>({
  value: controlledValue,
  defaultValue = [] as T[],
  onValueChange,
  disabled = false,
  size = "md",
  variant = "x",
  name,
  required,
  loop = true,
  onBoundaryReached,
  className,
  children,
}: CheckboxGroupProps<T>) {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const [uncontrolledValue, setUncontrolledValue] =
    React.useState(defaultValue);
  const [focusedValue, setFocusedValue] = React.useState<string | null>(
    () => controlledValue?.[0] ?? defaultValue[0] ?? null
  );
  const isControlled = controlledValue !== undefined;
  const value = isControlled ? controlledValue : uncontrolledValue;

  const toggle = (itemValue: string) => {
    if (disabled) return;
    const typedValue = itemValue as T;
    const current = isControlled ? controlledValue! : uncontrolledValue;
    const newValue = current.includes(typedValue)
      ? current.filter((v) => v !== typedValue)
      : [...current, typedValue];
    onValueChange?.(newValue);
    if (!isControlled) setUncontrolledValue(newValue);
  };

  const { isFocused } = useGroupNavigation({
    containerRef,
    role: "checkbox",
    value: focusedValue,
    onValueChange: (nextValue: string) => setFocusedValue(nextValue),
    onSelect: toggle,
    wrap: loop,
    onBoundaryReached,
    enabled: !disabled,
  });

  const contextValue: CheckboxGroupContextType = {
    value,
    toggle,
    disabled,
    size,
    variant,
    isFocused,
    name,
  };

  return (
    <CheckboxGroupContext.Provider value={contextValue}>
      <div
        ref={containerRef}
        role="group"
        aria-required={required || undefined}
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
      name={context.name}
      className={className}
    />
  );
}
