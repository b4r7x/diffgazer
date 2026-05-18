"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  type ComponentPropsWithoutRef,
  type CSSProperties,
  type ReactNode,
  type Ref,
  type RefObject,
} from "react";
import { cn } from "@/lib/utils";
import { composeRefs } from "@/lib/compose-refs";
import { Portal } from "../shared/portal";
import { usePresence } from "@/hooks/use-presence";
import {
  useFloatingPosition,
  type FloatingAlign,
  type FloatingSide,
} from "@/hooks/use-floating-position";

interface FloatingCSS extends CSSProperties {
  [key: `--${string}`]: string | number;
}

export interface FloatingPanelContextValue {
  /** True once the panel has measured against its trigger; false during the first paint and after exit. */
  positioned: boolean;
  /** Resolved side after collision handling, or null before first measure. */
  side: FloatingSide | null;
  /** Resolved align after collision handling, or null before first measure. */
  align: FloatingAlign | null;
}

const FloatingPanelContext = createContext<FloatingPanelContextValue | undefined>(undefined);

/**
 * Read FloatingPanel's resolved positioning state from any descendant of the rendered panel.
 * Throws when used outside a FloatingPanel.
 */
export function useFloatingPanelContext(): FloatingPanelContextValue {
  const ctx = useContext(FloatingPanelContext);
  if (ctx === undefined) {
    throw new Error("useFloatingPanelContext must be used within <FloatingPanel>");
  }
  return ctx;
}

export interface FloatingPanelProps
  extends Omit<ComponentPropsWithoutRef<"div">, "style"> {
  /**
   * Controlled open state. There is no `defaultOpen`. FloatingPanel never closes
   * itself; wrap it in a primitive that owns dismiss (outside-click, escape,
   * focus management) and forward the resolved boolean here.
   */
  open: boolean;
  /** Anchor element the panel positions against. Must be a stable RefObject. */
  triggerRef: RefObject<HTMLElement | null>;
  side?: FloatingSide;
  align?: FloatingAlign;
  sideOffset?: number;
  alignOffset?: number;
  avoidCollisions?: boolean;
  collisionPadding?: number;
  /** When true, exposes `--ui-floating-trigger-width` so callers can size the panel against the trigger (use as `width`, `min-width`, or `max-width`). */
  matchTriggerWidth?: boolean;
  /**
   * Max ms to wait for `animationend` before forcing unmount.
   * Default 1000ms (≥25× the default `--ui-content-exit-duration` of 40ms).
   * If you raise `--ui-content-exit-duration` past 500ms, raise this to at
   * least 2× the new value to avoid stranding state in "closing".
   */
  exitFallbackMs?: number;
  /**
   * Explicit portal target, forwarded to `Portal`. Falls back to the ambient
   * `PortalContainerProvider` scope, then the scoped container's
   * `ownerDocument.body`, then `document.body`.
   */
  portalContainer?: Element | null;
  onExitComplete?: () => void;
  /**
   * Caller styles merged BEFORE internal positioning styles. Structural keys
   * (`position`, `top`, `left`, `visibility`, `--ui-content-transform-origin`,
   * `--ui-floating-trigger-width`) cannot be overridden by callers; everything
   * else (background, min-width, border, transform, etc.) passes through.
   */
  style?: CSSProperties;
  children?: ReactNode;
  ref?: Ref<HTMLDivElement>;
}

// CSS anchor edge per resolved side; duplicates use-floating-position's flip map by data
// but the intent is geometry (transform-origin), not placement flip on collision.
const OPPOSITE_SIDE: Record<FloatingSide, string> = {
  top: "bottom",
  bottom: "top",
  left: "right",
  right: "left",
};

const HORIZONTAL_ALIGN: Record<FloatingAlign, string> = {
  start: "left",
  center: "center",
  end: "right",
};

const VERTICAL_ALIGN: Record<FloatingAlign, string> = {
  start: "top",
  center: "center",
  end: "bottom",
};

function computeTransformOrigin(side: FloatingSide, align: FloatingAlign): string {
  const anchor = OPPOSITE_SIDE[side];
  const isVertical = side === "top" || side === "bottom";
  const cross = isVertical ? HORIZONTAL_ALIGN[align] : VERTICAL_ALIGN[align];
  return `${anchor} ${cross}`;
}

function buildPanelStyle(
  position: ReturnType<typeof useFloatingPosition>["position"],
  matchTriggerWidth: boolean,
): FloatingCSS {
  if (!position) {
    return { position: "fixed", top: 0, left: 0, visibility: "hidden" };
  }
  const base: FloatingCSS = {
    position: "fixed",
    top: position.y,
    left: position.x,
    visibility: "visible",
    "--ui-content-transform-origin": computeTransformOrigin(position.side, position.align),
  };
  if (matchTriggerWidth) {
    base["--ui-floating-trigger-width"] = `${position.triggerWidth}px`;
  }
  return base;
}

// Module-level: dedups warnings per panel element; GC cleans up on unmount.
const warnedNodes = new WeakSet<HTMLElement>();

/**
 * FloatingPanel renders a portaled, animated panel anchored to a trigger.
 *
 * Public CSS custom properties written to the panel element:
 * - `--ui-content-transform-origin` — always set, derived from resolved side/align.
 * - `--ui-floating-trigger-width` — set only when `matchTriggerWidth` is true.
 *
 * Public CSS variables read from the `.ui-floating-panel` rule (override on the
 * panel or an ancestor):
 * - `--ui-floating-z` — z-index layer; defaults to `var(--z-popover)`. Tooltip
 *   consumers can lower it, Toast-anchored consumers can raise it.
 *
 * Descendants of the rendered panel can subscribe to positioning state via
 * `useFloatingPanelContext()` — useful for adapters that need to defer effects
 * (focus, measurement) until after the first measure.
 */
export function FloatingPanel({
  open,
  triggerRef,
  side = "bottom",
  align = "center",
  sideOffset = 6,
  alignOffset = 0,
  avoidCollisions = true,
  collisionPadding = 8,
  matchTriggerWidth = false,
  exitFallbackMs = 1000,
  portalContainer,
  onExitComplete,
  style,
  className,
  children,
  ref,
  ...rest
}: FloatingPanelProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const { present } = usePresence({
    open,
    ref: panelRef,
    exitFallbackMs,
    onExitComplete,
  });
  const { position, contentRef } = useFloatingPosition({
    triggerRef,
    open: present,
    side,
    align,
    sideOffset,
    alignOffset,
    avoidCollisions,
    collisionPadding,
  });

  const positioned = position !== null;
  const contextValue = useMemo<FloatingPanelContextValue>(
    () => ({
      positioned,
      side: position?.side ?? null,
      align: position?.align ?? null,
    }),
    [positioned, position?.side, position?.align],
  );

  // No NODE_ENV gate: shadcn smoke fixtures don't ship @types/node, so process.env reads fail typecheck.
  useEffect(() => {
    const el = panelRef.current;
    if (!el || warnedNodes.has(el)) return;
    const hasRole = el.hasAttribute("role");
    const hasLabel = el.hasAttribute("aria-label") || el.hasAttribute("aria-labelledby");
    if (!hasRole && !hasLabel) {
      warnedNodes.add(el);
      console.warn(
        "[FloatingPanel] Rendered without `role` or `aria-label`/`aria-labelledby`. Assistive technology will see an unlabeled container. Set a role (e.g. \"dialog\", \"menu\") and supply an accessible name.",
      );
    }
  }, [present]);

  if (!present) return null;

  const positionedStyle = buildPanelStyle(position, matchTriggerWidth);

  return (
    <Portal container={portalContainer}>
      <FloatingPanelContext.Provider value={contextValue}>
        <div
          {...rest}
          ref={composeRefs(panelRef, contentRef, ref)}
          data-state={open ? "open" : "closed"}
          data-side={position?.side}
          data-align={position?.align}
          data-positioned={positioned ? "" : undefined}
          className={cn("ui-floating-panel", className)}
          style={{ ...style, ...positionedStyle }}
        >
          {children}
        </div>
      </FloatingPanelContext.Provider>
    </Portal>
  );
}
