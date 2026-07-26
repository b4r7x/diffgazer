import { Box, Text } from "ink";
import type { ReactElement, ReactNode } from "react";
import { createContext, useContext, useState } from "react";
import { useListNavigation } from "../../hooks/use-list-navigation";
import { useListNavigationInput } from "../../hooks/use-list-navigation-input";
import { collectChildItems } from "../../lib/collect-child-items";
import { SURFACE_BORDER, selectionHue } from "../../theme/chrome";
import { useTheme } from "../../theme/provider";

interface TabsProps {
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  children: ReactNode;
}

interface TabsListProps {
  loop?: boolean;
  isActive?: boolean;
  children: ReactNode;
}

interface TabsTriggerProps {
  value: string;
  disabled?: boolean;
  children: string;
}

interface TabsContentProps {
  value: string;
  children: ReactNode;
}

interface TabsContextValue {
  activeValue: string;
  setActiveValue: (value: string) => void;
}

const TabsContext = createContext<TabsContextValue | null>(null);

function useTabsContext(): TabsContextValue {
  const value = useContext(TabsContext);
  if (!value) {
    throw new Error("Tabs.List/Tabs.Trigger/Tabs.Content must be used within a Tabs");
  }
  return value;
}

interface CollectedTrigger {
  value: string;
  disabled: boolean;
}

function extractTabsTrigger(element: ReactElement): CollectedTrigger | null {
  if (element.type !== TabsTrigger) return null;
  const props = element.props as TabsTriggerProps;
  return { value: props.value, disabled: props.disabled ?? false };
}

function TabsRoot({ value, defaultValue, onChange, children }: TabsProps) {
  const [internalValue, setInternalValue] = useState(defaultValue ?? "");

  const activeValue = value ?? internalValue;

  function setActiveValue(next: string) {
    if (value === undefined) {
      setInternalValue(next);
    }
    onChange?.(next);
  }

  return (
    <TabsContext value={{ activeValue, setActiveValue }}>
      <Box flexDirection="column">{children}</Box>
    </TabsContext>
  );
}

function TabsList({ loop = true, isActive = true, children }: TabsListProps) {
  const ctx = useTabsContext();
  const { tokens } = useTheme();
  const triggers = collectChildItems(children, extractTabsTrigger);
  const navigation = useListNavigation({
    items: triggers.map((trigger) => ({ id: trigger.value, disabled: trigger.disabled })),
    highlightedId: ctx.activeValue,
    onHighlightChange: ctx.setActiveValue,
    wrap: loop,
  });

  useListNavigationInput({ navigation, isActive, orientation: "horizontal" });

  return (
    <Box
      gap={1}
      borderStyle={SURFACE_BORDER}
      borderBottom={false}
      borderLeft={false}
      borderRight={false}
      borderColor={tokens.border}
    >
      {children}
    </Box>
  );
}

function TabsTrigger({ value, disabled = false, children }: TabsTriggerProps) {
  const ctx = useTabsContext();
  const { tokens } = useTheme();
  const isActiveTab = ctx.activeValue === value;

  if (disabled) {
    return <Text color={tokens.muted}>{children}</Text>;
  }

  return (
    <Text
      color={isActiveTab ? tokens.bg : tokens.muted}
      backgroundColor={isActiveTab ? selectionHue(tokens) : undefined}
      bold={isActiveTab}
    >
      {` ${children} `}
    </Text>
  );
}

function TabsContent({ value, children }: TabsContentProps) {
  const ctx = useTabsContext();
  if (ctx.activeValue !== value) return null;
  return <Box>{children}</Box>;
}

export const Tabs = Object.assign(TabsRoot, {
  List: TabsList,
  Trigger: TabsTrigger,
  Content: TabsContent,
});
