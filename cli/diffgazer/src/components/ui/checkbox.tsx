import { moveHighlight } from "@diffgazer/keys";
import { Box, Text, useInput } from "ink";
import type { ReactElement, ReactNode } from "react";
import { createContext, useContext, useState } from "react";
import { collectChildItems } from "../../lib/list-navigation";
import type { CliColorTokens } from "../../theme/palettes";
import { useTheme } from "../../theme/provider";

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

interface CollectedItem {
  value: string;
  disabled: boolean;
}

function extractCheckboxItem(element: ReactElement): CollectedItem | null {
  if (element.type !== CheckboxItem) return null;
  const props = element.props as CheckboxItemProps;
  return { value: props.value, disabled: props.disabled ?? false };
}

function CheckboxItem({ value, label, description, disabled = false }: CheckboxItemProps) {
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
          <Text>{"    "}</Text>
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
  const navigableItems = items.map((item) => ({
    id: item.value,
    disabled: disabled || item.disabled,
  }));
  const selectableItems = navigableItems.filter((item) => !item.disabled);

  const [internalValue, setInternalValue] = useState<string[]>(defaultValue ?? []);
  const [internalHighlightedValue, setInternalHighlightedValue] = useState<string | null>(null);

  const checkedValues = value ?? internalValue;
  const highlightedValue =
    internalHighlightedValue !== null &&
    selectableItems.some((item) => item.id === internalHighlightedValue)
      ? internalHighlightedValue
      : (selectableItems[0]?.id ?? "");

  function moveBy(direction: 1 | -1) {
    const result = moveHighlight(navigableItems, highlightedValue, direction, wrap);
    if (!result) return;
    setInternalHighlightedValue(result.id);
    onHighlightChange?.(result.id);
  }

  function toggleCurrent() {
    const item = items.find(
      (candidate) => candidate.value === highlightedValue && !candidate.disabled,
    );
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
        moveBy(-1);
        return;
      }
      if (key.downArrow) {
        moveBy(1);
        return;
      }
      if (_input === " " || key.return) {
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

export const CheckboxGroup = Object.assign(CheckboxGroupRoot, {
  Item: CheckboxItem,
});
