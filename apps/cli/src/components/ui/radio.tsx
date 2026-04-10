import { createContext, useState, useContext } from "react";
import type { ReactElement, ReactNode } from "react";
import { Box, Text, useInput } from "ink";
import { useTheme } from "../../theme/theme-context.js";
import type { CliColorTokens } from "../../theme/palettes.js";
import { clampIndex, collectChildItems } from "../../lib/list-navigation.js";

// --- Types ---

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

// --- Context ---

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

// --- Item collection ---

interface CollectedItem {
  value: string;
  disabled: boolean;
}

function extractRadioItem(element: ReactElement): CollectedItem | null {
  if (element.type !== RadioGroupItem) return null;
  const props = element.props as RadioGroupItemProps;
  return { value: props.value, disabled: props.disabled ?? false };
}

// --- Components ---

function RadioGroupItem({
  value,
  label,
  description,
  disabled = false,
}: RadioGroupItemProps) {
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
        <Text
          color={isHighlighted ? ctx.tokens.accent : undefined}
          bold={isHighlighted}
        >
          {indicator}
        </Text>
        {typeof label === "string"
          ? <Text color={isHighlighted ? ctx.tokens.accent : undefined} bold={isHighlighted}>{label}</Text>
          : label}
      </Box>
      {description != null && (
        <Box>
          <Text>{"      "}</Text>
          {typeof description === "string"
            ? <Text color={ctx.tokens.muted}>{description}</Text>
            : description}
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
  const selectableItems = items.filter((item) => !item.disabled && !disabled);

  const [internalValue, setInternalValue] = useState(defaultValue ?? "");
  const [highlightIndex, setHighlightIndex] = useState(0);

  const selectedValue = value ?? internalValue;
  const highlightedValue = selectableItems[highlightIndex]?.value ?? "";

  function moveHighlight(direction: 1 | -1) {
    if (selectableItems.length === 0) return;

    const nextIdx = clampIndex(highlightIndex, direction, selectableItems.length, wrap);
    setHighlightIndex(nextIdx);
    const nextItem = selectableItems[nextIdx];
    if (nextItem) {
      onHighlightChange?.(nextItem.value);
    }
  }

  function selectCurrent() {
    const item = selectableItems[highlightIndex];
    if (!item) return;

    if (value === undefined) {
      setInternalValue(item.value);
    }
    onChange?.(item.value);
  }

  const isVertical = orientation === "vertical";

  useInput(
    (_input, key) => {
      const prevKey = isVertical ? key.upArrow : key.leftArrow;
      const nextKey = isVertical ? key.downArrow : key.rightArrow;

      if (prevKey) {
        moveHighlight(-1);
        return;
      }
      if (nextKey) {
        moveHighlight(1);
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

// --- Compound export ---

export const RadioGroup = Object.assign(RadioGroupRoot, {
  Item: RadioGroupItem,
});
