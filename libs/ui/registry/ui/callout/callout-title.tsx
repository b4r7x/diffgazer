"use client";

import type { ReactNode, HTMLAttributes } from "react";
import { cn } from "@/lib/utils";
import { useCalloutContext, textColorByVariant } from "./callout-context";

export interface CalloutTitleProps extends HTMLAttributes<HTMLSpanElement> {
  children: ReactNode;
}

export function CalloutTitle({ children, className, ...props }: CalloutTitleProps) {
  const { variant } = useCalloutContext();

  return (
    <span
      className={cn("font-bold", textColorByVariant[variant], "col-start-2 row-start-1", className)}
      {...props}
    >
      {children}
    </span>
  );
}
