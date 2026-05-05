import { cva, type VariantProps } from "class-variance-authority";
import type { ToastPosition } from "./toast-store";

export const toastVariants = cva("w-full border border-border bg-background shadow-2xl", {
  variants: {
    variant: {
      success: "border-success-border",
      error: "border-error-border",
      warning: "border-warning-border",
      info: "border-info-border",
      loading: "border-info-border",
    },
  },
  defaultVariants: {
    variant: "info",
  },
});

/** @see @diffgazer/core/schemas/ui ToastVariant (subset without "loading", used for app-level toast state) */
export type ToastVariant = NonNullable<VariantProps<typeof toastVariants>["variant"]>;

export const iconColors: Record<ToastVariant, string> = {
  success: "text-success-fg",
  error: "text-error-fg",
  warning: "text-warning-fg",
  info: "text-info-fg",
  loading: "text-info-fg",
};

export const icons: Record<Exclude<ToastVariant, "loading">, string> = {
  success: "✓",
  error: "✕",
  warning: "!",
  info: "i",
};

export const slideAnimations = {
  left:   { in: "motion-safe:animate-slide-in-left",   out: "motion-safe:animate-slide-out-left"   },
  right:  { in: "motion-safe:animate-slide-in-right",  out: "motion-safe:animate-slide-out-right"  },
  top:    { in: "motion-safe:animate-slide-in-top",    out: "motion-safe:animate-slide-out-top"    },
  bottom: { in: "motion-safe:animate-slide-in-bottom", out: "motion-safe:animate-slide-out-bottom" },
} as const;

export const positionToSide: Record<ToastPosition, keyof typeof slideAnimations> = {
  "top-left": "left",    "top-center": "top",      "top-right": "right",
  "bottom-left": "left", "bottom-center": "bottom", "bottom-right": "right",
};

export const positionClasses: Record<ToastPosition, string> = {
  "top-left": "top-4 left-4 right-4 sm:right-auto sm:left-8 sm:w-80",
  "top-center": "top-4 left-4 right-4 sm:inset-x-0 sm:mx-auto sm:w-80",
  "top-right": "top-4 left-4 right-4 sm:left-auto sm:right-8 sm:w-80",
  "bottom-left": "bottom-4 left-4 right-4 sm:right-auto sm:left-8 sm:w-80",
  "bottom-center": "bottom-4 left-4 right-4 sm:inset-x-0 sm:mx-auto sm:w-80",
  "bottom-right": "bottom-4 left-4 right-4 sm:left-auto sm:right-8 sm:w-80",
};
