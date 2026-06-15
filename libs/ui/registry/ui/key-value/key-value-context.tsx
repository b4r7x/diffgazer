"use client";

import { createContext, useContext } from "react";

/**
 * Compound component for displaying labeled data. KeyValue wraps one or more KeyValue.Item rows
 * in a semantic description list.
 */
export type KeyValueLayout = "horizontal" | "vertical";
/** Allowed key value variant values. */
export type KeyValueVariant = "default" | "warning" | "info" | "success" | "error";

/** Context value shared by key value. */
interface KeyValueContextValue {
  /**
   * Horizontal places label and value side-by-side; vertical stacks them. Propagated to
   * KeyValue.Item via context.
   */
  layout: KeyValueLayout;
  /**
   * Adds row borders and switches items to compact xs sizing. Propagated to KeyValue.Item via
   * context.
   */
  bordered: boolean;
}

/** React context backing key value. */
const KeyValueContext = createContext<KeyValueContextValue | undefined>(undefined);

/** Reads the key value context. */
function useKeyValueContext(): KeyValueContextValue {
  const context = useContext(KeyValueContext);
  if (context === undefined) {
    throw new Error("KeyValue.Item must be used within KeyValue");
  }
  return context;
}

export { KeyValueContext, useKeyValueContext };
