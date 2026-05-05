"use client"

import type { ComponentPropsWithRef } from "react"
import { cn } from "@/lib/utils"

export interface PagerProps extends ComponentPropsWithRef<"nav"> {}

export function Pager({ className, ref, children, ...props }: PagerProps) {
  return (
    <nav
      ref={ref}
      aria-label="Page navigation"
      className={cn(
        "flex items-center justify-between border-t border-border pt-4 mt-8",
        className
      )}
      {...props}
    >
      {children}
    </nav>
  )
}