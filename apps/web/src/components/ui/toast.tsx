import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../../lib/utils";
import type { Toast as ToastType } from "../layout/toast-context";

const toastVariants = cva(
  "w-full border border-tui-border bg-tui-bg shadow-2xl",
  {
    variants: {
      variant: {
        success: "border-tui-green",
        error: "border-tui-red",
        warning: "border-tui-yellow",
        info: "border-tui-blue",
      },
    },
    defaultVariants: {
      variant: "info",
    },
  }
);

const iconVariants = cva(
  "font-bold",
  {
    variants: {
      variant: {
        success: "text-tui-green",
        error: "text-tui-red",
        warning: "text-tui-yellow",
        info: "text-tui-blue",
      },
    },
    defaultVariants: {
      variant: "info",
    },
  }
);

const icons: Record<NonNullable<VariantProps<typeof toastVariants>["variant"]>, string> = {
  success: "\u2713",
  error: "\u2715",
  warning: "!",
  info: "i",
};

const titles: Record<NonNullable<VariantProps<typeof toastVariants>["variant"]>, string> = {
  success: "Saved",
  error: "Error",
  warning: "Warning",
  info: "Info",
};

interface ToastProps extends ToastType {
  onDismiss: (id: string) => void;
  onRemove: (id: string) => void;
  dismissing?: boolean;
}

export function Toast({ id, variant = "info", title, message, onDismiss, onRemove, dismissing }: ToastProps) {
  const displayTitle = title || titles[variant];

  return (
    <div
      role={variant === "error" ? "alert" : "status"}
      aria-live={variant === "error" ? "assertive" : "polite"}
      aria-atomic="true"
      className={cn(
        toastVariants({ variant }),
        dismissing
          ? "motion-safe:animate-slide-out-right"
          : "motion-safe:animate-slide-in-right"
      )}
      onAnimationEnd={() => {
        if (dismissing) onRemove(id);
      }}
    >
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-tui-border bg-tui-selection/40">
        <div className="flex items-center gap-2">
          <span className={cn(iconVariants({ variant }))} aria-hidden="true">
            {icons[variant]}
          </span>
          <span className="sr-only">{titles[variant]}:</span>
          <span className="text-xs font-bold uppercase tracking-tight text-tui-fg">
            {displayTitle}
          </span>
        </div>
        <button
          onClick={() => onDismiss(id)}
          className="text-[10px] text-gray-500 hover:text-tui-fg"
          aria-label="Dismiss notification"
        >
          ✕
        </button>
      </div>
      {message && (
        <div className="p-3 text-sm">
          <span className="text-tui-fg/90">{message}</span>
        </div>
      )}
    </div>
  );
}
