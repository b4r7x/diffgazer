import { Box, Text } from "ink";
import type { ReactElement, ReactNode } from "react";
import { createContext, useContext, useState } from "react";
import { useListNavigation } from "../../hooks/use-list-navigation";
import { useListNavigationInput } from "../../hooks/use-list-navigation-input";
import { collectChildItems } from "../../lib/collect-child-items";
import { getListWindow } from "../../lib/list-window";
import { useTheme } from "../../theme/provider";
import { SelectableItemRow } from "./selectable-item-row";

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

  return (
    <SelectableItemRow
      indicator={ctx.selectedValue === value ? "( * )" : "(   )"}
      label={label}
      description={description}
      disabled={disabled || ctx.groupDisabled}
      highlighted={ctx.highlightedValue === value}
      descriptionIndent={6}
    />
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
  const navigation = useListNavigation({
    items: navigableItems,
    defaultHighlightedId: value ?? defaultValue,
    onHighlightChange,
    onNavigationBoundaryReached,
    wrap,
  });
  const highlightedValue = navigation.currentHighlightedId;

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

  const isVertical = orientation === "vertical";
  const showScrollGutter = isVertical && isWindowed;

  useListNavigationInput({
    navigation,
    isActive: isActive && !disabled,
    orientation,
    activateOnSpace: true,
    onActivate: (item) => {
      if (value === undefined) {
        setInternalValue(item.id);
      }
      onChange?.(item.id);
    },
  });

  return (
    <RadioGroupContext
      value={{
        selectedValue,
        highlightedValue,
        groupDisabled: disabled,
        visibleValues,
      }}
    >
      {showScrollGutter ? (
        <Box flexDirection="row">
          <Box flexDirection="column">{children}</Box>
          <Box flexDirection="column" justifyContent="space-between" marginLeft={1}>
            <Text color={tokens.muted}>{window.canScrollUp ? "\u25B2" : " "}</Text>
            <Text color={tokens.muted}>{window.canScrollDown ? "\u25BC" : " "}</Text>
          </Box>
        </Box>
      ) : (
        <Box flexDirection={isVertical ? "column" : "row"} gap={isVertical ? 0 : 2}>
          {children}
        </Box>
      )}
    </RadioGroupContext>
  );
}

export const RadioGroup = Object.assign(RadioGroupRoot, {
  Item: RadioGroupItem,
});
