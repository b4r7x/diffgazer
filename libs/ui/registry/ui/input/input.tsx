import type { InputHTMLAttributes, Ref } from "react";
import { cn } from "@/lib/utils";
import { inputVariants } from "@/lib/input-variants";

export interface InputProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, "size"> {
  ref?: Ref<HTMLInputElement>;
  size?: "sm" | "md" | "lg";
  error?: boolean;
  invalid?: boolean;
}

export function Input({ className, size, error, invalid, ref, "aria-invalid": ariaInvalid, ...props }: InputProps) {
  const isInvalid = invalid ?? error ?? ariaInvalid;
  return (
    <input
      className={cn(inputVariants({ size, error: !!isInvalid }), className)}
      ref={ref}
      {...props}
      aria-invalid={isInvalid || undefined}
    />
  );
}
