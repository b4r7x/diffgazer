"use client";

import { createContext, useContext } from "react";

export interface SidebarItemPositionContextValue {
  isLast: boolean;
}

export const SidebarItemPositionContext = createContext<SidebarItemPositionContextValue>({
  isLast: false,
});

export function useSidebarItemPosition() {
  return useContext(SidebarItemPositionContext);
}
