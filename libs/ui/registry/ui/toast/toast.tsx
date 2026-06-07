"use client";

import { type CSSProperties, lazy, Suspense, useLayoutEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import type { ToastPosition, Toast as ToastType } from "./toast-store";
import { getTimerSnapshot } from "./toast-store";
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

interface ToastProps extends ToastType {
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
  onDismiss,
}: {
  id: string;
  title: string;
  onDismiss: (id: string) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onDismiss(id)}
      className={cn(
        "min-h-6 min-w-6 p-1 flex items-center justify-center text-xs leading-none",
        "text-muted hover:text-foreground cursor-pointer",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background",
      )}
      aria-label={`Dismiss: ${title}`}
    >
      ✕
    </button>
  );
}

function HudLayout({ tone, title, message }: ToastProps) {
  return (
    <>
      <span
        className={cn("inline-flex w-3 justify-center font-bold", toastToneText({ tone }))}
        aria-hidden="true"
      >
        <ToneIcon tone={tone} />
      </span>
      <span className="sr-only">{tone}:</span>
      <span className="font-bold text-foreground">{title}</span>
      {message && <span className="text-muted-foreground truncate">{message}</span>}
    </>
  );
}

function CardLayout({ id, tone, title, message, action, onDismiss }: ToastProps) {
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
        <span className="sr-only">{tone}:</span>
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
        <CloseButton id={id} title={title} onDismiss={onDismiss} />
      </div>
    </>
  );
}

function ViewfinderLayout({ id, tone, title, message, onDismiss }: ToastProps) {
  return (
    <>
      <ViewfinderCorners tone={tone} />
      <div className="flex items-center justify-between mb-2 gap-2">
        <span className="inline-flex items-stretch gap-2.5 text-xs font-bold tracking-wider uppercase text-foreground">
          <span
            aria-hidden="true"
            className={cn("inline-block w-[3px] min-h-3.5", toastToneBg({ tone }))}
          />
          <span className="sr-only">{tone}:</span>
          {title}
        </span>
        <CloseButton id={id} title={title} onDismiss={onDismiss} />
      </div>
      {message && <div className="text-sm text-foreground/90">{message}</div>}
    </>
  );
}

function ViewfinderCorners({ tone }: { tone: ToastTone }) {
  const colorClass = toastToneCornerBorder({ tone });
  return (
    <span aria-hidden="true" data-slot="toast-corners" className="pointer-events-none">
      <span
        className={cn(
          "absolute -top-px -left-px w-3.5 h-3.5 border-0 border-t-2 border-l-2",
          colorClass,
        )}
      />
      <span
        className={cn(
          "absolute -top-px -right-px w-3.5 h-3.5 border-0 border-t-2 border-r-2",
          colorClass,
        )}
      />
      <span
        className={cn(
          "absolute -bottom-px -left-px w-3.5 h-3.5 border-0 border-b-2 border-l-2",
          colorClass,
        )}
      />
      <span
        className={cn(
          "absolute -bottom-px -right-px w-3.5 h-3.5 border-0 border-b-2 border-r-2",
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

function CountdownBar({ id, tone }: { id: string; tone: ToastTone }) {
  const fillRef = useRef<HTMLSpanElement | null>(null);
  const rafRef = useRef<number | null>(null);

  useLayoutEffect(() => {
    const fill = fillRef.current;
    if (!fill) return;

    const tick = () => {
      const snap = getTimerSnapshot(id);
      // No timer = persistent toast (error/loading without duration). Park the
      // bar at full and stop the RAF loop instead of churning frames.
      if (!snap || snap.duration <= 0) {
        fill.style.setProperty("--remain", "1");
        rafRef.current = null;
        return;
      }
      const elapsed = snap.paused ? 0 : Date.now() - snap.startedAt;
      const remaining = Math.max(0, snap.remaining - elapsed);
      const ratio = Math.max(0, Math.min(1, remaining / snap.duration));
      fill.style.setProperty("--remain", String(ratio));
      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    };
  }, [id]);

  return (
    <div
      data-slot="toast-countdown"
      aria-hidden="true"
      className="relative h-0.5 bg-border/30 overflow-hidden"
    >
      <span
        ref={fillRef}
        className={cn("absolute inset-0 origin-left motion-reduce:hidden", toastToneBg({ tone }))}
        // `--remain` is the registry-facing CSS hook: consumers can override
        // the bar fill via `[data-slot="toast-countdown"] > span { transform:
        // scaleX(...) }` without touching the component. Starts at 1 and the
        // RAF loop updates it in place.
        style={{ "--remain": 1, transform: "scaleX(var(--remain))" } as CSSProperties}
      />
      <ReducedMotionTicks tone={tone} />
    </div>
  );
}

function ReducedMotionTicks({ tone }: { tone: ToastTone }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "hidden motion-reduce:flex absolute inset-0 items-center justify-start text-[8px] leading-none tracking-[0.2em] font-mono",
        toastToneText({ tone }),
      )}
    >
      ▰▰▰▱▱
    </span>
  );
}
