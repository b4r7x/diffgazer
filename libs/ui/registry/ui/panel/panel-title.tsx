"use client";

import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";
import { usePanelContext } from "./panel-context";

export interface PanelTitleProps extends HTMLAttributes<HTMLHeadingElement> {
  as?: "h2" | "h3" | "h4" | "h5" | "h6";
}

export function PanelTitle({ children, className, as: Tag = "h2", ...props }: PanelTitleProps) {
  const { titleId } = usePanelContext();

  return (
    <Tag
      {...props}
      id={titleId}
      data-slot="panel-title"
      className={cn("m-0 text-sm font-bold leading-tight text-foreground", className)}
    >
      {children}
    </Tag>
  );
}
