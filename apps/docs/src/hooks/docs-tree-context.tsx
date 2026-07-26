import { createContext, type ReactNode, useContext } from "react";
import type { PageTree } from "@/lib/page-tree";

const DocsTreeContext = createContext<PageTree | null>(null);

export function DocsTreeProvider({ tree, children }: { tree: PageTree; children: ReactNode }) {
  return <DocsTreeContext value={tree}>{children}</DocsTreeContext>;
}

/** The page tree of the library that owns the current route, or null outside a docs shell. */
export function useDocsTree(): PageTree | null {
  return useContext(DocsTreeContext);
}
