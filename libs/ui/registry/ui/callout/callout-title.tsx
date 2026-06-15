"use client";

import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Props for callout title. */
export interface CalloutTitleProps extends ComponentProps<"span"> {
  /** Title text for the callout. */
  children: ReactNode;
}

/** Bold title text in the tone color. */
export function CalloutTitle({ children, className, ...props }: CalloutTitleProps) {
  return (
    <span
      data-slot="callout-title"
      className={cn(
        "self-center font-bold text-[13px] leading-[1.4] text-[color:var(--callout-tone,var(--foreground))]",
        className,
      )}
      {...props}
    >
      {children}
    </span>
  );
}
