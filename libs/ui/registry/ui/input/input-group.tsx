import { cva, type VariantProps } from "class-variance-authority";
import {
  type InputHTMLAttributes,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
  type Ref,
  useRef,
} from "react";
import { useComposedRefs } from "@/hooks/use-composed-refs";
import { inputSizeClasses } from "@/lib/input-variants";
import { cn } from "@/lib/utils";

const INTERACTIVE_AFFIX_SELECTOR = "button, a, input, select, textarea, label, [tabindex]";

/** Class variants for input group. */
export const inputGroupVariants = cva(
  "flex w-full items-center gap-2 bg-background border border-border text-foreground font-mono placeholder:text-foreground/55 transition-colors focus-within:border-foreground focus-within:ring-1 focus-within:ring-foreground has-[input[aria-invalid=true]]:border-2 has-[input[aria-invalid=true]]:border-error has-[input[aria-invalid=true]]:focus-within:border-error has-[input[aria-invalid=true]]:focus-within:ring-error",
  {
    variants: {
      size: inputSizeClasses,
    },
    defaultVariants: {
      size: "md",
    },
  },
);

/** Props for input group variant. */
export type InputGroupVariantProps = VariantProps<typeof inputGroupVariants>;

function isPlainDecorativeAffix(value: ReactNode) {
  return typeof value === "string" || typeof value === "number";
}

/** Props for input group. */
export interface InputGroupProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, "size" | "prefix"> {
  /** Ref forwarded to the underlying element. */
  ref?: Ref<HTMLInputElement>;
  /** Height/padding/font size token applied to the wrapper and the inner input. */
  size?: InputGroupVariantProps["size"];
  /**
   * Decorative content rendered before the input. Plain text is aria-hidden; interactive
   * affixes must provide their own accessible labels.
   */
  prefix?: ReactNode;
  /**
   * Decorative content rendered after the input. Plain text is aria-hidden; interactive affixes
   * must provide their own accessible labels.
   */
  suffix?: ReactNode;
  /** Hide the prefix from assistive tech. Defaults to true for plain text/number affixes. */
  prefixAriaHidden?: boolean;
  /** Hide the suffix from assistive tech. Defaults to true for plain text/number affixes. */
  suffixAriaHidden?: boolean;
  /** className applied to the inner input element. The outer className targets the wrapper. */
  inputClassName?: string;
}

/**
 * Terminal-styled text input primitives with size variants, invalid state, and optional
 * prefix/suffix grouping.
 */
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
  const inputRef = useRef<HTMLInputElement>(null);
  const composedRef = useComposedRefs(inputRef, ref);

  const handleContainerMouseDown = (event: ReactMouseEvent<HTMLDivElement>) => {
    if (disabled) return;
    const input = inputRef.current;
    if (!input) return;
    // Clicking dead zones (prefix/suffix decoration, gap, padding) focuses the
    // input; clicks landing on the input itself or an interactive affix child
    // keep their own behavior.
    const target = event.target as HTMLElement;
    if (target === input || target.closest(INTERACTIVE_AFFIX_SELECTOR)) return;
    event.preventDefault();
    input.focus();
  };

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: the shell only forwards dead-zone clicks to the inner input, which owns all keyboard/focus semantics.
    <div
      data-slot="input-group"
      onMouseDown={handleContainerMouseDown}
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
        ref={composedRef}
        disabled={disabled}
        className={cn(
          "min-w-0 flex-1 border-0 bg-transparent p-0 font-mono text-foreground placeholder:text-foreground/55 focus:outline-none disabled:cursor-not-allowed",
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
