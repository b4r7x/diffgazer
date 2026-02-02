import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../../lib/utils";

export const buttonVariants = cva(
  "inline-flex items-center justify-center font-mono whitespace-nowrap transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-tui-blue focus-visible:ring-offset-2 focus-visible:ring-offset-tui-bg disabled:pointer-events-none disabled:opacity-50 cursor-pointer",
  {
    variants: {
      variant: {
        primary:
          "bg-tui-blue text-black font-bold hover:bg-tui-blue/90",
        secondary:
          "border border-tui-border bg-transparent hover:bg-tui-selection",
        destructive:
          "text-tui-red border border-tui-red bg-transparent hover:bg-tui-red hover:text-black",
        success:
          "bg-tui-green text-black font-bold hover:bg-tui-green/90",
        ghost: "bg-transparent hover:bg-tui-selection",
        outline:
          "border border-tui-border bg-transparent text-tui-fg hover:bg-tui-border",
        tab: "bg-transparent text-tui-fg border-b-2 border-transparent hover:border-b-tui-blue data-[active=true]:border-b-tui-blue data-[active=true]:font-bold",
        toggle:
          "border border-tui-border bg-transparent text-tui-fg data-[active=true]:bg-tui-blue data-[active=true]:text-black data-[active=true]:border-tui-blue",
        link: "bg-transparent text-tui-blue underline-offset-2 hover:underline",
      },
      size: {
        sm: "h-7 px-3 text-xs",
        md: "h-9 px-4 py-2 text-sm",
        lg: "h-11 px-6 py-2 text-base",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "md",
    },
  },
);

export interface ButtonProps
  extends
    React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  bracket?: boolean;
}

export const Button = ({
  className,
  variant,
  size,
  bracket,
  children,
  ref,
  ...props
}: ButtonProps & { ref?: React.Ref<HTMLButtonElement> }) => {
  return (
    <button
      className={cn(buttonVariants({ variant, size, className }))}
      ref={ref}
      {...props}
    >
      {bracket ? `[ ${children} ]` : children}
    </button>
  );
};
