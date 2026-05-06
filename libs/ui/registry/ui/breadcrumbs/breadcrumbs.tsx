"use client";

import {
  Children,
  cloneElement,
  isValidElement,
  useMemo,
  type ComponentPropsWithRef,
  type ReactElement,
  type ReactNode,
} from "react"
import { cn } from "@/lib/utils"
import { BreadcrumbsContext } from "./breadcrumbs-context"
import { BreadcrumbsItem, type BreadcrumbsItemProps } from "./breadcrumbs-item"

export interface BreadcrumbsProps extends ComponentPropsWithRef<"nav"> {
  separator?: ReactNode
}

function isBreadcrumbsItemElement(child: ReactNode): child is ReactElement<BreadcrumbsItemProps> {
  return isValidElement<BreadcrumbsItemProps>(child) && child.type === BreadcrumbsItem
}

function resolveCurrentItem(children: ReactNode): ReactNode {
  const childArray = Children.toArray(children)
  const hasCurrentItem = childArray.some((child) => isBreadcrumbsItemElement(child) && child.props.current)
  const lastItemIndex = hasCurrentItem ? -1 : childArray.findLastIndex(isBreadcrumbsItemElement)

  if (lastItemIndex < 0) return children

  return childArray.map((child, index) => (
    index === lastItemIndex && isBreadcrumbsItemElement(child)
      ? cloneElement(child, { current: true })
      : child
  ))
}

export function Breadcrumbs({ separator = "/", className, children, ref, ...props }: BreadcrumbsProps) {
  const contextValue = useMemo(() => ({ separator }), [separator]);
  const resolvedChildren = resolveCurrentItem(children)

  return (
    <BreadcrumbsContext value={contextValue}>
      <nav
        ref={ref}
        aria-label="Breadcrumb"
        className={cn("text-xs text-muted-foreground", className)}
        {...props}
      >
        <ol className="m-0 flex list-none flex-wrap items-center gap-1.5 p-0">
          {resolvedChildren}
        </ol>
      </nav>
    </BreadcrumbsContext>
  )
}
