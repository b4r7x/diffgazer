"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { useNavigationListContext } from "./navigation-list-context";
import { useNavigationListItemContext } from "./navigation-list-item-context";

const INDICATOR_GLYPHS = {
  bar: "\u258C",
  "bar-thick": "\u258C",
  arrow: ">",
  bracket: "[",
} as const;

export interface NavigationListTitleProps {
  children: ReactNode;
  className?: string;
}

export function NavigationListTitle({ children, className }: NavigationListTitleProps) {
  const { labelId, isTree } = useNavigationListItemContext();
  const { indicator } = useNavigationListContext();
  const glyph = INDICATOR_GLYPHS[indicator];

  return (
    <span id={labelId} className={cn("col-start-1 row-start-1 font-bold flex items-center group-data-[active]:text-primary-foreground", className)}>
      {!isTree && (
        <span aria-hidden="true" className="mr-2 opacity-30 group-data-[active]:opacity-100">{glyph}</span>
      )}
      {children}
      {!isTree && indicator === "bracket" && (
        <span aria-hidden="true" className="ml-2 opacity-30 group-data-[active]:opacity-100">{"]"}</span>
      )}
    </span>
  );
}
