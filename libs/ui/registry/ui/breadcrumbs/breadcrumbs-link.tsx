"use client";

import type { AnchorHTMLAttributes, ReactNode, Ref } from "react";
import { FOCUS_OUTLINE } from "@/lib/focus-outline";
import { cn } from "@/lib/utils";
import { useBreadcrumbsContext } from "./breadcrumbs-context";

/** Props for breadcrumbs link render. */
export type BreadcrumbsLinkRenderProps = AnchorHTMLAttributes<HTMLAnchorElement> & {
  ref: Ref<HTMLAnchorElement>;
  className: string;
  "data-slot": "breadcrumbs-link";
};

/** Props for breadcrumbs link. */
export interface BreadcrumbsLinkProps
  extends Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "children"> {
  /**
   * Link label, or a render function that receives ref, className, aria-current, and remaining
   * anchor props.
   */
  children: ReactNode | ((props: BreadcrumbsLinkRenderProps) => ReactNode);
  /** Ref forwarded to the underlying element. */
  ref?: Ref<HTMLAnchorElement>;
}

/** Navigation link. Supports render-prop for custom components. */
export function BreadcrumbsLink({ children, className, ref, ...props }: BreadcrumbsLinkProps) {
  const { current } = useBreadcrumbsContext();
  const renderProps: BreadcrumbsLinkRenderProps = {
    ref: ref ?? null,
    className: cn(
      // Same hit-area recipe as Pager.Link: padding grows the target, the negative
      // margin gives it back to the inline run, and pointer-coarse trades the pull-back
      // for a real 44px minimum. No horizontal pull-back — breadcrumb links sit on one
      // line and must not overlap their separators.
      "inline-flex items-center py-2 -my-2 px-1 pointer-coarse:my-0 pointer-coarse:min-h-11",
      "transition-colors hover:text-foreground hover:underline hover:underline-offset-2",
      FOCUS_OUTLINE,
      className,
    ),
    "aria-current": current ? "page" : undefined,
    "data-slot": "breadcrumbs-link",
    ...props,
  };

  if (typeof children === "function") return <>{children(renderProps)}</>;

  return <a {...renderProps}>{children}</a>;
}
