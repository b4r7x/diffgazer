"use client";

import { useMemo, type ReactNode } from "react";
import { useControllableState } from "@/hooks/use-controllable-state";
import { SidebarContext } from "./sidebar-context";

export interface SidebarProviderProps {
  collapsed?: boolean;
  onCollapsedChange?: (collapsed: boolean) => void;
  defaultCollapsed?: boolean;
  children: ReactNode;
}

export function SidebarProvider({
  collapsed: controlledCollapsed,
  onCollapsedChange,
  defaultCollapsed = false,
  children,
}: SidebarProviderProps) {
  const [isCollapsed, setIsCollapsed] = useControllableState({
    value: controlledCollapsed,
    defaultValue: defaultCollapsed,
    onChange: onCollapsedChange,
  });

  const contextValue = useMemo(
    () => ({
      collapsed: isCollapsed,
      onCollapsedChange: setIsCollapsed,
      toggleSidebar: () => setIsCollapsed(prev => !prev),
    }),
    [isCollapsed, setIsCollapsed],
  );

  return (
    <SidebarContext value={contextValue}>
      {children}
    </SidebarContext>
  );
}
