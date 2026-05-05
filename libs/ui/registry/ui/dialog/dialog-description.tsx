"use client";

import { useEffect, type HTMLAttributes } from "react";
import { cn } from "@/lib/utils";
import { useDialogContext } from "./dialog-context";

export interface DialogDescriptionProps extends HTMLAttributes<HTMLParagraphElement> {}

export function DialogDescription({ className, ...props }: DialogDescriptionProps) {
  const { descriptionId, onDescriptionMount, onDescriptionUnmount } = useDialogContext();

  useEffect(() => {
    onDescriptionMount();
    return onDescriptionUnmount;
  }, []);

  return (
    <p
      {...props}
      id={descriptionId}
      className={cn("text-xs text-foreground/70", className)}
    />
  );
}
