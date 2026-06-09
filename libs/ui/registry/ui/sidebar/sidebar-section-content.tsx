"use client";

import {
  Children,
  type HTMLAttributes,
  isValidElement,
  type ReactNode,
  type Ref,
} from "react";
import { cn } from "@/lib/utils";
import { useSidebarChrome } from "./sidebar-context";
import { SidebarItemPositionContext } from "./sidebar-item-position-context";
import { SidebarItem } from "./sidebar-item";
import { useSidebarSectionContext } from "./sidebar-section-context";

export interface SidebarSectionContentProps extends HTMLAttributes<HTMLDivElement> {
  ref?: Ref<HTMLDivElement>;
}

function wrapTreeItems(children: ReactNode): ReactNode {
  const items = Children.toArray(children);
  const itemIndices = items.reduce<number[]>((indices, child, index) => {
    if (isValidElement(child) && child.type === SidebarItem) {
      indices.push(index);
    }
    return indices;
  }, []);
  const lastItemIndex = itemIndices.at(-1);

  return items.map((child, index) => {
    if (!isValidElement(child) || child.type !== SidebarItem || lastItemIndex === undefined) {
      return child;
    }
    return (
      <SidebarItemPositionContext
        // biome-ignore lint/suspicious/noArrayIndexKey: positional wrapper for tree connector context; child order is stable.
        key={index}
        value={{ isLast: index === lastItemIndex }}
      >
        {child}
      </SidebarItemPositionContext>
    );
  });
}

export function SidebarSectionContent({
  ref,
  className,
  children,
  ...rest
}: SidebarSectionContentProps) {
  const { open, panelId, collapsible } = useSidebarSectionContext();
  const { variant } = useSidebarChrome();
  const isTree = variant === "tree";
  const isClosed = collapsible && !open;
  const treeChildren = isTree ? wrapTreeItems(children) : children;

  return (
    <div
      {...rest}
      ref={ref}
      id={panelId}
      data-slot="sidebar-section-content"
      data-state={open ? "open" : "closed"}
      aria-hidden={isClosed || undefined}
      inert={isClosed || undefined}
    >
      <div
        data-slot="sidebar-section-content-inner"
        className={cn(
          "flex flex-col",
          isTree && "ml-1.5 gap-1 border-l border-border pl-2",
          className,
        )}
      >
        {treeChildren}
      </div>
    </div>
  );
}
