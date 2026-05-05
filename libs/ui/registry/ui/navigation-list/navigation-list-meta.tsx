"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { useNavigationListItemContext } from "./navigation-list-item-context";

export interface NavigationListMetaProps {
  children: ReactNode;
  className?: string;
}

export function NavigationListMeta({ children, className }: NavigationListMetaProps) {
  const { descId } = useNavigationListItemContext();

  return (
    <div id={`${descId}-meta`} className={cn(
      "col-span-full row-start-2 flex gap-2 items-center group-data-[active]:text-background/70",
      className
    )}>
      {children}
    </div>
  );
}
