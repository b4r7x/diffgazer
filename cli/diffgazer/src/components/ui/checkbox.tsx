import { Box } from "ink";
import type { ReactElement, ReactNode } from "react";
import { createContext, useContext } from "react";
import { type ListNavigationItem, useListNavigation } from "../../hooks/use-list-navigation";
import { useListNavigationInput } from "../../hooks/use-list-navigation-input";
import { collectChildItems } from "../../lib/collect-child-items";
import { SelectableItemRow } from "./selectable-item-row";

export interface CheckboxGroupProps<T extends string = string> {
  value: T[];
  onChange?: (value: T[]) => void;
  /** Controls the highlight, for a group whose owner scrolls the list itself. */
  highlightedValue?: string | null;
  onHighlightChange?: (value: string) => void;
  onNavigationBoundaryReached?: (direction: 1 | -1) => void;
  /**
   * The full item set, for a group that renders only the window of rows that
   * fits: without it the collected children are the whole list, and navigation
   * would stop at the edges of what happens to be on screen. Same escape hatch
   * `NavigationList` takes, with the same meaning.
   */
  navigationItems?: ListNavigationItem[];
  wrap?: boolean;
  disabled?: boolean;
  isActive?: boolean;
  children: ReactNode;
}

interface CheckboxItemProps {
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
  onChange,
  highlightedValue = null,
  onHighlightChange,
  onNavigationBoundaryReached,
  navigationItems,
  wrap = true,
  disabled = false,
  isActive = true,
  children,
}: CheckboxGroupProps<T>) {
  const renderedItems = collectChildItems(children, extractCheckboxItem).map((item) => ({
    id: item.value,
    disabled: item.disabled,
  }));
  const navigableItems = (navigationItems ?? renderedItems).map((item) => ({
    id: item.id,
    disabled: disabled || item.disabled,
  }));

  const navigation = useListNavigation({
    items: navigableItems,
    highlightedId: highlightedValue,
    onHighlightChange,
    onNavigationBoundaryReached,
    wrap,
  });

  const checkedValues: string[] = value;

  function toggle(id: string) {
    const nextValues = checkedValues.includes(id)
      ? checkedValues.filter((v) => v !== id)
      : [...checkedValues, id];

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
        checkedValues,
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
