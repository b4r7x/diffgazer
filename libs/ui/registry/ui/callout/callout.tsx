"use client";

import {
  Children,
  isValidElement,
  useCallback,
  useMemo,
  type CSSProperties,
  type HTMLAttributes,
  type ReactNode,
  type Ref,
} from "react";
import { cn } from "@/lib/utils";
import { useControllableState } from "@/hooks/use-controllable-state";
import { CalloutContext, type CalloutTone } from "./callout-context";
import { CalloutIcon } from "./callout-icon";

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

interface GridStyle {
  className: string;
  style: CSSProperties;
}

function gridStyle(frame: CalloutFrame, hasIcon: boolean): GridStyle {
  if (frame === "bar") {
    if (hasIcon) {
      return {
        className: "grid items-start gap-x-[10px] gap-y-1 grid-cols-[4px_16px_minmax(0,1fr)_auto]",
        style: { gridTemplateAreas: "'bar icon title dismiss' 'bar . body .'" },
      };
    }
    return {
      className: "grid items-start gap-x-[10px] gap-y-1 grid-cols-[4px_minmax(0,1fr)_auto]",
      style: { gridTemplateAreas: "'bar title dismiss' 'bar body .'" },
    };
  }
  if (hasIcon) {
    return {
      className: "grid items-start gap-x-[10px] gap-y-1 grid-cols-[16px_minmax(0,1fr)_auto]",
      style: { gridTemplateAreas: "'icon title dismiss' '. body .'" },
    };
  }
  return {
    className: "grid items-start gap-x-[10px] gap-y-1 grid-cols-[minmax(0,1fr)_auto]",
    style: { gridTemplateAreas: "'title dismiss' 'body .'" },
  };
}

export interface CalloutProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  tone?: CalloutTone;
  frame?: CalloutFrame;
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  live?: boolean;
  ref?: Ref<HTMLDivElement>;
}

export function Callout({
  className,
  tone = "info",
  frame = "inline",
  open: controlledOpen,
  defaultOpen,
  onOpenChange,
  live = false,
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
  const grid = gridStyle(frame, hasIcon);

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
        <div className={grid.className} style={grid.style}>
          {frame === "bar" && (
            <span
              aria-hidden="true"
              style={{ gridArea: "bar" }}
              className="self-stretch w-1 rounded-[1px] bg-[color:var(--cal-tone)] forced-colors:bg-[CanvasText]"
            />
          )}
          <span className="sr-only">{TONE_LABEL[tone]}</span>
          {children}
        </div>
      </div>
    </CalloutContext>
  );
}
