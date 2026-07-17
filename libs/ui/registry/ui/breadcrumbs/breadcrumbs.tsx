"use client";

import {
  Children,
  type ComponentPropsWithRef,
  cloneElement,
  Fragment,
  isValidElement,
  type ReactElement,
  type ReactNode,
  useMemo,
} from "react";
import { cn } from "@/lib/utils";
import { BreadcrumbsContext } from "./breadcrumbs-context";
import { BreadcrumbsItem, type BreadcrumbsItemProps } from "./breadcrumbs-item";

/** Props for breadcrumbs. */
export interface BreadcrumbsProps extends ComponentPropsWithRef<"nav"> {
  /** Separator rendered between items. Pass null to omit. */
  separator?: ReactNode;
}

function isBreadcrumbsItemElement(child: ReactNode): child is ReactElement<BreadcrumbsItemProps> {
  return isValidElement<BreadcrumbsItemProps>(child) && child.type === BreadcrumbsItem;
}

function flattenFragments(children: ReactNode, parentKey?: string): ReactNode[] {
  return Children.toArray(children).flatMap((child, index) => {
    if (!isValidElement<{ children?: ReactNode }>(child)) return [child];
    const childKey = child.key === null ? String(index) : String(child.key);
    const composedKey = parentKey === undefined ? childKey : `${parentKey}/${childKey}`;
    if (child.type === Fragment) return flattenFragments(child.props.children, composedKey);
    return parentKey === undefined ? [child] : [cloneElement(child, { key: composedKey })];
  });
}

function resolveCurrentItem(children: ReactNode): ReactNode {
  const childArray = flattenFragments(children);
  const hasCurrentItem = childArray.some(
    (child) => isBreadcrumbsItemElement(child) && child.props.current,
  );
  const lastItemIndex = hasCurrentItem ? -1 : childArray.findLastIndex(isBreadcrumbsItemElement);

  if (lastItemIndex < 0) return childArray;

  return childArray.map((child, index) =>
    index === lastItemIndex && isBreadcrumbsItemElement(child)
      ? cloneElement(child, { current: true })
      : child,
  );
}

/** Root container (nav + ol). Accepts separator prop. */
export function Breadcrumbs({
  separator = "/",
  className,
  children,
  ref,
  ...props
}: BreadcrumbsProps) {
  const contextValue = useMemo(() => ({ separator }), [separator]);
  const resolvedChildren = resolveCurrentItem(children);

  return (
    <BreadcrumbsContext value={contextValue}>
      <nav
        ref={ref}
        data-slot="breadcrumbs"
        aria-label="Breadcrumb"
        className={cn("text-xs text-muted-foreground", className)}
        {...props}
      >
        <ol className="m-0 flex list-none flex-wrap items-center gap-1.5 p-0">
          {resolvedChildren}
        </ol>
      </nav>
    </BreadcrumbsContext>
  );
}
