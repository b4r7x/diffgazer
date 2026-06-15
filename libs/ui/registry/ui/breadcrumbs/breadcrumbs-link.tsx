"use client";

import type { AnchorHTMLAttributes, ReactNode, Ref } from "react";
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
      "transition-colors hover:text-foreground hover:underline hover:underline-offset-2",
      className,
    ),
    "aria-current": current ? "page" : undefined,
    "data-slot": "breadcrumbs-link",
    ...props,
  };

  if (typeof children === "function") return <>{children(renderProps)}</>;

  return <a {...renderProps}>{children}</a>;
}
