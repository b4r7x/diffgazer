"use client";

import { useId, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { MenuLabel } from "./menu-label";

export interface MenuGroupProps {
  label?: ReactNode;
  children: ReactNode;
  className?: string;
}

export function MenuGroup({ label, children, className }: MenuGroupProps) {
  const labelId = useId();
  const hasLabel = label !== undefined && label !== null;

  return (
    <div
      role="group"
      aria-labelledby={hasLabel ? labelId : undefined}
      className={cn(className)}
    >
      {hasLabel && <MenuLabel id={labelId}>{label}</MenuLabel>}
      {children}
    </div>
  );
}
