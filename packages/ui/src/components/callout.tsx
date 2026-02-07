import { useState, type ReactNode, type HTMLAttributes } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../lib/cn";

export const calloutVariants = cva(
  "relative border border-tui-border bg-black/30 font-mono p-4 flex gap-4 items-start",
  {
    variants: {
      variant: {
        info: "",
        warning: "",
        error: "",
        success: "",
      },
    },
    defaultVariants: { variant: "info" },
  }
);

const iconVariants = cva(
  "w-5 h-5 flex items-center justify-center text-xs font-bold rounded-sm shrink-0 mt-0.5 shadow-lg text-black",
  {
    variants: {
      variant: {
        info: "bg-tui-blue shadow-tui-blue/20",
        warning: "bg-tui-yellow shadow-tui-yellow/20",
        error: "bg-tui-red shadow-tui-red/20",
        success: "bg-tui-green shadow-tui-green/20",
      },
    },
    defaultVariants: { variant: "info" },
  }
);

const textVariants = cva("text-sm text-tui-muted", {
  variants: {
    variant: {
      info: "",
      warning: "",
      error: "",
      success: "",
    },
  },
  defaultVariants: { variant: "info" },
});

const titleVariants = cva("font-bold", {
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

type CalloutVariant = NonNullable<VariantProps<typeof calloutVariants>["variant"]>;

const defaultIcons: Record<CalloutVariant, string> = {
  info: "i",
  warning: "!",
  error: "\u2715",
  success: "\u2713",
};

export interface CalloutProps
  extends HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof calloutVariants> {
  title?: string;
  icon?: ReactNode;
  onDismiss?: () => void;
}

export function Callout({
  className,
  variant = "info",
  title,
  icon,
  onDismiss,
  children,
  role = "status",
  ...props
}: CalloutProps) {
  const [dismissed, setDismissed] = useState(false);
  if (dismissed) return null;

  const v = variant ?? "info";

  const handleDismiss = () => {
    setDismissed(true);
    onDismiss?.();
  };

  return (
    <div
      role={role}
      className={cn(calloutVariants({ variant: v }), className)}
      {...props}
    >
      <div className={iconVariants({ variant: v })}>
        {icon ?? defaultIcons[v]}
      </div>
      <div className={cn(textVariants({ variant: v }), "flex-1 min-w-0")}>
        {title && <span className={cn(titleVariants({ variant: v }), "block mb-1")}>{title}</span>}
        <span className="opacity-90 leading-relaxed">{children}</span>
      </div>
      {onDismiss && (
        <button
          type="button"
          onClick={handleDismiss}
          className="shrink-0 font-mono text-sm opacity-60 hover:opacity-100 transition-opacity cursor-pointer"
          aria-label="Dismiss"
        >
          [x]
        </button>
      )}
    </div>
  );
}
