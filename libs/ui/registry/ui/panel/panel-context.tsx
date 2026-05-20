"use client";

import { createContext, useContext } from "react";

export interface PanelContextValue {
  titleId: string;
  descriptionId: string;
}

export const PanelContext = createContext<PanelContextValue | undefined>(undefined);

export function usePanelContext(): PanelContextValue {
  const context = useContext(PanelContext);
  if (!context) {
    throw new Error("Panel compound components must be used within a Panel");
  }
  return context;
}
