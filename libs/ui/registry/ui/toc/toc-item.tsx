"use client";

import type {
  AnchorHTMLAttributes,
  ComponentPropsWithRef,
  CSSProperties,
  ReactNode,
  Ref,
} from "react";
import { cva } from "class-variance-authority";
import { cn } from "@/lib/utils";

const INDENT_BASE_PX = 12;
const INDENT_PER_LEVEL_PX = 12;

export const tocItemVariants = cva(
  "block py-1 text-xs font-mono transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
  {
    variants: {
      active: {
        true: "text-primary font-bold",
        false: "text-muted-foreground hover:text-foreground",
      },
    },
    defaultVariants: {
      active: false,
    },
  },
);

export type TocItemRenderProps = AnchorHTMLAttributes<HTMLAnchorElement> & {
  ref: Ref<HTMLAnchorElement>;
  className: string;
  style: CSSProperties;
  "data-active"?: true;
};

export interface TocItemProps extends Omit<ComponentPropsWithRef<"a">, "children"> {
  children: ReactNode | ((props: TocItemRenderProps) => ReactNode);
  active?: boolean;
  /** Heading level (2 = h2, 3 = h3, etc). Values below 2 are treated as 2. */
  depth?: number;
}

export function TocItem({
  children,
  depth = 2,
  active,
  className,
  style,
  ref,
  ...props
}: TocItemProps) {
  const indent = Math.max(0, depth - 2) * INDENT_PER_LEVEL_PX + INDENT_BASE_PX;

  const renderProps: TocItemRenderProps = {
    ref: ref ?? null,
    "aria-current": active ? "location" : undefined,
    "data-active": active || undefined,
    className: cn(tocItemVariants({ active }), className),
    style: { paddingLeft: `${indent}px`, ...style },
    ...props,
  };

  if (typeof children === "function") return <li>{children(renderProps)}</li>;

  return (
    <li>
      <a {...renderProps}>{children}</a>
    </li>
  );
}