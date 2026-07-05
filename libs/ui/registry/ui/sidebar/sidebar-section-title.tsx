"use client";

import {
  type ComponentProps,
  createElement,
  type MouseEvent,
  type MouseEventHandler,
  type ReactNode,
  type Ref,
} from "react";
import { cn } from "@/lib/utils";
import { Chevron } from "../icons/chevron";
import { useSidebarChrome } from "./sidebar-context";
import { useSidebarSectionContext } from "./sidebar-section-context";

export type SidebarSectionTitleHeadingLevel = "h1" | "h2" | "h3" | "h4" | "h5" | "h6";

/** Props for sidebar section title. */
export interface SidebarSectionTitleProps extends Omit<ComponentProps<"h2">, "ref" | "onClick"> {
  /** Ref forwarded to the underlying element. */
  ref?: Ref<HTMLElement>;
  /** Called when click occurs. */
  onClick?: MouseEventHandler<HTMLElement>;
  /** Custom handle element for collapsible sections. Pass null to hide. */
  handle?: ReactNode | null;
  /**
   * Heading level rendered for the section title. Default h3 keeps screen-reader heading-rotor
   * navigation predictable. Collapsible sections wrap a button with aria-expanded/aria-controls
   * inside the heading.
   */
  headingLevel?: SidebarSectionTitleHeadingLevel;
}

// Hidden in rail mode: section titles read as truncated text inside a 48px
// rail. The section divider (top border between sibling sections) becomes the
// visual group separator in rail.
const HEADING_CLASS_NAME =
  "px-2 pt-4 pb-1.5 text-muted-foreground text-xs font-mono font-medium uppercase tracking-wider m-0 group-data-[state=rail]/sidebar:hidden";

const TREE_HEADING_CLASS_NAME =
  "px-2 pt-2 pb-1 text-foreground text-sm font-mono font-bold normal-case tracking-normal m-0 group-data-[state=rail]/sidebar:hidden";

/** Section label heading. Disclosure-pattern toggle when collapsible. */
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
  const { variant } = useSidebarChrome();
  const isTree = variant === "tree";
  const defaultHandle = <Chevron open={open} size="sm" />;
  const resolvedHandle = handle === undefined ? defaultHandle : handle;
  const headingClassName = isTree ? TREE_HEADING_CLASS_NAME : HEADING_CLASS_NAME;
  const isInteractive = collapsible || !!onClick;

  if (isInteractive) {
    const handleClick = (e: MouseEvent<HTMLButtonElement>) => {
      onClick?.(e);
      if (collapsible && !e.defaultPrevented) onToggle();
    };

    return createElement(
      headingLevel,
      { ref, id: titleId, className: cn(headingClassName, className) },
      <button
        {...(rest as ComponentProps<"button">)}
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
    { ...rest, ref, id: titleId, className: cn(headingClassName, className) },
    children,
  );
}
