"use client";

import { createContext, useContext } from "react";
import type { VariantProps } from "class-variance-authority";
import type { keyValueVariants } from "./key-value";
import type { valueVariants } from "./key-value-item";

export type KeyValueLayout = NonNullable<VariantProps<typeof keyValueVariants>["layout"]>;
export type KeyValueVariant = NonNullable<VariantProps<typeof valueVariants>["variant"]>;

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
