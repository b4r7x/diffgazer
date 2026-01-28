"use client";

import {
  createContext,
  useContext,
  useState,
  Children,
  isValidElement,
  Fragment,
  type ReactNode,
} from "react";
import { cn } from "../../lib/utils";
import { useKey, useSelectableList } from "@/hooks/keyboard";

interface RadioItemData {
  value: string;
  disabled: boolean;
  index: number;
}

interface RadioGroupContextType {
  value?: string;
  onValueChange?: (value: string) => void;
  disabled?: boolean;
  focusedIndex: number;
  items: RadioItemData[];
  setFocusedIndex: (index: number) => void;
}

const RadioGroupContext = createContext<RadioGroupContextType | undefined>(
  undefined,
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
  const [uncontrolledValue, setUncontrolledValue] = useState(defaultValue);
  const isControlled = controlledValue !== undefined;
  const value = isControlled ? controlledValue : uncontrolledValue;

  // Extract items from children
  const items: RadioItemData[] = [];
  let itemIndex = 0;

  function extractItems(node: ReactNode) {
    Children.forEach(node, (child) => {
      if (!isValidElement(child)) return;
      if (child.type === Fragment) {
        extractItems((child.props as { children?: ReactNode }).children);
      } else if (child.type === RadioGroupItem) {
        const childProps = child.props as RadioGroupItemProps;
        items.push({
          value: childProps.value,
          disabled: childProps.disabled ?? false,
          index: itemIndex++,
        });
      }
    });
  }

  extractItems(children);

  // Find initial index based on current value
  const initialIndex = Math.max(
    0,
    value ? items.findIndex((item) => item.value === value) : 0
  );

  const { focusedIndex, setFocusedIndex } = useSelectableList({
    itemCount: items.length,
    getDisabled: (index) => items[index]?.disabled ?? false,
    wrap,
    onBoundaryReached,
    onFocus: onFocus ? (i) => onFocus(items[i]?.value) : undefined,
    enabled: !disabled && items.length > 0,
    initialIndex,
  });

  const handleValueChange = (newValue: string) => {
    if (disabled) return;
    onValueChange?.(newValue);
    if (!isControlled) {
      setUncontrolledValue(newValue);
    }
  };

  // Handle Enter/Space to select focused item
  const handleSelect = () => {
    const item = items[focusedIndex];
    if (!item || item.disabled || disabled) return;
    handleValueChange(item.value);
  };

  useKey("Enter", handleSelect, { enabled: !disabled && items.length > 0 });
  useKey(" ", handleSelect, { enabled: !disabled && items.length > 0 });

  return (
    <RadioGroupContext.Provider
      value={{
        value,
        onValueChange: handleValueChange,
        disabled,
        focusedIndex,
        items,
        setFocusedIndex,
      }}
    >
      <div
        role="radiogroup"
        aria-orientation={orientation}
        className={cn(
          "flex font-mono",
          orientation === "vertical" ? "flex-col gap-1" : "flex-row gap-4",
          className,
        )}
      >
        {children}
      </div>
    </RadioGroupContext.Provider>
  );
}

export interface RadioGroupItemProps {
  value: string;
  label: string;
  description?: string;
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
  const disabled = context.disabled || itemDisabled;

  const itemData = context.items.find((item) => item.value === value);
  const isFocused = itemData ? itemData.index === context.focusedIndex : false;

  const handleClick = () => {
    if (!disabled && itemData) {
      context.setFocusedIndex(itemData.index);
      context.onValueChange?.(value);
    }
  };

  return (
    <div
      role="radio"
      aria-checked={isSelected}
      aria-disabled={disabled}
      onClick={handleClick}
      className={cn(
        "flex items-start gap-3 px-3 py-2 text-left cursor-pointer w-full",
        "font-mono text-sm leading-relaxed",
        "text-tui-fg transition-colors duration-75",
        !isFocused && "hover:bg-tui-selection",
        isFocused && "bg-tui-blue text-black font-bold hover:bg-tui-blue",
        disabled && "opacity-50 cursor-not-allowed",
        className,
      )}
    >
      <span className="mt-0.5 shrink-0 select-none">
        {isSelected ? "(x)" : "( )"}
      </span>
      <div className="flex-1 min-w-0">
        <span>{label}</span>
        {description && (
          <div
            className={cn(
              "text-xs mt-1",
              isFocused ? "text-black/70" : "opacity-60",
            )}
          >
            {description}
          </div>
        )}
      </div>
    </div>
  );
}

export const RadioGroup = Object.assign(RadioGroupRoot, {
  Item: RadioGroupItem,
});
