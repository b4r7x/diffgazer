"use client";

import type { ComponentPropsWithRef } from "react"
import { cn } from "@/lib/utils"

export interface BreadcrumbsEllipsisProps extends ComponentPropsWithRef<"span"> {}

export function BreadcrumbsEllipsis({
  children = "...",
  className,
  ref,
  ...props
}: BreadcrumbsEllipsisProps) {
  return (
    <span
      ref={ref}
      role="presentation"
      aria-hidden="true"
      className={cn("flex size-5 items-center justify-center", className)}
      {...props}
    >
      {children}
    </span>
  )
}
