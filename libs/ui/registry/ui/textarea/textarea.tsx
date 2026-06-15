"use client";

import type { VariantProps } from "class-variance-authority";
import type { Ref, TextareaHTMLAttributes } from "react";
import { inputVariants } from "@/lib/input-variants";
import { cn } from "@/lib/utils";

/** Props for textarea. */
export interface TextareaProps
  extends Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "size">,
    VariantProps<typeof inputVariants> {
  /** Ref forwarded to the underlying element. */
  ref?: Ref<HTMLTextAreaElement>;
}

/**
 * Terminal-styled multi-line text area with size variants and invalid state. Shares base
 * styling with Input via input-variants.
 */
export function Textarea({ className, size, ref, ...props }: TextareaProps) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(inputVariants({ size }), "h-auto min-h-20 resize-y", className)}
      ref={ref}
      {...props}
    />
  );
}
