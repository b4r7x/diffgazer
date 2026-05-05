"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { useNavigationListItemContext } from "./navigation-list-item-context";

export interface NavigationListSubtitleProps {
  children: ReactNode;
  className?: string;
}

export function NavigationListSubtitle({ children, className }: NavigationListSubtitleProps) {
  const { descId } = useNavigationListItemContext();

  return (
    <span
      id={`${descId}-sub`}
      className={cn(
        "text-[10px] inline-flex items-center leading-none text-muted-foreground group-data-[active]:text-background/70",
        className
      )}
    >
      {children}
    </span>
  );
}