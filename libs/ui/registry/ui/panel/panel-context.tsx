"use client";

import { createContext, useContext } from "react";

/** Context value shared by panel. */
export interface PanelContextValue {
  /** Fallback id PanelTitle uses when the consumer does not supply one. */
  titleId: string;
  /** Fallback id PanelDescription uses when the consumer does not supply one. */
  descriptionId: string;
  /** PanelTitle registers its resolved id (consumer id wins) on mount. */
  registerTitle: (id: string) => void;
  /** Unregisters title from panel. */
  unregisterTitle: (id: string) => void;
  /** PanelDescription registers its resolved id on mount. */
  registerDescription: (id: string) => void;
  /** Unregisters description from panel. */
  unregisterDescription: (id: string) => void;
}

/** React context backing panel. */
export const PanelContext = createContext<PanelContextValue | undefined>(undefined);

/** Reads the panel context. */
export function usePanelContext(): PanelContextValue {
  const context = useContext(PanelContext);
  if (!context) {
    throw new Error("Panel compound components must be used within a Panel");
  }
  return context;
}
