import type { InputHTMLAttributes, Ref } from "react";
import { cn } from "@/lib/utils";
import { inputVariants } from "@/lib/input-variants";

export interface InputProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, "size"> {
  ref?: Ref<HTMLInputElement>;
  size?: "sm" | "md" | "lg";
  error?: boolean;
}

export function Input({ className, size, error, ref, ...props }: InputProps) {
  return (
    <input
      className={cn(inputVariants({ size, error }), className)}
      ref={ref}
      aria-invalid={error || undefined}
      {...props}
    />
  );
}
