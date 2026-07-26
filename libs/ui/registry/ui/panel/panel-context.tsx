"use client";

import { createContext, useContext } from "react";

/** Context value shared by panel. */
export interface PanelContextValue {
  /**
   * True when the panel draws corner brackets (the viewfinder frame, or any frame while
   * focused). PanelLabel reads it to clear the bracket arm instead of painting over it.
   */
  hasCorners: boolean;
  /**
   * True while the panel is marked as the active pane. PanelLabel reads it so the
   * readout variant state-changes with the corner brackets as one instrument.
   */
  focused: boolean;
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

export const PanelContext = createContext<PanelContextValue | undefined>(undefined);

export function usePanelContext(): PanelContextValue {
  const context = useContext(PanelContext);
  if (!context) {
    throw new Error("Panel compound components must be used within a Panel");
  }
  return context;
}
