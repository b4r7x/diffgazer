import {
  createContext,
  useContext,
  useImperativeHandle,
  useRef,
  useState,
  type ReactNode,
  type Ref,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import { cn } from "../lib/cn";
import { useLocalNavigation, type NavigableHandle } from "../internal/use-local-navigation";
import {
  selectableItemVariants,
  selectableItemContainerVariants,
  selectableItemIndicatorVariants,
  selectableItemLabelVariants,
  selectableItemDescriptionVariants,
  type SelectableItemSize,
} from "../internal/selectable-item";

export interface RadioProps {
  checked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
  label?: ReactNode;
  description?: ReactNode;
  disabled?: boolean;
  focused?: boolean;
  size?: SelectableItemSize;
  name?: string;
  required?: boolean;
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
  name,
  required,
  className,
  "data-value": dataValue,
}: RadioProps) {
  const handleClick = () => {
    if (!disabled) {
      onCheckedChange?.(!checked);
    }
  };

  const handleKeyDown = (e: ReactKeyboardEvent) => {
    if (disabled) return;
    if (e.key === " " || e.key === "Enter") {
      e.preventDefault();
      onCheckedChange?.(!checked);
    }
  };

  return (
    <div
      role="radio"
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
      {name && (
        <input
          type="radio"
          name={name}
          checked={checked}
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
          checked,
          focused,
        })}
      >
        {checked ? "[\u00a0\u25cf\u00a0]" : "[\u00a0\u00a0\u00a0]"}
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

interface RadioGroupContextType<T extends string = string> {
  value?: T;
  onValueChange: (value: T) => void;
  disabled: boolean;
  size: SelectableItemSize;
  isFocused: (value: string) => boolean;
  name?: string;
  required?: boolean;
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

export interface RadioGroupProps<T extends string = string> {
  value?: T;
  defaultValue?: T;
  onValueChange?: (value: T) => void;
  onFocus?: (value: T) => void;
  orientation?: "vertical" | "horizontal";
  disabled?: boolean;
  size?: SelectableItemSize;
  name?: string;
  required?: boolean;
  loop?: boolean;
  onBoundaryReached?: (direction: "up" | "down") => void;
  className?: string;
  children: ReactNode;
  ref?: Ref<NavigableHandle>;
}

function RadioGroupRoot<T extends string = string>({
  value: controlledValue,
  defaultValue,
  onValueChange,
  onFocus,
  orientation = "vertical",
  disabled = false,
  size = "md",
  name,
  required,
  loop = true,
  onBoundaryReached,
  className,
  children,
  ref,
}: RadioGroupProps<T>) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [uncontrolledValue, setUncontrolledValue] = useState(defaultValue);
  const isControlled = controlledValue !== undefined;
  const value = isControlled ? controlledValue : uncontrolledValue;

  const handleValueChange = (newValue: string) => {
    if (disabled) return;
    onValueChange?.(newValue as T);
    if (!isControlled) {
      setUncontrolledValue(newValue as T);
    }
  };

  const { isFocused, onKeyDown, handle } = useLocalNavigation({
    containerRef,
    role: "radio",
    value: value ?? null,
    onValueChange: handleValueChange,
    onSelect: handleValueChange,
    onEnter: handleValueChange,
    onFocusChange: onFocus as ((value: string) => void) | undefined,
    wrap: loop,
    onBoundaryReached,
    enabled: !disabled,
  });

  useImperativeHandle(ref, () => handle);

  const contextValue: RadioGroupContextType = {
    value,
    onValueChange: handleValueChange,
    disabled,
    size,
    isFocused,
    name,
    required,
  };

  return (
    <RadioGroupContext.Provider value={contextValue}>
      <div
        ref={containerRef}
        role="radiogroup"
        aria-orientation={orientation}
        aria-required={required || undefined}
        className={cn(
          "flex font-mono",
          orientation === "vertical" ? "flex-col gap-1" : "flex-row gap-4",
          className
        )}
        onKeyDown={onKeyDown}
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
      size={context.size}
      name={context.name}
      required={context.required}
      className={className}
    />
  );
}

export { RadioGroupRoot as RadioGroup, RadioGroupItem };
