import { Box, Text, useInput } from "ink";
import type { ReactElement, ReactNode } from "react";
import { createContext, useContext, useState } from "react";
import { useListNavigation } from "../../hooks/use-list-navigation";
import { collectChildItems } from "../../lib/collect-child-items";
import { getListWindow } from "../../lib/list-window";
import type { CliColorTokens } from "../../theme/palettes";
import { useTheme } from "../../theme/provider";

export interface RadioGroupProps {
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  onHighlightChange?: (value: string) => void;
  onNavigationBoundaryReached?: (direction: 1 | -1) => void;
  orientation?: "vertical" | "horizontal";
  wrap?: boolean;
  disabled?: boolean;
  isActive?: boolean;
  maxVisibleItems?: number;
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
  visibleValues: ReadonlySet<string>;
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
  if (!ctx.visibleValues.has(value)) return null;

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
  onNavigationBoundaryReached,
  orientation = "vertical",
  wrap = true,
  disabled = false,
  isActive = true,
  maxVisibleItems,
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
  } = useListNavigation({
    items: navigableItems,
    defaultHighlightedId: value ?? defaultValue,
    onHighlightChange,
    onNavigationBoundaryReached,
    wrap,
  });

  const selectedValue = value ?? internalValue;
  const highlightedIndex = Math.max(
    items.findIndex((item) => item.value === highlightedValue),
    0,
  );
  const viewportRows = Math.max(1, Math.min(maxVisibleItems ?? items.length, items.length));
  const isWindowed = viewportRows < items.length;
  const window = getListWindow({
    selectedIndex: highlightedIndex,
    total: items.length,
    viewportRows,
  });
  const visibleValues = new Set(items.slice(window.start, window.end).map((item) => item.value));

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
        visibleValues,
        tokens,
      }}
    >
      <Box
        flexDirection={isVertical ? "column" : "row"}
        gap={isVertical ? 0 : 2}
        height={isVertical && isWindowed ? viewportRows : undefined}
        overflow={isVertical && isWindowed ? "hidden" : undefined}
      >
        {isVertical && window.canScrollUp ? <Text color={tokens.muted}>{"\u25B2"}</Text> : null}
        {children}
        {isVertical && window.canScrollDown ? <Text color={tokens.muted}>{"\u25BC"}</Text> : null}
      </Box>
    </RadioGroupContext>
  );
}

export const RadioGroup = Object.assign(RadioGroupRoot, {
  Item: RadioGroupItem,
});
