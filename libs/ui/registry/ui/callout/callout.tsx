"use client";

import {
  Children,
  type ComponentProps,
  isValidElement,
  type ReactNode,
  useCallback,
  useMemo,
} from "react";
import { useControllableState } from "@/hooks/use-controllable-state";
import { cn } from "@/lib/utils";
import { CalloutContext, type CalloutTone } from "./callout-context";
import { CalloutIcon } from "./callout-icon";

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

function hasCalloutIcon(children: ReactNode): boolean {
  let found = false;
  Children.forEach(children, (child) => {
    if (found) return;
    if (isValidElement(child) && child.type === CalloutIcon) {
      found = true;
    }
  });
  return found;
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
  const [open, setOpen] = useControllableState({
    value: controlledOpen,
    defaultValue: defaultOpen ?? true,
    onChange: onOpenChange,
  });

  const onDismiss = useCallback(() => setOpen(false), [setOpen]);
  const contextValue = useMemo(() => ({ tone, onDismiss }), [tone, onDismiss]);

  if (!open) return null;

  const hasIcon = hasCalloutIcon(children);
  const role = live ? TONE_ROLE_LIVE[tone] : undefined;

  return (
    <CalloutContext value={contextValue}>
      <div
        ref={ref}
        role={role}
        data-slot="callout"
        data-tone={tone}
        data-frame={frame}
        className={cn(className)}
        {...props}
      >
        <div data-slot="callout-grid" data-has-icon={String(hasIcon)}>
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
