"use client";

import type { AnchorHTMLAttributes, ComponentPropsWithRef, ReactNode, Ref } from "react";
import { cn } from "@/lib/utils";

const DIRECTION_CONFIG = {
  previous: { rel: "prev" },
  next: { rel: "next" },
} as const;

/** Props for pager link render. */
export type PagerLinkRenderProps = AnchorHTMLAttributes<HTMLAnchorElement> & {
  ref: Ref<HTMLAnchorElement>;
  className: string;
  rel: string;
  direction: "previous" | "next";
};

/** Props for pager link. */
export interface PagerLinkProps extends Omit<ComponentPropsWithRef<"a">, "children"> {
  /**
   * Link label, or a render function that receives ref, className, rel, direction, and
   * remaining anchor props for framework Link integration.
   */
  children: ReactNode | ((props: PagerLinkRenderProps) => ReactNode);
  /** Selects the arrow glyph, rel attribute (prev/next), and alignment. */
  direction: "previous" | "next";
}

/** direction="next" - right-aligned with → arrow. */
export function PagerLink({ className, ref, children, direction, ...props }: PagerLinkProps) {
  const { rel } = DIRECTION_CONFIG[direction];
  const resolvedClassName = cn(
    "text-xs font-mono text-muted-foreground hover:text-foreground transition-colors",
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
      {direction === "previous" && <span aria-hidden="true">&larr; </span>}
      {children}
      {direction === "next" && <span aria-hidden="true"> &rarr;</span>}
    </a>
  );
}
