import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../../lib/utils";

const alertVariants = cva(
  "relative border font-mono p-4 pl-12",
  {
    variants: {
      variant: {
        info: "border-tui-blue bg-tui-blue/10",
        warning: "border-tui-yellow bg-tui-yellow/10",
        error: "border-tui-red bg-tui-red/10",
        success: "border-tui-green bg-tui-green/10",
      },
    },
    defaultVariants: {
      variant: "info",
    },
  },
);

const iconVariants = cva(
  "absolute left-4 top-4 w-5 h-5 flex items-center justify-center text-sm font-bold",
  {
    variants: {
      variant: {
        info: "text-tui-blue",
        warning: "text-tui-yellow",
        error: "text-tui-red",
        success: "text-tui-green",
      },
    },
    defaultVariants: {
      variant: "info",
    },
  },
);

const icons: Record<NonNullable<VariantProps<typeof alertVariants>["variant"]>, string> = {
  info: "i",
  warning: "!",
  error: "\u2715",
  success: "\u2713",
};

export interface AlertProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof alertVariants> {
  title?: string;
}

export function Alert({
  className,
  variant = "info",
  title,
  children,
  ...props
}: AlertProps) {
  return (
    <div className={cn(alertVariants({ variant }), className)} {...props}>
      <span className={iconVariants({ variant })}>{icons[variant!]}</span>
      {title && (
        <div className="font-bold text-tui-fg mb-1">{title}</div>
      )}
      <div className="text-tui-fg text-sm">{children}</div>
    </div>
  );
}
