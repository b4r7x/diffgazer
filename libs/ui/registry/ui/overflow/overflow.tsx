"use client";

import type { ComponentPropsWithRef, ReactNode } from "react";
import { OverflowText } from "./overflow-text";
import { OverflowItems, type OverflowIndicatorRender } from "./overflow-items";

type DivRootProps = Omit<ComponentPropsWithRef<"div">, "children">;

type OverflowTextProps = DivRootProps & {
  mode?: "text";
  lines?: number;
  tooltip?: ReactNode | boolean;
  gap?: never;
  indicator?: never;
  children: string;
};

type OverflowItemsProps = DivRootProps & {
  mode: "items";
  lines?: never;
  tooltip?: never;
  gap?: string;
  indicator?: OverflowIndicatorRender;
  children: ReactNode;
};

export type OverflowProps = OverflowTextProps | OverflowItemsProps;

export function Overflow({ mode, children, ...rest }: OverflowProps) {
  if (mode === "items") {
    return <OverflowItems {...rest}>{children}</OverflowItems>;
  }

  return <OverflowText {...rest}>{children}</OverflowText>;
}
