import { useState, type ReactNode, type HTMLAttributes } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../lib/cn";

export const calloutVariants = cva(
  "relative border font-mono p-4 flex gap-4 items-start",
  {
    variants: {
      variant: {
        info: "border-info-border/40 bg-info-subtle",
        warning: "border-warning-border/40 bg-warning-subtle",
        error: "border-error-border/40 bg-error-subtle",
        success: "border-success-border/40 bg-success-subtle",
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
        info: "bg-info-strong text-info-strong-foreground shadow-info-strong/20",
        warning: "bg-warning-strong text-warning-strong-foreground shadow-warning-strong/20",
        error: "bg-error-strong text-error-strong-foreground shadow-error-strong/20",
        success: "bg-success-strong text-success-strong-foreground shadow-success-strong/20",
      },
    },
    defaultVariants: { variant: "info" },
  }
);

const textVariants = cva("text-sm", {
  variants: {
    variant: {
      info: "text-info-fg",
      warning: "text-warning-fg",
      error: "text-error-fg",
      success: "text-success-fg",
    },
  },
  defaultVariants: { variant: "info" },
});

const titleVariants = cva("font-bold", {
  variants: {
    variant: {
      info: "text-info-fg",
      warning: "text-warning-fg",
      error: "text-error-fg",
      success: "text-success-fg",
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
