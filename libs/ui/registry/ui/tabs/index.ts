import { Tabs as TabsRoot, type TabsProps } from "./tabs";
import { TabsList, type TabsListProps } from "./tabs-list";
import { TabsTrigger, type TabsTriggerProps, tabsTriggerVariants } from "./tabs-trigger";
import { TabsContent, type TabsContentProps } from "./tabs-content";
import { useTabsContext, type TabsContextValue } from "./tabs-context";

const Tabs = Object.assign(TabsRoot, {
  List: TabsList,
  Trigger: TabsTrigger,
  Content: TabsContent,
});

export { Tabs, type TabsProps };
export { TabsList, type TabsListProps };
export { TabsTrigger, tabsTriggerVariants, type TabsTriggerProps };
export { TabsContent, type TabsContentProps };
export { useTabsContext, type TabsContextValue };
