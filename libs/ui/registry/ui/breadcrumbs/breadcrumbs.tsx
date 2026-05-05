"use client";

import { useMemo, type ComponentPropsWithRef, type ReactNode } from "react"
import { cn } from "@/lib/utils"
import { BreadcrumbsContext } from "./breadcrumbs-context"

export interface BreadcrumbsProps extends ComponentPropsWithRef<"nav"> {
  separator?: ReactNode
}

export function Breadcrumbs({ separator = "/", className, children, ref, ...props }: BreadcrumbsProps) {
  const contextValue = useMemo(() => ({ separator }), [separator]);

  return (
    <BreadcrumbsContext value={contextValue}>
      <nav
        ref={ref}
        aria-label="Breadcrumb"
        className={cn("text-xs text-muted-foreground", className)}
        {...props}
      >
        <ol className="m-0 flex list-none flex-wrap items-center gap-1.5 p-0 [&:not(:has([aria-current]))>li:last-child]:font-bold [&:not(:has([aria-current]))>li:last-child]:text-foreground">
          {children}
        </ol>
      </nav>
    </BreadcrumbsContext>
  )
}
