"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { useNavigationListItemContext } from "./navigation-list-item-context";

const SELECTION_INDICATOR = "\u258C";

export interface NavigationListTitleProps {
  children: ReactNode;
  className?: string;
}

export function NavigationListTitle({ children, className }: NavigationListTitleProps) {
  const { labelId } = useNavigationListItemContext();

  return (
    <span id={labelId} className={cn("col-start-1 row-start-1 font-bold flex items-center group-data-[active]:text-background", className)}>
      <span aria-hidden="true" className="mr-2 opacity-0 group-data-[active]:opacity-100">{SELECTION_INDICATOR}</span>
      {children}
    </span>
  );
}
