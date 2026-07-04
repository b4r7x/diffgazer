import { createContext, type ReactNode, useContext } from "react";
import type { HookData } from "@/lib/generated-doc-data";
import type { ComponentData } from "@/types/data";

export type { HookData } from "@/lib/generated-doc-data";

export type DocData = { type: "component"; data: ComponentData } | { type: "hook"; data: HookData };

const DocDataContext = createContext<DocData | null>(null);

export function DocDataProvider({
  value,
  children,
}: {
  value: DocData | null;
  children: ReactNode;
}) {
  return <DocDataContext value={value}>{children}</DocDataContext>;
}

export function useDocData(): DocData | null {
  return useContext(DocDataContext);
}

export function useComponentData(): ComponentData | null {
  const ctx = useDocData();
  return ctx?.type === "component" ? ctx.data : null;
}

export function useHookData(): HookData | null {
  const ctx = useDocData();
  return ctx?.type === "hook" ? ctx.data : null;
}
