import type { InputHTMLAttributes, Ref } from "react";
import type { VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";
import { inputVariants } from "@/lib/input-variants";
import { resolveInputInvalidState } from "./input-state";

type InputVariantProps = VariantProps<typeof inputVariants>;

export interface InputProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, "size"> {
  ref?: Ref<HTMLInputElement>;
  size?: InputVariantProps["size"];
  error?: boolean;
  invalid?: boolean;
}

export function Input({ className, size, error, invalid, ref, "aria-invalid": ariaInvalid, ...props }: InputProps) {
  const invalidState = resolveInputInvalidState(invalid, error, ariaInvalid);
  return (
    <input
      className={cn(inputVariants({ size, error: invalidState.isInvalid }), className)}
      ref={ref}
      {...props}
      aria-invalid={invalidState.ariaInvalid}
    />
  );
}
