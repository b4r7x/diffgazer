"use client";

import { cva, type VariantProps } from "class-variance-authority";
import type { Ref, TextareaHTMLAttributes } from "react";
import { inputVariants } from "@/lib/input-variants";
import { cn } from "@/lib/utils";

// Height is the textarea's own axis: the shared input sizes only set padding and
// font size, so min-height steps in even 16px increments per size. Giving
// ::-webkit-resizer a background replaces the native grip glyph — the one piece
// of chrome the library does not draw itself — while drag-to-resize and the
// resize cursor stay intact.
const textareaVariants = cva("h-auto resize-y [&::-webkit-resizer]:bg-background", {
  variants: {
    size: {
      sm: "min-h-16",
      md: "min-h-20",
      lg: "min-h-24",
    },
  },
  defaultVariants: { size: "md" },
});

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
      className={cn(inputVariants({ size }), textareaVariants({ size }), className)}
      ref={ref}
      {...props}
    />
  );
}
