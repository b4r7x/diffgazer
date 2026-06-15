"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { useNavigationListItemContext } from "./navigation-list-item-context";

/** Props for navigation list meta. */
export interface NavigationListMetaProps {
  /** Container for inline metadata (badges, dates). Wired to aria-describedby. */
  children: ReactNode;
  /** Additional class names merged onto the rendered element. */
  className?: string;
}

/** Row 2 container for badges and subtitles. */
export function NavigationListMeta({ children, className }: NavigationListMetaProps) {
  const { descId } = useNavigationListItemContext();

  return (
    <div
      id={`${descId}-meta`}
      className={cn(
        "col-span-full row-start-2 flex gap-2 items-center group-data-[highlighted]:text-primary-foreground/70",
        className,
      )}
    >
      {children}
    </div>
  );
}
