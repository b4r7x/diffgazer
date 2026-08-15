"use client";

import type { ComponentPropsWithRef, ReactNode } from "react";
import { type OverflowIndicatorRender, OverflowItems } from "./overflow-items";
import { OverflowText } from "./overflow-text";

/** Props for div root. */
type DivRootProps = Omit<ComponentPropsWithRef<"div">, "children" | "className"> & {
  /** Additional class names merged onto the overflow root. */
  className?: string;
};

/** Props for overflow text. */
type OverflowTextProps = DivRootProps & {
  /** Selects text mode; this is the default. */
  mode?: "text";
  /** Text mode only. 1 truncates; 2+ uses CSS line-clamp. */
  lines?: number;
  /** Text mode only. Controls the tooltip shown when content is clipped. */
  tooltip?: ReactNode | boolean;
  /** Items mode only; unavailable in text mode. */
  indicator?: never;
  /** String to clamp in text mode. */
  children: string;
};

/** Props for overflow items. */
type OverflowItemsProps = DivRootProps & {
  /** Selects fitting-items mode. */
  mode: "items";
  /** Text mode only; unavailable in items mode. */
  lines?: never;
  /** Text mode only; unavailable in items mode. */
  tooltip?: never;
  /** Custom indicator shown for items that do not fit. */
  indicator?: OverflowIndicatorRender;
  /** Localizes the accessible overflow indicator label. */
  getOverflowLabel?: (count: number) => string;
  /** Items to fit into the available width. */
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
