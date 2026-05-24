import type { InputHTMLAttributes, Ref } from "react";
import type { VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";
import { inputVariants } from "@/lib/input-variants";

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
