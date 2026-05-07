"use client";

import { createContext, useContext, type ReactNode } from "react"

interface BreadcrumbsContextValue {
  separator: ReactNode
  current?: boolean
}

const BreadcrumbsContext = createContext<BreadcrumbsContextValue | undefined>(undefined)

export function useBreadcrumbsContext(): BreadcrumbsContextValue {
  const ctx = useContext(BreadcrumbsContext)
  if (ctx === undefined) throw new Error("Breadcrumbs parts must be used within a Breadcrumbs")
  return ctx
}

export { BreadcrumbsContext }
