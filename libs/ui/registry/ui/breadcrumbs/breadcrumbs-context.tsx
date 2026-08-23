"use client";

import { createContext, type ReactNode, useContext } from "react";

interface BreadcrumbsContextValue {
  /** Separator rendered between items. Pass null to omit. */
  separator: ReactNode;
  /** Marks the item as current. */
  current?: boolean;
}

const BreadcrumbsContext = createContext<BreadcrumbsContextValue | undefined>(undefined);

export function useBreadcrumbsContext(): BreadcrumbsContextValue {
  const ctx = useContext(BreadcrumbsContext);
  if (ctx === undefined) throw new Error("Breadcrumbs parts must be used within a Breadcrumbs");
  return ctx;
}

export { BreadcrumbsContext };
