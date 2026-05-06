"use client";

import type { TextareaHTMLAttributes, Ref } from "react";
import { cn } from "@/lib/utils";
import { inputVariants } from "@/lib/input-variants";

export interface TextareaProps
  extends Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "size"> {
  ref?: Ref<HTMLTextAreaElement>;
  size?: "sm" | "md" | "lg";
  error?: boolean;
  invalid?: boolean;
}

export function Textarea({
  className,
  size,
  error,
  invalid,
  ref,
  "aria-invalid": ariaInvalid,
  ...props
}: TextareaProps) {
  const isInvalid = invalid ?? error ?? ariaInvalid;
  return (
    <textarea
      className={cn(
        inputVariants({ size, error: !!isInvalid }),
        "h-auto min-h-20 resize-y",
        className
      )}
      ref={ref}
      {...props}
      aria-invalid={isInvalid || undefined}
    />
  );
}
