"use client";

import { type ReactNode, useId } from "react";
import { cn } from "@/lib/utils";
import { MenuLabel } from "./menu-label";

/** Props for menu group. */
export interface MenuGroupProps {
  /**
   * Optional label rendered via MenuLabel. When provided, the group is labelled via
   * aria-labelledby.
   */
  label?: ReactNode;
  /** MenuItem, MenuItemCheckbox, MenuItemRadio, or MenuDivider children. */
  children: ReactNode;
  /** Additional class names merged onto the rendered element. */
  className?: string;
}

/** Semantic group with optional label. */
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
