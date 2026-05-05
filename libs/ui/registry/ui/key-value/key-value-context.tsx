"use client";

import { createContext, useContext } from "react";

export type KeyValueLayout = "horizontal" | "vertical";
export type KeyValueVariant = "default" | "warning" | "info" | "success" | "error";

interface KeyValueContextValue {
  layout: KeyValueLayout;
  bordered: boolean;
}

const KeyValueContext = createContext<KeyValueContextValue | undefined>(undefined);

function useKeyValueContext(): KeyValueContextValue {
  const context = useContext(KeyValueContext);
  if (context === undefined) {
    throw new Error("KeyValue.Item must be used within KeyValue");
  }
  return context;
}

export { KeyValueContext, useKeyValueContext };
