"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { useNavigationListItemContext } from "./navigation-list-item-context";

/** Props for navigation list subtitle. */
export interface NavigationListSubtitleProps {
  /** Secondary metadata text. Wired to aria-describedby. */
  children: ReactNode;
  /** Additional class names merged onto the rendered element. */
  className?: string;
}

/** Secondary metadata text. */
export function NavigationListSubtitle({ children, className }: NavigationListSubtitleProps) {
  const { descId } = useNavigationListItemContext();

  return (
    <span
      id={`${descId}-sub`}
      className={cn(
        "text-2xs inline-flex min-w-0 flex-1 truncate items-center leading-none text-muted-foreground group-data-[highlighted]:text-primary-foreground/70",
        className,
      )}
    >
      {children}
    </span>
  );
}
