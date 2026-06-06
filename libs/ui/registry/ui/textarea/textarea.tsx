"use client";

import type { VariantProps } from "class-variance-authority";
import type { Ref, TextareaHTMLAttributes } from "react";
import { inputVariants } from "@/lib/input-variants";
import { cn } from "@/lib/utils";

export interface TextareaProps
  extends Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "size">,
    VariantProps<typeof inputVariants> {
  ref?: Ref<HTMLTextAreaElement>;
}

export function Textarea({
  className,
  size,
  ref,
  ...props
}: TextareaProps) {
  return (
    <textarea
      className={cn(
        inputVariants({ size }),
        "h-auto min-h-20 resize-y",
        className
      )}
      ref={ref}
      {...props}
    />
  );
}
