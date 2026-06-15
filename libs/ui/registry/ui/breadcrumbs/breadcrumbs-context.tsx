"use client";

import { createContext, type ReactNode, useContext } from "react";

/** Context value shared by breadcrumbs. */
interface BreadcrumbsContextValue {
  /** Separator rendered between items. Pass null to omit. */
  separator: ReactNode;
  /** Marks the item as current. */
  current?: boolean;
}

/** React context backing breadcrumbs. */
const BreadcrumbsContext = createContext<BreadcrumbsContextValue | undefined>(undefined);

/** Reads the breadcrumbs context. */
export function useBreadcrumbsContext(): BreadcrumbsContextValue {
  const ctx = useContext(BreadcrumbsContext);
  if (ctx === undefined) throw new Error("Breadcrumbs parts must be used within a Breadcrumbs");
  return ctx;
}

export { BreadcrumbsContext };
