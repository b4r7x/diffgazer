import type { ButtonHTMLAttributes, Ref } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../lib/cn";

export const buttonVariants = cva(
  "inline-flex items-center justify-center font-mono whitespace-nowrap transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50 cursor-pointer",
  {
    variants: {
      variant: {
        primary: "bg-primary text-primary-foreground font-bold hover:bg-primary/90",
        secondary: "border border-border bg-transparent text-foreground hover:bg-secondary",
        error:
          "text-error-fg border border-error-border bg-transparent hover:bg-error-strong hover:text-error-strong-foreground",
        destructive:
          "text-error-fg border border-error-border bg-transparent hover:bg-error-strong hover:text-error-strong-foreground",
        success:
          "bg-success-strong text-success-strong-foreground font-bold hover:bg-success-strong/90",
        ghost: "bg-transparent text-foreground hover:bg-secondary",
        outline: "border border-border bg-transparent text-foreground hover:bg-border",
        tab: "bg-transparent text-foreground border-b-2 border-transparent hover:border-b-primary data-[active=true]:border-b-primary data-[active=true]:font-bold",
        toggle:
          "border border-border bg-transparent text-foreground data-[active=true]:bg-primary data-[active=true]:text-primary-foreground data-[active=true]:border-primary",
        link: "bg-transparent text-info-fg underline-offset-2 hover:underline",
      },
      size: {
        sm: "h-7 px-3 text-xs",
        md: "h-9 px-4 py-2 text-sm",
        lg: "h-11 px-6 py-2 text-base",
        icon: "h-9 w-9 p-0",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "md",
    },
  }
);

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  bracket?: boolean;
  loading?: boolean;
  ref?: Ref<HTMLButtonElement>;
}

export function Button({
  className,
  variant,
  size,
  bracket,
  loading = false,
  children,
  ref,
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(
        buttonVariants({ variant, size, className }),
        loading && "pointer-events-none"
      )}
      ref={ref}
      aria-busy={loading || undefined}
      disabled={props.disabled || loading}
      {...props}
    >
      {loading ? (
        bracket ? <>[ ... ]</> : "[...]"
      ) : bracket ? (
        <>[ {children} ]</>
      ) : (
        children
      )}
    </button>
  );
}
