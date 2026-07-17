import { createContext, type ReactNode, useContext } from "react";
import type { HookPageData } from "@/lib/generated-doc-data";
import type { ComponentPageData } from "@/types/data";

export type { HookPageData } from "@/lib/generated-doc-data";
export type { ComponentPageData } from "@/types/data";

export type DocData =
  | { type: "component"; data: ComponentPageData }
  | { type: "hook"; data: HookPageData };

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

export function useComponentData(): ComponentPageData | null {
  const ctx = useDocData();
  return ctx?.type === "component" ? ctx.data : null;
}

export function useHookData(): HookPageData | null {
  const ctx = useDocData();
  return ctx?.type === "hook" ? ctx.data : null;
}
