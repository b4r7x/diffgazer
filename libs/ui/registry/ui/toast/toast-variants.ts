import { cva } from "class-variance-authority";
import type { ToastPosition } from "./toast-store";

/**
 * Shared visual contract for toast layouts.
 *
 * `tone` is severity (success/error/warning/info/loading) and drives accent
 * color. `variant` is the layout shell (hud / card / viewfinder / countdown);
 * each variant owns its full internal structure. The shell CVA only handles
 * the outer box (sizing, background, border, position context).
 */
export type ToastTone = "success" | "error" | "warning" | "info" | "loading";
export type ToastVariant = "hud" | "card" | "viewfinder" | "countdown";

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

export const toastToneText = cva("", {
  variants: {
    tone: {
      success: "text-success-fg",
      error: "text-error-fg",
      warning: "text-warning-fg",
      info: "text-info-fg",
      loading: "text-info-fg",
    },
  },
  defaultVariants: { tone: "info" },
});

export const toastToneBg = cva("", {
  variants: {
    tone: {
      success: "bg-success-fg",
      error: "bg-error-fg",
      warning: "bg-warning-fg",
      info: "bg-info-fg",
      loading: "bg-info-fg",
    },
  },
  defaultVariants: { tone: "info" },
});

/**
 * Border-color classes for viewfinder corner brackets. CVA cannot generate
 * these because Tailwind needs literal class names for JIT scanning of the
 * `border-{token}-fg` palette.
 */
export const toastToneBorderColor: Record<ToastTone, string> = {
  success: "border-success-fg",
  error: "border-error-fg",
  warning: "border-warning-fg",
  info: "border-info-fg",
  loading: "border-info-fg",
};

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

export const icons: Record<Exclude<ToastTone, "loading">, string> = {
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

/**
 * Under prefers-reduced-motion the slide tokens collapse to `animation: none`
 * (theme-base.css). To still drive `onAnimationEnd` for dismissal and give a
 * minimal opacity cue, we reference the `fade-in`/`fade-out` keyframes by
 * name — those keyframe definitions are not gated by the reduced-motion media
 * query, only the `--animate-fade-*` tokens are. Opacity fade has no motion
 * vector, satisfying WCAG 2.3.3 while keeping the dismiss lifecycle intact.
 */
export const reducedMotionFade = {
  in: "motion-reduce:animate-[fade-in_0.15s_ease-out]",
  out: "motion-reduce:animate-[fade-out_0.15s_ease-in_forwards]",
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
