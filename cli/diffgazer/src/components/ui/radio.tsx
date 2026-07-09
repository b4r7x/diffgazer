import { Box, Text, useInput } from "ink";
import type { ReactElement, ReactNode } from "react";
import { createContext, useContext, useState } from "react";
import { collectChildItems } from "../../lib/collect-child-items";
import { useListNavigation } from "../../lib/use-list-navigation";
import type { CliColorTokens } from "../../theme/palettes";
import { useTheme } from "../../theme/provider";

export interface RadioGroupProps {
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  onHighlightChange?: (value: string) => void;
  orientation?: "vertical" | "horizontal";
  wrap?: boolean;
  disabled?: boolean;
  isActive?: boolean;
  children: ReactNode;
}

export interface RadioGroupItemProps {
  value: string;
  label: ReactNode;
  description?: ReactNode;
  disabled?: boolean;
}

interface RadioGroupContextValue {
  selectedValue: string;
  highlightedValue: string;
  groupDisabled: boolean;
  tokens: CliColorTokens;
}

const RadioGroupContext = createContext<RadioGroupContextValue | null>(null);

function useRadioGroupContext(): RadioGroupContextValue {
  const value = useContext(RadioGroupContext);
  if (!value) {
    throw new Error("RadioGroup.Item must be used within a RadioGroup");
  }
  return value;
}

interface CollectedItem {
  value: string;
  disabled: boolean;
}

function extractRadioItem(element: ReactElement): CollectedItem | null {
  if (element.type !== RadioGroupItem) return null;
  const props = element.props as RadioGroupItemProps;
  return { value: props.value, disabled: props.disabled ?? false };
}

function RadioGroupItem({ value, label, description, disabled = false }: RadioGroupItemProps) {
  const ctx = useRadioGroupContext();
  const isDisabled = disabled || ctx.groupDisabled;
  const isSelected = ctx.selectedValue === value;
  const isHighlighted = ctx.highlightedValue === value;

  const indicator = isSelected ? "( * )" : "(   )";

  if (isDisabled) {
    return (
      <Box flexDirection="column">
        <Box gap={1}>
          <Text dimColor>{indicator}</Text>
          {typeof label === "string" ? <Text dimColor>{label}</Text> : label}
        </Box>
        {description != null && (
          <Box>
            <Text dimColor>{"      "}</Text>
            {typeof description === "string" ? <Text dimColor>{description}</Text> : description}
          </Box>
        )}
      </Box>
    );
  }

  return (
    <Box flexDirection="column">
      <Box gap={1}>
        <Text color={isHighlighted ? ctx.tokens.accent : undefined} bold={isHighlighted}>
          {indicator}
        </Text>
        {typeof label === "string" ? (
          <Text color={isHighlighted ? ctx.tokens.accent : undefined} bold={isHighlighted}>
            {label}
          </Text>
        ) : (
          label
        )}
      </Box>
      {description != null && (
        <Box>
          <Text>{"      "}</Text>
          {typeof description === "string" ? (
            <Text color={ctx.tokens.muted}>{description}</Text>
          ) : (
            description
          )}
        </Box>
      )}
    </Box>
  );
}

function RadioGroupRoot({
  value,
  defaultValue,
  onChange,
  onHighlightChange,
  orientation = "vertical",
  wrap = true,
  disabled = false,
  isActive = true,
  children,
}: RadioGroupProps) {
  const { tokens } = useTheme();
  const items = collectChildItems(children, extractRadioItem);
  const navigableItems = items.map((item) => ({
    id: item.value,
    disabled: disabled || item.disabled,
  }));

  const [internalValue, setInternalValue] = useState(defaultValue ?? "");
  const {
    currentHighlightedId: highlightedValue,
    moveBy,
    selectItem,
  } = useListNavigation({ items: navigableItems, onHighlightChange, wrap });

  const selectedValue = value ?? internalValue;

  function selectCurrent() {
    const item = selectItem(highlightedValue);
    if (!item) return;

    if (value === undefined) {
      setInternalValue(item.id);
    }
    onChange?.(item.id);
  }

  const isVertical = orientation === "vertical";

  useInput(
    (_input, key) => {
      const prevKey = isVertical ? key.upArrow : key.leftArrow;
      const nextKey = isVertical ? key.downArrow : key.rightArrow;

      if (prevKey) {
        moveBy(-1);
        return;
      }
      if (nextKey) {
        moveBy(1);
        return;
      }
      if (key.return || _input === " ") {
        selectCurrent();
        return;
      }
    },
    { isActive: isActive && !disabled },
  );

  return (
    <RadioGroupContext
      value={{
        selectedValue,
        highlightedValue,
        groupDisabled: disabled,
        tokens,
      }}
    >
      <Box flexDirection={isVertical ? "column" : "row"} gap={isVertical ? 0 : 2}>
        {children}
      </Box>
    </RadioGroupContext>
  );
}

export const RadioGroup = Object.assign(RadioGroupRoot, {
  Item: RadioGroupItem,
});
