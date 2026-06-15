"use client";

import type { ComponentPropsWithRef } from "react";
import { cn } from "@/lib/utils";

/** Props for breadcrumbs ellipsis. */
export interface BreadcrumbsEllipsisProps extends ComponentPropsWithRef<"span"> {
  /** Screen-reader text announcing collapsed levels. Defaults to "More". */
  label?: string;
}

/** Collapsed items placeholder. */
export function BreadcrumbsEllipsis({
  children = "...",
  className,
  label = "More",
  ref,
  ...props
}: BreadcrumbsEllipsisProps) {
  return (
    <span ref={ref} className={cn("flex size-5 items-center justify-center", className)} {...props}>
      <span aria-hidden="true">{children}</span>
      <span className="sr-only">{label}</span>
    </span>
  );
}
