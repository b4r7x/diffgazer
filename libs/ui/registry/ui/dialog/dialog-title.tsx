"use client";

import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";
import { useDialogContext } from "./dialog-context";

export interface DialogTitleProps extends HTMLAttributes<HTMLHeadingElement> {
  as?: "h1" | "h2" | "h3" | "h4" | "h5" | "h6";
  meta?: string;
}

export function DialogTitle({
  children,
  className,
  as: Tag = "h2",
  meta,
  ...props
}: DialogTitleProps) {
  const { titleId } = useDialogContext();

  return (
    <Tag
      {...props}
      id={titleId}
      data-slot="dialog-title"
      className={cn("flex items-center gap-2.5 text-sm font-bold text-foreground", className)}
    >
      <span className="min-w-0 flex-1 truncate">{children}</span>
      {meta ? (
        <span
          aria-hidden="true"
          className="ml-auto shrink-0 text-[length:var(--dlg-title-meta-size)] font-normal uppercase tracking-[var(--dlg-title-meta-tracking)] text-muted"
        >
          {meta}
        </span>
      ) : null}
    </Tag>
  );
}
