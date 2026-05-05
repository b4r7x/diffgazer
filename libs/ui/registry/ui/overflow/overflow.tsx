"use client";

import type { ReactNode } from "react";
import { OverflowText } from "./overflow-text";
import { OverflowItems, type OverflowIndicatorRender } from "./overflow-items";

type OverflowTextProps = {
  mode?: "text";
  lines?: number;
  tooltip?: ReactNode | boolean;
  gap?: never;
  indicator?: never;
  children: string;
  className?: string;
};

type OverflowItemsProps = {
  mode: "items";
  lines?: never;
  tooltip?: never;
  gap?: string;
  indicator?: OverflowIndicatorRender;
  children: ReactNode;
  className?: string;
};

export type OverflowProps = OverflowTextProps | OverflowItemsProps;

export function Overflow({ mode, children, ...rest }: OverflowProps) {
  if (mode === "items") {
    return <OverflowItems {...rest}>{children}</OverflowItems>;
  }

  return <OverflowText {...rest}>{children}</OverflowText>;
}
