"use client";

import type { ComponentPropsWithRef, ReactNode } from "react";
import { type OverflowIndicatorRender, OverflowItems } from "./overflow-items";
import { OverflowText } from "./overflow-text";

/** Props for div root. */
type DivRootProps = Omit<ComponentPropsWithRef<"div">, "children">;

/** Props for overflow text. */
type OverflowTextProps = DivRootProps & {
  mode?: "text";
  lines?: number;
  tooltip?: ReactNode | boolean;
  gap?: never;
  indicator?: never;
  children: string;
};

/** Props for overflow items. */
type OverflowItemsProps = DivRootProps & {
  mode: "items";
  lines?: never;
  tooltip?: never;
  gap?: string;
  indicator?: OverflowIndicatorRender;
  children: ReactNode;
};

/** Props for overflow. */
export type OverflowProps = OverflowTextProps | OverflowItemsProps;

/** Root - text mode by default; set mode="items" for fitting child items. */
export function Overflow({ mode, children, ...rest }: OverflowProps) {
  if (mode === "items") {
    return <OverflowItems {...rest}>{children}</OverflowItems>;
  }

  return <OverflowText {...rest}>{children}</OverflowText>;
}
