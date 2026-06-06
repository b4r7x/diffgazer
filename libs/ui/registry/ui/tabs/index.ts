"use client";

import { type TabsProps, Tabs as TabsRoot } from "./tabs";
import { TabsContent, type TabsContentProps } from "./tabs-content";
import { type TabsContextValue, useTabsContext } from "./tabs-context";
import { TabsList, type TabsListProps } from "./tabs-list";
import { TabsTrigger, type TabsTriggerProps } from "./tabs-trigger";

const Tabs = Object.assign(TabsRoot, {
  List: TabsList,
  Trigger: TabsTrigger,
  Content: TabsContent,
});

export { Tabs, type TabsProps };
export { TabsList, type TabsListProps };
export { TabsTrigger, type TabsTriggerProps };
export { TabsContent, type TabsContentProps };
export { useTabsContext, type TabsContextValue };
