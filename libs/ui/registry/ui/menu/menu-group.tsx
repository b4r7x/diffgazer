"use client";

import { type ReactNode, useId } from "react";
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
    // biome-ignore lint/a11y/useSemanticElements: role="group" labels a related set of menu items; <fieldset> is for form controls and is not appropriate inside a menu.
    <div role="group" aria-labelledby={hasLabel ? labelId : undefined} className={cn(className)}>
      {hasLabel && <MenuLabel id={labelId}>{label}</MenuLabel>}
      {children}
    </div>
  );
}
