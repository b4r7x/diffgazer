"use client";

import { getRestorableFocusTarget, isFocusable } from "@diffgazer/keys";
import {
  Children,
  type ComponentProps,
  Fragment,
  isValidElement,
  type ReactNode,
  useCallback,
  useMemo,
  useRef,
} from "react";
import { useComposedRefs } from "@/hooks/use-composed-refs";
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

const DISMISS_FOCUS_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  'input:not([type="hidden"]):not([disabled])',
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[tabindex]:not([disabled])",
].join(",");

function getFocusSearchScope(root: HTMLElement): ParentNode {
  const rootNode = root.getRootNode();
  const view = root.ownerDocument.defaultView;
  if (view && rootNode instanceof view.ShadowRoot) return rootNode;
  return root.ownerDocument.body;
}

function getDismissFocusTargets(root: HTMLElement): HTMLElement[] {
  const ownerDocument = root.ownerDocument;
  const candidates = Array.from(
    getFocusSearchScope(root).querySelectorAll<HTMLElement>(DISMISS_FOCUS_SELECTOR),
  ).filter((candidate) => !root.contains(candidate) && isFocusable(candidate));
  const NodeCtor = ownerDocument.defaultView?.Node;
  const followingFlag = NodeCtor?.DOCUMENT_POSITION_FOLLOWING ?? 4;
  const precedingFlag = NodeCtor?.DOCUMENT_POSITION_PRECEDING ?? 2;

  const following = candidates.filter((candidate) =>
    Boolean(root.compareDocumentPosition(candidate) & followingFlag),
  );
  const preceding = candidates
    .filter((candidate) => Boolean(root.compareDocumentPosition(candidate) & precedingFlag))
    .reverse();
  return [...following, ...preceding];
}

function moveFocusOutsideCallout(root: HTMLElement): void {
  for (const target of getDismissFocusTargets(root)) {
    target.focus({ preventScroll: true });
    const activeElement = getRestorableFocusTarget(root.ownerDocument);
    if (activeElement && !root.contains(activeElement)) return;
  }
}

function hasCalloutIcon(children: ReactNode): boolean {
  let found = false;
  Children.forEach(children, (child) => {
    if (found) return;
    if (!isValidElement<{ children?: ReactNode }>(child)) return;
    if (child.type === CalloutIcon) {
      found = true;
      return;
    }
    if (child.type === Fragment) found = hasCalloutIcon(child.props.children);
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

  const hasIcon = hasCalloutIcon(children);
  const role = live ? TONE_ROLE_LIVE[tone] : undefined;

  return (
    <CalloutContext value={contextValue}>
      <div
        ref={composedRef}
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
