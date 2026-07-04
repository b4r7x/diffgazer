"use client";

import { type ComponentProps, useId, useLayoutEffect } from "react";
import { cn } from "@/lib/utils";
import { useDialogContext } from "./dialog-context";

/** Props for dialog title. */
export interface DialogTitleProps extends ComponentProps<"h2"> {
  /** Heading level for the title element. */
  as?: "h1" | "h2" | "h3" | "h4" | "h5" | "h6";
  /**
   * Optional right-aligned eyebrow tag (e.g. "CONFIRM", "DESTRUCTIVE"). Rendered as dialog
   * content but outside the heading, so it is excluded from the dialog's accessible name.
   */
  meta?: string;
}

/** Accessible title. */
export function DialogTitle({
  children,
  className,
  as: Tag = "h2",
  meta,
  ...props
}: DialogTitleProps) {
  const { titleId, registerTitle, unregisterTitle } = useDialogContext();
  const registrationId = useId();

  useLayoutEffect(() => {
    registerTitle(registrationId);
    return () => unregisterTitle(registrationId);
  }, [registerTitle, unregisterTitle, registrationId]);

  // The dialog's aria-labelledby points at the heading (titleId), so the
  // accessible name is the title text alone. The meta slot renders as a sibling
  // OUTSIDE the heading: visible to AT as page content but excluded from the
  // dialog's accessible name.
  if (!meta) {
    return (
      <Tag
        {...props}
        id={titleId}
        data-slot="dialog-title"
        className={cn("flex items-center gap-2.5 text-sm font-bold text-foreground", className)}
      >
        {children}
      </Tag>
    );
  }

  return (
    <div data-slot="dialog-title-row" className="flex items-center gap-2.5">
      <Tag
        {...props}
        id={titleId}
        data-slot="dialog-title"
        className={cn("min-w-0 flex-1 truncate text-sm font-bold text-foreground", className)}
      >
        {children}
      </Tag>
      <span className="ml-auto shrink-0 text-[length:var(--dialog-title-meta-size)] font-normal uppercase tracking-[var(--dialog-title-meta-tracking)] text-muted">
        {meta}
      </span>
    </div>
  );
}
