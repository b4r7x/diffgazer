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

function resolveInvalidState(
  invalid: boolean | undefined,
  error: boolean | undefined,
  ariaInvalid: TextareaHTMLAttributes<HTMLTextAreaElement>["aria-invalid"],
) {
  if (invalid || error) return { isInvalid: true, ariaInvalid: true };

  if (ariaInvalid === true || ariaInvalid === "true" || ariaInvalid === "grammar" || ariaInvalid === "spelling") {
    return { isInvalid: true, ariaInvalid };
  }

  if (ariaInvalid === false || ariaInvalid === "false") {
    return { isInvalid: false, ariaInvalid };
  }

  return { isInvalid: false, ariaInvalid: undefined };
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
  const invalidState = resolveInvalidState(invalid, error, ariaInvalid);
  return (
    <textarea
      className={cn(
        inputVariants({ size, error: invalidState.isInvalid }),
        "h-auto min-h-20 resize-y",
        className
      )}
      ref={ref}
      {...props}
      aria-invalid={invalidState.ariaInvalid}
    />
  );
}
