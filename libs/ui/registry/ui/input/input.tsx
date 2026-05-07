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

function resolveInvalidState(
  invalid: boolean | undefined,
  error: boolean | undefined,
  ariaInvalid: InputHTMLAttributes<HTMLInputElement>["aria-invalid"],
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

export function Input({ className, size, error, invalid, ref, "aria-invalid": ariaInvalid, ...props }: InputProps) {
  const invalidState = resolveInvalidState(invalid, error, ariaInvalid);
  return (
    <input
      className={cn(inputVariants({ size, error: invalidState.isInvalid }), className)}
      ref={ref}
      {...props}
      aria-invalid={invalidState.ariaInvalid}
    />
  );
}
