"use client";

import { type ComponentProps, useId, useLayoutEffect } from "react";
import { cn } from "@/lib/utils";
import { useDialogContext } from "./dialog-context";

/** Props for dialog description. */
export interface DialogDescriptionProps extends ComponentProps<"p"> {}

/** Accessible description. */
export function DialogDescription({ className, ...props }: DialogDescriptionProps) {
  const { descriptionId, registerDescription, unregisterDescription } = useDialogContext();
  const registrationId = useId();

  useLayoutEffect(() => {
    registerDescription(registrationId);
    return () => unregisterDescription(registrationId);
  }, [registerDescription, unregisterDescription, registrationId]);

  return (
    <p
      {...props}
      data-slot="dialog-description"
      id={descriptionId}
      className={cn("text-xs text-foreground/70", className)}
    />
  );
}
