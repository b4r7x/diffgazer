import { cva } from "class-variance-authority";

/** Allowed toast position values. */
export type ToastPosition =
  | "top-left"
  | "top-center"
  | "top-right"
  | "bottom-left"
  | "bottom-center"
  | "bottom-right";

/** Allowed toast tone values. */
export type ToastTone = "success" | "error" | "warning" | "info" | "loading";
/** Allowed toast variant values. */
export type ToastVariant = "hud" | "card" | "viewfinder" | "countdown";

/** Individual toast notification with position-aware animation. */
export const toastToneBorder = cva("", {
  variants: {
    tone: {
      success: "border-success-border",
      error: "border-error-border",
      warning: "border-warning-border",
      info: "border-info-border",
      loading: "border-info-border",
    },
  },
  defaultVariants: { tone: "info" },
});

/** Individual toast notification with position-aware animation. */
export const toastToneText = cva("", {
  variants: {
    tone: {
      success: "text-success-text",
      error: "text-error-text",
      warning: "text-warning-text",
      info: "text-info-text",
      loading: "text-info-text",
    },
  },
  defaultVariants: { tone: "info" },
});

/** Individual toast notification with position-aware animation. */
export const toastToneBg = cva("", {
  variants: {
    tone: {
      success: "bg-success-text",
      error: "bg-error-text",
      warning: "bg-warning-text",
      info: "bg-info-text",
      loading: "bg-info-text",
    },
  },
  defaultVariants: { tone: "info" },
});

/** Individual toast notification with position-aware animation. */
export const toastToneCornerBorder = cva("", {
  variants: {
    tone: {
      success: "border-success-text",
      error: "border-error-text",
      warning: "border-warning-text",
      info: "border-info-text",
      loading: "border-info-text",
    },
  },
  defaultVariants: { tone: "info" },
});

/** Class variants for toast shell. */
export const toastShellVariants = cva("font-mono", {
  variants: {
    variant: {
      hud: "inline-flex items-center gap-2.5 max-w-[360px] px-3.5 py-2 text-xs bg-[color:var(--surface-1)] border",
      card: "flex bg-[color:var(--surface-1)] border border-border/40",
      viewfinder: "relative px-4 py-3 bg-background border border-border/40",
      countdown: "relative flex flex-col bg-[color:var(--surface-1)] border",
    },
  },
  defaultVariants: { variant: "card" },
});

/** Individual toast notification with position-aware animation. */
export const icons: Record<Exclude<ToastTone, "loading">, string> = {
  success: "✓",
  error: "✕",
  warning: "!",
  info: "i",
};

/** Individual toast notification with position-aware animation. */
export type ToastSide = "left" | "right" | "top" | "bottom";

/** Class variants for toast slide in. */
export const toastSlideInVariants = cva("motion-reduce:animate-[fade-in_0.15s_ease-out]", {
  variants: {
    side: {
      left: "motion-safe:animate-slide-in-left",
      right: "motion-safe:animate-slide-in-right",
      top: "motion-safe:animate-slide-in-top",
      bottom: "motion-safe:animate-slide-in-bottom",
    },
  },
  defaultVariants: { side: "right" },
});

/** Class variants for toast slide out. */
export const toastSlideOutVariants = cva(
  "motion-reduce:animate-[fade-out_0.15s_ease-in_forwards]",
  {
    variants: {
      side: {
        left: "motion-safe:animate-slide-out-left",
        right: "motion-safe:animate-slide-out-right",
        top: "motion-safe:animate-slide-out-top",
        bottom: "motion-safe:animate-slide-out-bottom",
      },
    },
    defaultVariants: { side: "right" },
  },
);

/** Individual toast notification with position-aware animation. */
export const positionToSide: Record<ToastPosition, ToastSide> = {
  "top-left": "left",
  "top-center": "top",
  "top-right": "right",
  "bottom-left": "left",
  "bottom-center": "bottom",
  "bottom-right": "right",
};

/** Class variants for toast position. */
export const toastPositionVariants = cva("", {
  variants: {
    position: {
      "top-left": "flex-col top-4 left-4 right-4 sm:right-auto sm:left-8 sm:w-80",
      "top-center": "flex-col top-4 left-4 right-4 sm:inset-x-0 sm:mx-auto sm:w-80",
      "top-right": "flex-col top-4 left-4 right-4 sm:left-auto sm:right-8 sm:w-80",
      "bottom-left": "flex-col-reverse bottom-4 left-4 right-4 sm:right-auto sm:left-8 sm:w-80",
      "bottom-center": "flex-col-reverse bottom-4 left-4 right-4 sm:inset-x-0 sm:mx-auto sm:w-80",
      "bottom-right": "flex-col-reverse bottom-4 left-4 right-4 sm:left-auto sm:right-8 sm:w-80",
    },
  },
  defaultVariants: { position: "bottom-right" },
});
