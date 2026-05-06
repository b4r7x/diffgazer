"use client"

import type { AnchorHTMLAttributes, ComponentPropsWithRef, ReactNode, Ref } from "react"
import { cn } from "@/lib/utils"

const DIRECTION_CONFIG = {
  previous: { rel: "prev" },
  next: { rel: "next" },
} as const

export type PagerLinkRenderProps = AnchorHTMLAttributes<HTMLAnchorElement> & {
  ref: Ref<HTMLAnchorElement>
  className: string
  rel: string
  direction: "previous" | "next"
}

export interface PagerLinkProps extends Omit<ComponentPropsWithRef<"a">, "children"> {
  children: ReactNode | ((props: PagerLinkRenderProps) => ReactNode)
  direction: "previous" | "next"
}

export function PagerLink({ className, ref, children, direction, ...props }: PagerLinkProps) {
  const { rel } = DIRECTION_CONFIG[direction]
  const resolvedClassName = cn(
    "text-xs font-mono text-muted-foreground hover:text-foreground transition-colors",
    direction === "next" && "ml-auto",
    className,
  )

  if (typeof children === "function") {
    return <>{children({ ref: ref ?? null, className: resolvedClassName, rel, direction, ...props })}</>
  }

  return (
    <a
      ref={ref}
      rel={rel}
      className={resolvedClassName}
      {...props}
    >
      {direction === "previous" && <span aria-hidden="true">&larr; </span>}
      {children}
      {direction === "next" && <span aria-hidden="true"> &rarr;</span>}
    </a>
  )
}
