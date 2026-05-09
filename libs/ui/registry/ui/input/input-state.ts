import type { InputHTMLAttributes } from "react";

export function resolveInputInvalidState(
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
