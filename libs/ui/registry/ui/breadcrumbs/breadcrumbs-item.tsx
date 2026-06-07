"use client";

import type { ComponentPropsWithRef } from "react";
import { cn } from "@/lib/utils";
import { BreadcrumbsContext, useBreadcrumbsContext } from "./breadcrumbs-context";

export interface BreadcrumbsItemProps extends ComponentPropsWithRef<"li"> {
  current?: boolean;
}

export function BreadcrumbsItem({
  current,
  className,
  children,
  ref,
  ...props
}: BreadcrumbsItemProps) {
  const { separator } = useBreadcrumbsContext();
  const itemContext = { separator, current };

  return (
    <>
      {separator != null && (
        <li
          role="presentation"
          aria-hidden="true"
          className="[&>svg]:size-3.5 text-muted-foreground/40 first:hidden"
        >
          {separator}
        </li>
      )}
      <BreadcrumbsContext value={itemContext}>
        <li
          ref={ref}
          className={cn(
            "inline-flex items-center gap-1.5",
            current && "font-bold text-foreground",
            className,
          )}
          {...props}
        >
          {current && (typeof children === "string" || typeof children === "number") ? (
            <span aria-current="page">{children}</span>
          ) : (
            children
          )}
        </li>
      </BreadcrumbsContext>
    </>
  );
}
