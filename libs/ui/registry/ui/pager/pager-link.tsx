"use client";

import type { AnchorHTMLAttributes, ComponentPropsWithRef, ReactNode, Ref } from "react";
import { FOCUS_OUTLINE } from "@/lib/focus-outline";
import { cn } from "@/lib/utils";

export type PagerLinkRenderProps = AnchorHTMLAttributes<HTMLAnchorElement> & {
  ref: Ref<HTMLAnchorElement>;
  className: string;
  rel: string;
  direction: "previous" | "next";
};

export interface PagerLinkProps extends Omit<ComponentPropsWithRef<"a">, "children"> {
  /**
   * Link label, or a render function that receives ref, className, rel, direction, and
   * remaining anchor props for framework Link integration.
   */
  children: ReactNode | ((props: PagerLinkRenderProps) => ReactNode);
  /** Selects the arrow glyph, rel attribute (prev/next), and alignment. */
  direction: "previous" | "next";
}

/** Renders a previous or next pagination link. */
export function PagerLink({ className, ref, children, direction, ...props }: PagerLinkProps) {
  const rel = direction === "previous" ? "prev" : "next";
  const resolvedClassName = cn(
    "inline-flex items-center gap-1 py-2 -my-2 pointer-coarse:my-0 pointer-coarse:min-h-11",
    "text-xs font-mono text-muted-foreground hover:text-foreground transition-colors",
    FOCUS_OUTLINE,
    direction === "next" && "ml-auto",
    className,
  );

  if (typeof children === "function") {
    return (
      <>{children({ ref: ref ?? null, className: resolvedClassName, rel, direction, ...props })}</>
    );
  }

  return (
    <a ref={ref} rel={rel} className={resolvedClassName} {...props}>
      {direction === "previous" && <span aria-hidden="true">&larr;</span>}
      {children}
      {direction === "next" && <span aria-hidden="true">&rarr;</span>}
    </a>
  );
}
