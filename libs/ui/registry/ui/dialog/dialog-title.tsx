"use client";

import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";
import { useDialogContext } from "./dialog-context";

export interface DialogTitleProps extends HTMLAttributes<HTMLHeadingElement> {
  as?: "h1" | "h2" | "h3" | "h4" | "h5" | "h6";
  decorated?: boolean;
}

const DASHES = "─".repeat(80);

export function DialogTitle({ children, className, as: Tag = "h2", decorated = true, ...props }: DialogTitleProps) {
  const { titleId } = useDialogContext();

  if (!decorated) {
    return (
      <Tag {...props} id={titleId} className={cn("font-bold text-sm", className)}>
        {children}
      </Tag>
    );
  }

  return (
    <Tag
      {...props}
      id={titleId}
      className={cn("text-foreground select-none leading-none pt-1 px-1 w-full flex items-baseline", className)}
    >
      <span className="shrink-0" aria-hidden="true">┌─ </span>
      <span className="text-warning font-bold shrink-0 px-3" aria-hidden="true">✦ </span>
      <span className="text-warning font-bold shrink-0">{children}</span>
      <span className="text-warning font-bold shrink-0 px-3" aria-hidden="true"> ✦</span>
      <span className="text-border flex-1 overflow-hidden shrink" aria-hidden="true"> {DASHES}</span>
      <span className="shrink-0" aria-hidden="true">┐</span>
    </Tag>
  );
}
