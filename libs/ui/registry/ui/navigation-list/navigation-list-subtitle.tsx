"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { useNavigationListItemContext } from "./navigation-list-item-context";

export interface NavigationListSubtitleProps {
  /** Secondary metadata text. Wired to aria-describedby. */
  children: ReactNode;
  /** Additional class names merged onto the rendered element. */
  className?: string;
}

/** Secondary metadata text. */
export function NavigationListSubtitle({ children, className }: NavigationListSubtitleProps) {
  const { descIdPrefix } = useNavigationListItemContext();

  return (
    <span
      id={`${descIdPrefix}-sub`}
      className={cn(
        "block min-w-0 truncate text-2xs leading-none text-muted-foreground group-data-[highlighted]:text-primary-foreground/70",
        className,
      )}
    >
      {children}
    </span>
  );
}
