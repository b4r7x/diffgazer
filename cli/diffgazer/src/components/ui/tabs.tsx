import { moveHighlight } from "@diffgazer/keys";
import { Box, Text, useInput } from "ink";
import type { ReactElement, ReactNode } from "react";
import { createContext, useContext, useState } from "react";
import { collectChildItems } from "../../lib/list-navigation";
import { useTheme } from "../../theme/provider";

interface TabsProps {
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
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
  isActive: boolean;
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

function TabsRoot({ value, defaultValue, onValueChange, children }: TabsProps) {
  const [internalValue, setInternalValue] = useState(defaultValue ?? "");

  const activeValue = value ?? internalValue;

  function setActiveValue(next: string) {
    if (value === undefined) {
      setInternalValue(next);
    }
    onValueChange?.(next);
  }

  return (
    <TabsContext value={{ activeValue, setActiveValue, isActive: true }}>
      <Box flexDirection="column">{children}</Box>
    </TabsContext>
  );
}

function TabsList({ loop = true, isActive = true, children }: TabsListProps) {
  const ctx = useTabsContext();
  const { tokens } = useTheme();
  const triggers = collectChildItems(children, extractTabsTrigger);

  useInput(
    (_input, key) => {
      if (!key.leftArrow && !key.rightArrow) return;
      const result = moveHighlight(
        triggers.map((trigger) => ({ id: trigger.value, disabled: trigger.disabled })),
        ctx.activeValue,
        key.rightArrow ? 1 : -1,
        loop,
      );
      if (result) {
        ctx.setActiveValue(result.id);
      }
    },
    { isActive },
  );

  return (
    <Box
      gap={1}
      borderStyle="single"
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
    return <Text dimColor>{children}</Text>;
  }

  return (
    <Text
      color={isActiveTab ? tokens.fg : tokens.muted}
      backgroundColor={isActiveTab ? tokens.accent : undefined}
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
