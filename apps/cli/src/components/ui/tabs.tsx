import { createContext, useState, useContext, Children, isValidElement } from "react";
import type { ReactNode } from "react";
import { Box, Text, useInput } from "ink";
import { useTheme } from "../../theme/theme-context.js";

// --- Types ---

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

// --- Context ---

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

// --- Trigger collection ---

interface CollectedTrigger {
  value: string;
  disabled: boolean;
}

function collectTriggers(children: ReactNode): CollectedTrigger[] {
  const triggers: CollectedTrigger[] = [];
  Children.forEach(children, (child) => {
    if (isValidElement<TabsTriggerProps>(child) && child.type === TabsTrigger) {
      triggers.push({
        value: child.props.value,
        disabled: child.props.disabled ?? false,
      });
    }
  });
  return triggers;
}

// --- Components ---

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
  const triggers = collectTriggers(children);
  const selectableTriggers = triggers.filter((t) => !t.disabled);

  useInput(
    (_input, key) => {
      if (!key.leftArrow && !key.rightArrow) return;
      if (selectableTriggers.length === 0) return;

      const currentIdx = selectableTriggers.findIndex(
        (t) => t.value === ctx.activeValue,
      );
      const direction = key.rightArrow ? 1 : -1;
      let nextIdx = currentIdx + direction;

      if (loop) {
        nextIdx = (nextIdx + selectableTriggers.length) % selectableTriggers.length;
      } else {
        nextIdx = Math.max(0, Math.min(nextIdx, selectableTriggers.length - 1));
      }

      const nextTrigger = selectableTriggers[nextIdx];
      if (nextTrigger) {
        ctx.setActiveValue(nextTrigger.value);
      }
    },
    { isActive },
  );

  return (
    <Box gap={1} borderStyle="single" borderBottom={false} borderLeft={false} borderRight={false} borderColor={tokens.border}>
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
      {isActiveTab ? ` ${children} ` : ` ${children} `}
    </Text>
  );
}

function TabsContent({ value, children }: TabsContentProps) {
  const ctx = useTabsContext();
  if (ctx.activeValue !== value) return null;
  return <Box>{children}</Box>;
}

// --- Compound export ---

export const Tabs = Object.assign(TabsRoot, {
  List: TabsList,
  Trigger: TabsTrigger,
  Content: TabsContent,
});
