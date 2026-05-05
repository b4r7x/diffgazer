"use client";

import type { ReactNode, HTMLAttributes } from "react";
import { cn } from "@/lib/utils";
import { useCalloutContext, textColorByVariant } from "./callout-context";

export interface CalloutContentProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
}

export function CalloutContent({ children, className, ...props }: CalloutContentProps) {
  const { variant } = useCalloutContext();

  return (
    <div
      className={cn("text-sm", textColorByVariant[variant], "col-start-2 row-start-2 opacity-90 leading-relaxed", className)}
      {...props}
    >
      {children}
    </div>
  );
}
