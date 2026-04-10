import { createContext, useState, useContext } from "react";
import type { ReactElement, ReactNode } from "react";
import { Box, Text, useInput } from "ink";
import { useTheme } from "../../theme/theme-context.js";
import type { CliColorTokens } from "../../theme/palettes.js";
import { clampIndex, collectChildItems } from "../../lib/list-navigation.js";

// --- Types ---

export interface CheckboxGroupProps<T extends string = string> {
  value?: T[];
  defaultValue?: T[];
  onChange?: (value: T[]) => void;
  onHighlightChange?: (value: string) => void;
  wrap?: boolean;
  disabled?: boolean;
  isActive?: boolean;
  children: ReactNode;
}

export interface CheckboxItemProps {
  value: string;
  label: ReactNode;
  description?: ReactNode;
  disabled?: boolean;
}

// --- Context ---

interface CheckboxGroupContextValue {
  checkedValues: string[];
  highlightedValue: string;
  groupDisabled: boolean;
  tokens: CliColorTokens;
}

const CheckboxGroupContext = createContext<CheckboxGroupContextValue | null>(null);

function useCheckboxGroupContext(): CheckboxGroupContextValue {
  const value = useContext(CheckboxGroupContext);
  if (!value) {
    throw new Error("CheckboxGroup.Item must be used within a CheckboxGroup");
  }
  return value;
}

// --- Item collection ---

interface CollectedItem {
  value: string;
  disabled: boolean;
}

function extractCheckboxItem(element: ReactElement): CollectedItem | null {
  if (element.type !== CheckboxItem) return null;
  const props = element.props as CheckboxItemProps;
  return { value: props.value, disabled: props.disabled ?? false };
}

// --- Components ---

function CheckboxItem({
  value,
  label,
  description,
  disabled = false,
}: CheckboxItemProps) {
  const ctx = useCheckboxGroupContext();
  const isDisabled = disabled || ctx.groupDisabled;
  const isChecked = ctx.checkedValues.includes(value);
  const isHighlighted = ctx.highlightedValue === value;

  const indicator = isChecked ? "[x]" : "[ ]";

  if (isDisabled) {
    return (
      <Box flexDirection="column">
        <Box gap={1}>
          <Text dimColor>{indicator}</Text>
          {typeof label === "string" ? <Text dimColor>{label}</Text> : label}
        </Box>
        {description != null && (
          <Box>
            <Text dimColor>{"    "}</Text>
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
          <Text>{"    "}</Text>
          {typeof description === "string"
            ? <Text color={ctx.tokens.muted}>{description}</Text>
            : description}
        </Box>
      )}
    </Box>
  );
}

function CheckboxGroupRoot<T extends string = string>({
  value,
  defaultValue,
  onChange,
  onHighlightChange,
  wrap = true,
  disabled = false,
  isActive = true,
  children,
}: CheckboxGroupProps<T>) {
  const { tokens } = useTheme();
  const items = collectChildItems(children, extractCheckboxItem);
  const selectableItems = items.filter((item) => !item.disabled && !disabled);

  const [internalValue, setInternalValue] = useState<string[]>(defaultValue ?? []);
  const [highlightIndex, setHighlightIndex] = useState(0);

  const checkedValues = value ?? internalValue;
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

  function toggleCurrent() {
    const item = selectableItems[highlightIndex];
    if (!item) return;

    const nextValues = checkedValues.includes(item.value)
      ? checkedValues.filter((v) => v !== item.value)
      : [...checkedValues, item.value];

    if (value === undefined) {
      setInternalValue(nextValues);
    }
    onChange?.(nextValues as T[]);
  }

  useInput(
    (_input, key) => {
      if (key.upArrow) {
        moveHighlight(-1);
        return;
      }
      if (key.downArrow) {
        moveHighlight(1);
        return;
      }
      if (_input === " ") {
        toggleCurrent();
        return;
      }
    },
    { isActive: isActive && !disabled },
  );

  return (
    <CheckboxGroupContext
      value={{
        checkedValues: checkedValues as string[],
        highlightedValue,
        groupDisabled: disabled,
        tokens,
      }}
    >
      <Box flexDirection="column">{children}</Box>
    </CheckboxGroupContext>
  );
}

// --- Compound export ---

export const CheckboxGroup = Object.assign(CheckboxGroupRoot, {
  Item: CheckboxItem,
});
