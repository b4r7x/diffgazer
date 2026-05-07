"use client";

import type { AnchorHTMLAttributes, ReactNode, Ref } from "react"
import { cn } from "@/lib/utils"
import { useBreadcrumbsContext } from "./breadcrumbs-context"

export type BreadcrumbsLinkRenderProps = AnchorHTMLAttributes<HTMLAnchorElement> & {
  ref: Ref<HTMLAnchorElement>
  className: string
}

export interface BreadcrumbsLinkProps extends Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "children"> {
  children: ReactNode | ((props: BreadcrumbsLinkRenderProps) => ReactNode)
  ref?: Ref<HTMLAnchorElement>
}

export function BreadcrumbsLink({ children, className, ref, ...props }: BreadcrumbsLinkProps) {
  const { current } = useBreadcrumbsContext()
  const renderProps: BreadcrumbsLinkRenderProps = {
    ref: ref ?? null,
    className: cn("transition-colors hover:text-foreground hover:underline hover:underline-offset-2", className),
    "aria-current": current ? "page" : undefined,
    ...props,
  }

  if (typeof children === "function") return <>{children(renderProps)}</>

  return (
    <a {...renderProps}>
      {children}
    </a>
  )
}
