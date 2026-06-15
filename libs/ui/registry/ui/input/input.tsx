import type { VariantProps } from "class-variance-authority";
import type { InputHTMLAttributes, Ref } from "react";
import { inputSizeClasses, inputVariants } from "@/lib/input-variants";
import { cn } from "@/lib/utils";

export { inputSizeClasses, inputVariants };

/** Props for input variant. */
export type InputVariantProps = VariantProps<typeof inputVariants>;

/** Props for input. */
export interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "size"> {
  /** Ref forwarded to the underlying element. */
  ref?: Ref<HTMLInputElement>;
  /** Height/padding/font size token. */
  size?: InputVariantProps["size"];
}

/**
 * Terminal-styled text input primitives with size variants, invalid state, and optional
 * prefix/suffix grouping.
 */
export function Input({ className, size, ref, ...props }: InputProps) {
  return <input className={cn(inputVariants({ size }), className)} ref={ref} {...props} />;
}
