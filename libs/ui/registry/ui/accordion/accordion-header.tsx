"use client";

import { type ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface AccordionHeaderProps {
  as?: "h2" | "h3" | "h4" | "h5" | "h6";
  children: ReactNode;
  className?: string;
}

export function AccordionHeader({ as: Tag = "h3", children, className }: AccordionHeaderProps) {
  return <Tag className={cn("m-0 font-normal", className)}>{children}</Tag>;
}
