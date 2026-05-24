"use client";

import { createElement, type HTMLAttributes, type MouseEvent, type ReactNode, type Ref } from "react";
import { cn } from "@/lib/utils";
import { Chevron } from "../icons/chevron";
import { useSidebarSectionContext } from "./sidebar-section-context";

export type SidebarSectionTitleHeadingLevel = "h1" | "h2" | "h3" | "h4" | "h5" | "h6";

export interface SidebarSectionTitleProps extends HTMLAttributes<HTMLElement> {
  ref?: Ref<HTMLElement>;
  handle?: ReactNode | null;
  headingLevel?: SidebarSectionTitleHeadingLevel;
}

// Hidden in rail mode: section titles read as truncated text inside a 48px
// rail. The section divider (top border between sibling sections) becomes the
// visual group separator in rail.
const HEADING_CLASS_NAME =
  "px-2 py-2 text-muted-foreground text-xs font-mono font-normal lowercase tracking-normal m-0 group-data-[state=rail]/sidebar:hidden";

export function SidebarSectionTitle({
  ref,
  children,
  className,
  onClick,
  handle,
  headingLevel = "h3",
  ...rest
}: SidebarSectionTitleProps) {
  const { collapsible, open, onToggle, titleId, panelId } = useSidebarSectionContext();
  const resolvedHandle = handle === undefined ? <Chevron open={open} size="sm" /> : handle;
  const isInteractive = collapsible || !!onClick;

  if (isInteractive) {
    const handleClick = (e: MouseEvent<HTMLButtonElement>) => {
      onClick?.(e);
      if (collapsible && !e.defaultPrevented) onToggle();
    };

    return createElement(
      headingLevel,
      { ref, id: titleId, className: cn(HEADING_CLASS_NAME, className) },
      <button
        {...(rest as HTMLAttributes<HTMLButtonElement>)}
        type="button"
        className={cn(
          "text-left w-full appearance-none cursor-pointer select-none bg-transparent border-0 p-0 m-0",
          "font-[inherit] text-[inherit]",
          // Intentional asymmetry: only the collapsible branch needs the row
          // layout, because only that branch renders the chevron handle next
          // to the label. A non-collapsible `onClick` title is just label
          // text with a click handler and inherits the heading's block layout.
          collapsible && "flex items-center gap-1",
        )}
        onClick={handleClick}
        aria-expanded={collapsible ? open : undefined}
        aria-controls={collapsible ? panelId : undefined}
      >
        {collapsible && resolvedHandle}
        {children}
      </button>,
    );
  }

  return createElement(
    headingLevel,
    { ...rest, ref, id: titleId, className: cn(HEADING_CLASS_NAME, className) },
    children,
  );
}
