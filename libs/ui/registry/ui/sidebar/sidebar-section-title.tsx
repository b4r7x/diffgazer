"use client";

import type { HTMLAttributes, MouseEvent, ReactNode, Ref } from "react";
import { cn } from "@/lib/utils";
import { Chevron } from "../icons/chevron";
import { useSidebarSectionContext } from "./sidebar-section-context";

export interface SidebarSectionTitleProps extends HTMLAttributes<HTMLElement> {
  ref?: Ref<HTMLElement>;
  handle?: ReactNode | null;
}

export function SidebarSectionTitle({ ref, children, className, onClick, handle, ...rest }: SidebarSectionTitleProps) {
  const { collapsible, open, onToggle, titleId } = useSidebarSectionContext();
  const resolvedHandle = handle === undefined ? <Chevron open={open} size="sm" /> : handle;
  const isInteractive = collapsible || !!onClick;

  const handleClick = isInteractive
    ? (e: MouseEvent<HTMLElement>) => {
        if (collapsible) onToggle();
        onClick?.(e);
      }
    : undefined;

  const computedClassName = cn(
    "px-2 py-2 text-muted-foreground text-xs font-mono font-bold",
    isInteractive && "text-left w-full appearance-none cursor-pointer select-none",
    collapsible && "flex items-center gap-1",
    className,
  );

  if (isInteractive) {
    return (
      <button
        {...rest}
        ref={ref as Ref<HTMLButtonElement>}
        type="button"
        id={titleId}
        className={computedClassName}
        onClick={handleClick}
        aria-expanded={collapsible ? open : undefined}
      >
        {collapsible && resolvedHandle}
        {children}
      </button>
    );
  }

  return (
    <div
      {...rest}
      ref={ref as Ref<HTMLDivElement>}
      id={titleId}
      className={computedClassName}
    >
      {children}
    </div>
  );
}
