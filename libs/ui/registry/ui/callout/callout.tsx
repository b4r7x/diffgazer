"use client";

import { getFocusableElements, getRestorableFocusTarget } from "@diffgazer/keys";
import { type ComponentProps, type ReactNode, useCallback, useMemo, useRef } from "react";
import { useComposedRefs } from "@/hooks/use-composed-refs";
import { useControllableState } from "@/hooks/use-controllable-state";
import { CalloutContext, type CalloutTone } from "./callout-context";

/** Allowed callout frame values. */
export type CalloutFrame = "inline" | "rail" | "bar";

const TONE_LABEL: Record<CalloutTone, string> = {
  info: "Info: ",
  warning: "Warning: ",
  error: "Error: ",
  success: "Success: ",
};

const TONE_ROLE_LIVE: Record<CalloutTone, "status" | "alert"> = {
  info: "status",
  warning: "status",
  success: "status",
  error: "alert",
};

function getDismissFocusTargets(root: HTMLElement): HTMLElement[] {
  const preceding: HTMLElement[] = [];
  const following: HTMLElement[] = [];
  let passedRoot = false;

  // getFocusableElements walks composed order, so the callout's own focusables
  // are one contiguous run and everything after it is the nearest next target.
  for (const candidate of getFocusableElements(root.ownerDocument.body)) {
    if (root.contains(candidate)) {
      passedRoot = true;
      continue;
    }
    (passedRoot ? following : preceding).push(candidate);
  }

  return [...following, ...preceding.reverse()];
}

function moveFocusOutsideCallout(root: HTMLElement): void {
  for (const target of getDismissFocusTargets(root)) {
    target.focus({ preventScroll: true });
    const activeElement = getRestorableFocusTarget(root.ownerDocument);
    if (activeElement && !root.contains(activeElement)) return;
  }
}

/** Props for callout. */
export interface CalloutProps extends ComponentProps<"div"> {
  /** Content rendered inside the component. */
  children: ReactNode;
  /** Semantic tone - drives color and default icon. */
  tone?: CalloutTone;
  /** Visual frame: inline border, inline-start rail, or marker bar. */
  frame?: CalloutFrame;
  /** Controlled visibility state. Pair with onOpenChange. */
  open?: boolean;
  /** Initial visibility state for uncontrolled usage. */
  defaultOpen?: boolean;
  /** Called when Callout.Dismiss closes the callout or controlled state should change. */
  onOpenChange?: (open: boolean) => void;
  /** Opt into role="status" (or role="alert" for tone="error") for live-region announcement. */
  live?: boolean;
  /** Screen-reader tone word announced before the content. Defaults to the tone name. */
  toneLabel?: string;
}

/**
 * Dismissible alert box with tone-driven coloring, frame variants (inline / rail / bar), and a
 * compound API.
 */
export function Callout({
  className,
  tone = "info",
  frame = "inline",
  open: controlledOpen,
  defaultOpen,
  onOpenChange,
  live = false,
  toneLabel,
  ref,
  children,
  ...props
}: CalloutProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const composedRef = useComposedRefs(rootRef, ref);
  const [open, setOpen] = useControllableState({
    value: controlledOpen,
    defaultValue: defaultOpen ?? true,
    onChange: onOpenChange,
  });

  const onDismiss = useCallback(() => {
    const root = rootRef.current;
    const activeElement = root ? getRestorableFocusTarget(root.ownerDocument) : null;

    if (root && activeElement && root.contains(activeElement)) {
      moveFocusOutsideCallout(root);
    }

    setOpen(false);
  }, [setOpen]);
  const contextValue = useMemo(() => ({ tone, onDismiss }), [tone, onDismiss]);

  if (!open) return null;

  const role = live ? TONE_ROLE_LIVE[tone] : undefined;

  return (
    <CalloutContext value={contextValue}>
      <div
        ref={composedRef}
        role={role}
        data-slot="callout"
        data-tone={tone}
        data-frame={frame}
        className={className}
        {...props}
      >
        <div data-slot="callout-grid">
          {frame === "bar" && (
            <span
              aria-hidden="true"
              data-slot="callout-bar"
              className="self-stretch w-1 rounded-[1px] bg-[color:var(--callout-tone,var(--foreground))] forced-colors:bg-[CanvasText]"
            />
          )}
          <span className="sr-only">{toneLabel ?? TONE_LABEL[tone]}</span>
          {children}
        </div>
      </div>
    </CalloutContext>
  );
}
