import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/utils/cn";

const calloutVariants = cva(
  "relative border font-mono p-4 flex gap-4 items-start",
  {
    variants: {
      variant: {
        info: "border-tui-blue/40 bg-tui-blue/5",
        warning: "border-tui-yellow/40 bg-tui-yellow/5",
        error: "border-tui-red/40 bg-tui-red/5",
        success: "border-tui-green/40 bg-tui-green/5",
      },
    },
    defaultVariants: { variant: "info" },
  }
);

const iconVariants = cva(
  "w-5 h-5 flex items-center justify-center text-xs font-bold rounded-sm shrink-0 mt-0.5 shadow-lg",
  {
    variants: {
      variant: {
        info: "bg-tui-blue text-black shadow-tui-blue/20",
        warning: "bg-tui-yellow text-black shadow-tui-yellow/20",
        error: "bg-tui-red text-black shadow-tui-red/20",
        success: "bg-tui-green text-black shadow-tui-green/20",
      },
    },
    defaultVariants: { variant: "info" },
  }
);

const textVariants = cva("text-sm", {
  variants: {
    variant: {
      info: "text-tui-blue",
      warning: "text-tui-yellow",
      error: "text-tui-red",
      success: "text-tui-green",
    },
  },
  defaultVariants: { variant: "info" },
});

const icons: Record<NonNullable<VariantProps<typeof calloutVariants>["variant"]>, string> = {
  info: "i",
  warning: "!",
  error: "✕",
  success: "✓",
};

export interface CalloutProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof calloutVariants> {
  title?: string;
}

export function Callout({
  className,
  variant = "info",
  title,
  children,
  ...props
}: CalloutProps) {
  return (
    <div className={cn(calloutVariants({ variant }), className)} {...props}>
      <div className={iconVariants({ variant })}>{icons[variant!]}</div>
      <div className={textVariants({ variant })}>
        {title && <span className="font-bold block mb-1">{title}</span>}
        <span className="opacity-90 leading-relaxed">{children}</span>
      </div>
    </div>
  );
}
