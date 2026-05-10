import type { InputHTMLAttributes, ReactNode, Ref } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { inputGroupErrorClass, inputSizeClasses } from "@/lib/input-variants";
import { cn } from "@/lib/utils";
import { resolveInputInvalidState } from "./input-state";

const inputGroupVariants = cva(
  "flex w-full items-center gap-2 bg-background border border-border text-foreground font-mono placeholder:text-foreground/50 transition-colors focus-within:border-foreground focus-within:ring-1 focus-within:ring-foreground",
  {
    variants: {
      size: inputSizeClasses,
      error: {
        true: inputGroupErrorClass,
      },
    },
    defaultVariants: {
      size: "md",
    },
  },
);

type InputGroupVariantProps = VariantProps<typeof inputGroupVariants>;

function isPlainDecorativeAffix(value: ReactNode) {
  return typeof value === "string" || typeof value === "number";
}

export interface InputGroupProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, "size" | "prefix"> {
  ref?: Ref<HTMLInputElement>;
  size?: InputGroupVariantProps["size"];
  error?: boolean;
  invalid?: boolean;
  prefix?: ReactNode;
  suffix?: ReactNode;
  inputClassName?: string;
}

export function InputGroup({
  className,
  inputClassName,
  size,
  error,
  invalid,
  prefix,
  suffix,
  disabled,
  ref,
  "aria-invalid": ariaInvalid,
  ...props
}: InputGroupProps) {
  const invalidState = resolveInputInvalidState(invalid, error, ariaInvalid);
  const hidePrefix = isPlainDecorativeAffix(prefix);
  const hideSuffix = isPlainDecorativeAffix(suffix);

  return (
    <div
      data-slot="input-group"
      className={cn(
        inputGroupVariants({ size, error: invalidState.isInvalid }),
        disabled && "cursor-not-allowed opacity-50",
        className,
      )}
    >
      {prefix !== undefined && prefix !== null && (
        <span
          data-slot="input-group-prefix"
          aria-hidden={hidePrefix ? "true" : undefined}
          className="shrink-0 text-muted-foreground"
        >
          {prefix}
        </span>
      )}
      <input
        ref={ref}
        disabled={disabled}
        aria-invalid={invalidState.ariaInvalid}
        className={cn(
          "min-w-0 flex-1 border-0 bg-transparent p-0 font-mono text-foreground placeholder:text-foreground/50 focus:outline-none disabled:cursor-not-allowed",
          inputClassName,
        )}
        {...props}
      />
      {suffix !== undefined && suffix !== null && (
        <span
          data-slot="input-group-suffix"
          aria-hidden={hideSuffix ? "true" : undefined}
          className="shrink-0 text-muted-foreground"
        >
          {suffix}
        </span>
      )}
    </div>
  );
}
