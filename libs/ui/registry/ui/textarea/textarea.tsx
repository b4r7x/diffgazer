"use client";

import type { TextareaHTMLAttributes, Ref } from "react";
import { cn } from "@/lib/utils";
import { inputVariants } from "@/lib/input-variants";

export interface TextareaProps
  extends Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "size"> {
  ref?: Ref<HTMLTextAreaElement>;
  size?: "sm" | "md" | "lg";
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
