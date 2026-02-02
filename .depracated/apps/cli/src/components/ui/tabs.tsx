import {
  createContext,
  useContext,
  useState,
  useMemo,
  Children,
  isValidElement,
  type ReactNode,
  type ReactElement,
} from "react";
import { Box, Text, useInput } from "ink";
import { useTheme } from "../../hooks/use-theme.js";

interface TabTriggerData {
  value: string;
  disabled: boolean;
  index: number;
}

interface TabsContextValue {
  value: string;
  onValueChange: (value: string) => void;
  triggers: TabTriggerData[];
  registerTrigger: (value: string, disabled: boolean) => void;
}

interface TabsProps {
  value?: string;
  onValueChange?: (value: string) => void;
  defaultValue?: string;
  isActive?: boolean;
  children: ReactNode;
}

interface TabsListProps {
  children: ReactNode;
}

interface TabsTriggerProps {
  value: string;
  disabled?: boolean;
  children: ReactNode;
}

interface TabsContentProps {
  value: string;
  children: ReactNode;
}

const TabsContext = createContext<TabsContextValue | null>(null);

function useTabsContext(): TabsContextValue {
  const context = useContext(TabsContext);
  if (!context) {
    throw new Error("Tabs compound components must be used within Tabs");
  }
  return context;
}

function extractTriggers(node: ReactNode): TabTriggerData[] {
  const triggers: TabTriggerData[] = [];
  let triggerIndex = 0;

  function walk(n: ReactNode): void {
    Children.forEach(n, (child) => {
      if (!isValidElement(child)) return;
      if (child.type === TabsList) {
        walk((child.props as TabsListProps).children);
      } else if (child.type === TabsTrigger) {
        const props = child.props as TabsTriggerProps;
        triggers.push({
          value: props.value,
          disabled: props.disabled ?? false,
          index: triggerIndex++,
        });
      }
    });
  }

  walk(node);
  return triggers;
}

export function TabsTrigger({
  value,
  disabled = false,
  children,
}: TabsTriggerProps): ReactElement {
  const { value: selectedValue } = useTabsContext();
  const { colors } = useTheme();

  const isActive = selectedValue === value;

  const bgColor = isActive ? colors.ui.info : undefined;
  const textColor = isActive ? "black" : disabled ? colors.ui.textMuted : colors.ui.text;

  return (
    <Text
      backgroundColor={bgColor}
      color={textColor}
      bold={isActive}
      dimColor={disabled}
    >
      {isActive ? "[ " : "  "}
      {children}
      {isActive ? " ]" : "  "}
    </Text>
  );
}

export function TabsList({ children }: TabsListProps): ReactElement {
  return (
    <Box flexDirection="row" gap={1}>
      {children}
    </Box>
  );
}

export function TabsContent({ value, children }: TabsContentProps): ReactElement | null {
  const { value: selectedValue } = useTabsContext();

  if (selectedValue !== value) {
    return null;
  }

  return <Box marginTop={1}>{children}</Box>;
}

export function Tabs({
  value: controlledValue,
  onValueChange,
  defaultValue = "",
  isActive = true,
  children,
}: TabsProps): ReactElement {
  const [uncontrolledValue, setUncontrolledValue] = useState(defaultValue);

  const value = controlledValue !== undefined ? controlledValue : uncontrolledValue;
  const handleValueChange = onValueChange ?? setUncontrolledValue;

  const triggers = extractTriggers(children);

  useInput(
    (input, key) => {
      if (!isActive) return;

      const currentIndex = triggers.findIndex((t) => t.value === value);
      if (currentIndex === -1) return;

      // h/l or left/right arrow navigation
      if (key.leftArrow || input === "h") {
        const newIndex = currentIndex <= 0 ? triggers.length - 1 : currentIndex - 1;
        const trigger = triggers[newIndex];
        if (trigger && !trigger.disabled) {
          handleValueChange(trigger.value);
        }
      }

      if (key.rightArrow || input === "l") {
        const newIndex = currentIndex >= triggers.length - 1 ? 0 : currentIndex + 1;
        const trigger = triggers[newIndex];
        if (trigger && !trigger.disabled) {
          handleValueChange(trigger.value);
        }
      }
    },
    { isActive }
  );

  const contextValue: TabsContextValue = useMemo(
    () => ({
      value,
      onValueChange: handleValueChange,
      triggers,
      registerTrigger: () => {},
    }),
    [value, handleValueChange, triggers]
  );

  return (
    <TabsContext.Provider value={contextValue}>
      <Box flexDirection="column">{children}</Box>
    </TabsContext.Provider>
  );
}

// Attach compound components
Tabs.List = TabsList;
Tabs.Trigger = TabsTrigger;
Tabs.Content = TabsContent;

export type { TabsProps, TabsListProps, TabsTriggerProps, TabsContentProps };
