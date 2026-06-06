import type { VariantProps } from "class-variance-authority";
import type { InputHTMLAttributes, Ref } from "react";
import { inputSizeClasses, inputVariants } from "@/lib/input-variants";
import { cn } from "@/lib/utils";

export { inputSizeClasses, inputVariants };

export type InputVariantProps = VariantProps<typeof inputVariants>;

export interface InputProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, "size"> {
  ref?: Ref<HTMLInputElement>;
  size?: InputVariantProps["size"];
}

export function Input({ className, size, ref, ...props }: InputProps) {
  return (
    <input
      className={cn(inputVariants({ size }), className)}
      ref={ref}
      {...props}
    />
  );
}
