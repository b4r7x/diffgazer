"use client";

import {
  Children,
  type ComponentProps,
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

function isHTMLElement(ownerDocument: Document, element: Element | null): element is HTMLElement {
  const HTMLElementCtor = ownerDocument.defaultView?.HTMLElement;
  return HTMLElementCtor ? element instanceof HTMLElementCtor : element instanceof HTMLElement;
}

function getDeepActiveElement(ownerDocument: Document): Element | null {
  let active = ownerDocument.activeElement;
  while (active?.shadowRoot?.activeElement) {
    active = active.shadowRoot.activeElement;
  }
  return active;
}

function getFocusSearchScope(root: HTMLElement): ParentNode {
  const rootNode = root.getRootNode();
  const view = root.ownerDocument.defaultView;
  if (view && rootNode instanceof view.ShadowRoot) return rootNode;
  return root.ownerDocument.body;
}

function isVisibleFocusTarget(element: HTMLElement): boolean {
  if (element.tabIndex < 0) return false;
  if (element.closest("[inert]")) return false;
  if (element.closest('[aria-hidden="true"]')) return false;

  const style = element.ownerDocument.defaultView?.getComputedStyle(element);
  return !style || (style.display !== "none" && style.visibility !== "hidden");
}

function findDismissFocusTarget(root: HTMLElement): HTMLElement | null {
  const ownerDocument = root.ownerDocument;
  const candidates = Array.from(
    getFocusSearchScope(root).querySelectorAll<HTMLElement>(DISMISS_FOCUS_SELECTOR),
  ).filter((candidate) => !root.contains(candidate) && isVisibleFocusTarget(candidate));
  const NodeCtor = ownerDocument.defaultView?.Node;
  const followingFlag = NodeCtor?.DOCUMENT_POSITION_FOLLOWING ?? 4;
  const precedingFlag = NodeCtor?.DOCUMENT_POSITION_PRECEDING ?? 2;

  return (
    candidates.find((candidate) =>
      Boolean(root.compareDocumentPosition(candidate) & followingFlag),
    ) ??
    candidates.findLast((candidate) =>
      Boolean(root.compareDocumentPosition(candidate) & precedingFlag),
    ) ??
    null
  );
}

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
  const rootRef = useRef<HTMLDivElement>(null);
  const composedRef = useComposedRefs(rootRef, ref);
  const [open, setOpen] = useControllableState({
    value: controlledOpen,
    defaultValue: defaultOpen ?? true,
    onChange: onOpenChange,
  });

  const onDismiss = useCallback(() => {
    const root = rootRef.current;
    const activeElement = root ? getDeepActiveElement(root.ownerDocument) : null;

    if (root && isHTMLElement(root.ownerDocument, activeElement) && root.contains(activeElement)) {
      findDismissFocusTarget(root)?.focus({ preventScroll: true });
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
