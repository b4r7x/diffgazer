import type { InputHTMLAttributes, ReactNode, Ref } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { inputSizeClasses } from "@/lib/input-variants";
import { cn } from "@/lib/utils";

export const inputGroupVariants = cva(
  "flex w-full items-center gap-2 bg-background border border-border text-foreground font-mono placeholder:text-foreground/50 transition-colors focus-within:border-foreground focus-within:ring-1 focus-within:ring-foreground has-[input[aria-invalid=true]]:border-2 has-[input[aria-invalid=true]]:border-destructive has-[input[aria-invalid=true]]:focus-within:border-destructive has-[input[aria-invalid=true]]:focus-within:ring-destructive",
  {
    variants: {
      size: inputSizeClasses,
    },
    defaultVariants: {
      size: "md",
    },
  },
);

export type InputGroupVariantProps = VariantProps<typeof inputGroupVariants>;

function isPlainDecorativeAffix(value: ReactNode) {
  return typeof value === "string" || typeof value === "number";
}

export interface InputGroupProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, "size" | "prefix"> {
  ref?: Ref<HTMLInputElement>;
  size?: InputGroupVariantProps["size"];
  prefix?: ReactNode;
  suffix?: ReactNode;
  /** Hide the prefix from assistive tech. Defaults to true for plain text/number affixes. */
  prefixAriaHidden?: boolean;
  /** Hide the suffix from assistive tech. Defaults to true for plain text/number affixes. */
  suffixAriaHidden?: boolean;
  inputClassName?: string;
}

export function InputGroup({
  className,
  inputClassName,
  size,
  prefix,
  suffix,
  prefixAriaHidden,
  suffixAriaHidden,
  disabled,
  ref,
  ...props
}: InputGroupProps) {
  const hidePrefix = prefixAriaHidden ?? isPlainDecorativeAffix(prefix);
  const hideSuffix = suffixAriaHidden ?? isPlainDecorativeAffix(suffix);

  return (
    <div
      data-slot="input-group"
      className={cn(
        inputGroupVariants({ size }),
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
