"use client";

import { useId, useMemo, type ReactNode } from "react";
import { useControllableState } from "@/hooks/use-controllable-state";
import { SidebarContext } from "./sidebar-context";

export interface SidebarProviderProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  defaultOpen?: boolean;
  children: ReactNode;
}

export function SidebarProvider({
  open: controlledOpen,
  onOpenChange,
  defaultOpen = true,
  children,
}: SidebarProviderProps) {
  const sidebarId = useId();
  const [isOpen, setIsOpen] = useControllableState({
    value: controlledOpen,
    defaultValue: defaultOpen,
    onChange: onOpenChange,
  });

  const contextValue = useMemo(
    () => ({
      open: isOpen,
      contentId: `${sidebarId}-content`,
      onOpenChange: setIsOpen,
      toggleSidebar: () => setIsOpen(prev => !prev),
    }),
    [isOpen, setIsOpen, sidebarId],
  );

  return (
    <SidebarContext value={contextValue}>
      {children}
    </SidebarContext>
  );
}
