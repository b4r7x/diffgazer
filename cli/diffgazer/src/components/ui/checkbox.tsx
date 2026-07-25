import { Box } from "ink";
import type { ReactElement, ReactNode } from "react";
import { createContext, useContext, useState } from "react";
import { useListNavigation } from "../../hooks/use-list-navigation";
import { useListNavigationInput } from "../../hooks/use-list-navigation-input";
import { collectChildItems } from "../../lib/collect-child-items";
import { SelectableItemRow } from "./selectable-item-row";

export interface CheckboxGroupProps<T extends string = string> {
  value?: T[];
  defaultValue?: T[];
  onChange?: (value: T[]) => void;
  onHighlightChange?: (value: string) => void;
  onNavigationBoundaryReached?: (direction: 1 | -1) => void;
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

  return (
    <SelectableItemRow
      indicator={ctx.checkedValues.includes(value) ? "[x]" : "[ ]"}
      label={label}
      description={description}
      disabled={disabled || ctx.groupDisabled}
      highlighted={ctx.highlightedValue === value}
      descriptionIndent={4}
    />
  );
}

function CheckboxGroupRoot<T extends string = string>({
  value,
  defaultValue,
  onChange,
  onHighlightChange,
  onNavigationBoundaryReached,
  wrap = true,
  disabled = false,
  isActive = true,
  children,
}: CheckboxGroupProps<T>) {
  const items = collectChildItems(children, extractCheckboxItem);
  const navigableItems = items.map((item) => ({
    id: item.value,
    disabled: disabled || item.disabled,
  }));

  const [internalValue, setInternalValue] = useState<string[]>(defaultValue ?? []);
  const navigation = useListNavigation({
    items: navigableItems,
    onHighlightChange,
    onNavigationBoundaryReached,
    wrap,
  });

  const checkedValues = value ?? internalValue;

  function toggle(id: string) {
    const nextValues = checkedValues.includes(id)
      ? checkedValues.filter((v) => v !== id)
      : [...checkedValues, id];

    if (value === undefined) {
      setInternalValue(nextValues);
    }
    onChange?.(nextValues as T[]);
  }

  useListNavigationInput({
    navigation,
    isActive: isActive && !disabled,
    activateOnSpace: true,
    onActivate: (item) => toggle(item.id),
  });

  return (
    <CheckboxGroupContext
      value={{
        checkedValues: checkedValues as string[],
        highlightedValue: navigation.currentHighlightedId,
        groupDisabled: disabled,
      }}
    >
      <Box flexDirection="column">{children}</Box>
    </CheckboxGroupContext>
  );
}

export const CheckboxGroup = Object.assign(CheckboxGroupRoot, {
  Item: CheckboxItem,
});
