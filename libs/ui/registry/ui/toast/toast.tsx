"use client";

import { lazy, Suspense } from "react";
import { FOCUS_OUTLINE } from "@/lib/focus-outline";
import { cn } from "@/lib/utils";
import { CountdownBar } from "./countdown";
import type { ToastPosition, Toast as ToastType } from "./toast-store";
import {
  icons,
  positionToSide,
  type ToastTone,
  toastShellVariants,
  toastSlideInVariants,
  toastSlideOutVariants,
  toastToneBg,
  toastToneBorder,
  toastToneCornerBorder,
  toastToneText,
} from "./toast-variants";
import { useToastDismiss } from "./use-dismiss";

const LazySpinner = lazy(() => import("../spinner/spinner").then((m) => ({ default: m.Spinner })));

/** Props for toast. */
interface ToastProps extends ToastType {
  /** Placement position. */
  position: ToastPosition;
  onDismiss: (id: string) => void;
  onRemove: (id: string) => void;
  dismissing?: boolean;
}

// role="alert" implies aria-live="assertive"+aria-atomic="true"; role="status"
// implies aria-live="polite". Setting both is what WAI-ARIA recommends against,
// so we rely on the role to carry the live-region contract.
const TONE_ROLE: Record<ToastTone, "status" | "alert"> = {
  success: "status",
  error: "alert",
  warning: "status",
  info: "status",
  loading: "status",
};

/** Individual toast notification with position-aware animation. */
export function Toast(props: ToastProps) {
  const { id, tone, variant, dismissing, position, onRemove } = props;
  const { onAnimationEnd } = useToastDismiss(dismissing ?? false, id, onRemove);
  const side = positionToSide[position];
  const animation = dismissing ? toastSlideOutVariants({ side }) : toastSlideInVariants({ side });
  // HUD is informational by definition (single-line confirmation) — even an
  // error-tone HUD stays role="status" so it doesn't preempt screen-reader
  // output. Card/viewfinder/countdown use the tone mapping so error tones
  // still announce as alerts.
  const role = variant === "hud" ? "status" : TONE_ROLE[tone];
  const toneAccent = variant === "hud" || variant === "countdown" ? toastToneBorder({ tone }) : "";

  return (
    <div
      role={role}
      data-slot="toast"
      data-tone={tone}
      data-variant={variant}
      className={cn("pointer-events-auto", toastShellVariants({ variant }), toneAccent, animation)}
      onAnimationEnd={onAnimationEnd}
    >
      <ToastLayout {...props} />
    </div>
  );
}

function ToastLayout(props: ToastProps) {
  switch (props.variant) {
    case "hud":
      return <HudLayout {...props} />;
    case "viewfinder":
      return <ViewfinderLayout {...props} />;
    case "countdown":
      return <CountdownLayout {...props} />;
    default:
      return <CardLayout {...props} />;
  }
}

function ToneIcon({ tone }: { tone: ToastTone }) {
  if (tone === "loading") {
    return (
      <Suspense fallback={null}>
        <LazySpinner variant="braille" size="sm" gap="none" aria-hidden="true" />
      </Suspense>
    );
  }
  return icons[tone];
}

function CloseButton({
  id,
  title,
  dismissLabel,
  onDismiss,
}: {
  id: string;
  title: string;
  dismissLabel?: string;
  onDismiss: (id: string) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onDismiss(id)}
      className={cn(
        "min-h-6 min-w-6 p-1 pointer-coarse:min-h-11 pointer-coarse:min-w-11 flex items-center justify-center text-xs leading-none shrink-0",
        "rounded-[var(--radius)] cursor-pointer transition-colors",
        "text-muted-foreground hover:text-foreground hover:bg-foreground/5",
        FOCUS_OUTLINE,
      )}
      aria-label={dismissLabel ?? `Dismiss: ${title}`}
    >
      [x]
    </button>
  );
}

function HudLayout({ tone, toneLabel, title, message }: ToastProps) {
  return (
    <>
      <span
        className={cn("inline-flex w-3 justify-center font-bold", toastToneText({ tone }))}
        aria-hidden="true"
      >
        <ToneIcon tone={tone} />
      </span>
      <span className="sr-only">{toneLabel ?? tone}:</span>
      <span className="font-bold text-foreground">{title}</span>
      {message && <span className="text-muted-foreground truncate">{message}</span>}
    </>
  );
}

function CardLayout({
  id,
  tone,
  toneLabel,
  title,
  message,
  action,
  dismissLabel,
  onDismiss,
}: ToastProps) {
  return (
    <>
      <span aria-hidden="true" className={cn("w-[3px] shrink-0", toastToneBg({ tone }))} />
      <div className="flex-1 min-w-0 px-3 pt-2.5 pb-3 grid grid-cols-[14px_1fr_auto] gap-x-2.5 gap-y-1 items-start">
        <span
          className={cn("font-bold leading-none mt-[3px]", toastToneText({ tone }))}
          aria-hidden="true"
        >
          <ToneIcon tone={tone} />
        </span>
        <span className="sr-only">{toneLabel ?? tone}:</span>
        <div className="flex flex-col gap-1 min-w-0">
          <span className="text-sm font-bold text-foreground">{title}</span>
          {message && (
            <span className="text-xs text-muted-foreground leading-relaxed">{message}</span>
          )}
          {action && (
            <span data-slot="toast-action" className="mt-1 text-xs">
              {action}
            </span>
          )}
        </div>
        <CloseButton id={id} title={title} dismissLabel={dismissLabel} onDismiss={onDismiss} />
      </div>
    </>
  );
}

function ViewfinderLayout({
  id,
  tone,
  toneLabel,
  title,
  message,
  dismissLabel,
  onDismiss,
}: ToastProps) {
  return (
    <>
      <ViewfinderCorners tone={tone} />
      <div className="flex items-center justify-between mb-2 gap-2">
        <span className="inline-flex items-stretch gap-2.5 text-xs font-bold tracking-wider uppercase text-foreground">
          <span
            aria-hidden="true"
            className={cn("inline-block w-[3px] min-h-3.5", toastToneBg({ tone }))}
          />
          <span className="sr-only">{toneLabel ?? tone}:</span>
          {title}
        </span>
        <CloseButton id={id} title={title} dismissLabel={dismissLabel} onDismiss={onDismiss} />
      </div>
      {message && <div className="text-xs text-muted-foreground leading-relaxed">{message}</div>}
    </>
  );
}

// Shared corner-bracket knob (panel.css / diff-view.css / dialog.css): size,
// weight, and offset read --viewfinder-* so an ancestor retheme reaches toast
// too. Fallbacks preserve toast's own 14px / 2px / -1px geometry. Color stays
// CVA-driven because it tracks the toast tone.
const VIEWFINDER_BOX =
  "absolute w-[var(--viewfinder-size,0.875rem)] h-[var(--viewfinder-size,0.875rem)] border-0";

function ViewfinderCorners({ tone }: { tone: ToastTone }) {
  const colorClass = toastToneCornerBorder({ tone });
  return (
    <span aria-hidden="true" data-slot="toast-corners" className="pointer-events-none">
      <span
        className={cn(
          VIEWFINDER_BOX,
          "top-[var(--viewfinder-offset,-1px)] left-[var(--viewfinder-offset,-1px)]",
          "border-t-[length:var(--viewfinder-weight,2px)] border-l-[length:var(--viewfinder-weight,2px)]",
          colorClass,
        )}
      />
      <span
        className={cn(
          VIEWFINDER_BOX,
          "top-[var(--viewfinder-offset,-1px)] right-[var(--viewfinder-offset,-1px)]",
          "border-t-[length:var(--viewfinder-weight,2px)] border-r-[length:var(--viewfinder-weight,2px)]",
          colorClass,
        )}
      />
      <span
        className={cn(
          VIEWFINDER_BOX,
          "bottom-[var(--viewfinder-offset,-1px)] left-[var(--viewfinder-offset,-1px)]",
          "border-b-[length:var(--viewfinder-weight,2px)] border-l-[length:var(--viewfinder-weight,2px)]",
          colorClass,
        )}
      />
      <span
        className={cn(
          VIEWFINDER_BOX,
          "bottom-[var(--viewfinder-offset,-1px)] right-[var(--viewfinder-offset,-1px)]",
          "border-b-[length:var(--viewfinder-weight,2px)] border-r-[length:var(--viewfinder-weight,2px)]",
          colorClass,
        )}
      />
    </span>
  );
}

function CountdownLayout(props: ToastProps) {
  return (
    <>
      <div className="flex">
        <CardLayout {...props} />
      </div>
      <CountdownBar id={props.id} tone={props.tone} />
    </>
  );
}
