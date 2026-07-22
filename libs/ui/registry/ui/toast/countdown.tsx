"use client";

import { type CSSProperties, useLayoutEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import { getTimerSnapshot, useToastStore } from "./toast-store";
import { type ToastTone, toastToneBg, toastToneText } from "./toast-variants";

export function CountdownBar({ id, tone }: { id: string; tone: ToastTone }) {
  const fillRef = useRef<HTMLSpanElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const { paused, timerVersion } = useToastStore();

  // biome-ignore lint/correctness/useExhaustiveDependencies: timerVersion is a store revision counter that restarts the countdown animation when timers are recreated.
  useLayoutEffect(() => {
    const fill = fillRef.current;
    if (!fill) return;
    const view = fill.ownerDocument.defaultView ?? globalThis;

    const tick = () => {
      const snap = getTimerSnapshot(id);
      // No timer = persistent toast (error/loading without duration). Park the
      // bar at full and stop the RAF loop instead of churning frames.
      if (!snap || snap.duration <= 0) {
        fill.style.setProperty("--remain", "1");
        rafRef.current = null;
        return;
      }
      const remaining = Math.max(0, snap.remaining - (Date.now() - snap.startedAt));
      const ratio = Math.max(0, Math.min(1, remaining / snap.duration));
      fill.style.setProperty("--remain", String(ratio));
      rafRef.current = view.requestAnimationFrame(tick);
    };

    // While paused the remaining time is frozen, so paint the parked position
    // once and stop the loop instead of re-scheduling an identical frame every
    // tick; unpausing re-runs this effect and resumes the countdown.
    if (paused) {
      const snap = getTimerSnapshot(id);
      const ratio =
        snap && snap.duration > 0 ? Math.max(0, Math.min(1, snap.remaining / snap.duration)) : 1;
      fill.style.setProperty("--remain", String(ratio));
      return;
    }

    rafRef.current = view.requestAnimationFrame(tick);
    return () => {
      if (rafRef.current != null) view.cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    };
  }, [id, paused, timerVersion]);

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
