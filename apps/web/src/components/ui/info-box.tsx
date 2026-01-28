import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../../lib/utils";

const infoBoxVariants = cva(
  "relative border font-mono p-4 pl-12",
  {
    variants: {
      variant: {
        warning: "border-tui-yellow bg-tui-yellow/10",
        info: "border-tui-blue bg-tui-blue/10",
        error: "border-tui-red bg-tui-red/10",
      },
    },
    defaultVariants: {
      variant: "warning",
    },
  },
);

const iconVariants = cva(
  "absolute left-4 top-4 w-5 h-5 flex items-center justify-center text-sm font-bold",
  {
    variants: {
      variant: {
        warning: "text-tui-yellow",
        info: "text-tui-blue",
        error: "text-tui-red",
      },
    },
    defaultVariants: {
      variant: "warning",
    },
  },
);

export interface InfoBoxProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof infoBoxVariants> {
  title?: string;
}

export function InfoBox({
  className,
  variant = "warning",
  title,
  children,
  ...props
}: InfoBoxProps) {
  return (
    <div className={cn(infoBoxVariants({ variant }), className)} {...props}>
      <span className={iconVariants({ variant })}>!</span>
      {title && (
        <div className="font-bold text-tui-fg mb-1">{title}</div>
      )}
      <div className="text-tui-fg text-sm">{children}</div>
    </div>
  );
}
