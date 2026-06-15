"use client";

import {
  type ComponentPropsWithoutRef,
  type CSSProperties,
  createContext,
  type ReactNode,
  type Ref,
  type RefObject,
  useContext,
  useMemo,
  useRef,
} from "react";
import { useComposedRefs } from "@/hooks/use-composed-refs";
import {
  type FloatingAlign,
  type FloatingSide,
  useFloatingPosition,
} from "@/hooks/use-floating-position";
import { usePresence } from "@/hooks/use-presence";
import { cn } from "@/lib/utils";
import { Portal } from "../shared/portal";

interface FloatingCSS extends CSSProperties {
  [key: `--${string}`]: string | number;
}

/** Context value shared by floating panel. */
export interface FloatingPanelContextValue {
  /** positioned used by floating panel. */
  positioned: boolean;
  /** Preferred side relative to the trigger. */
  side: FloatingSide | null;
  /** Alignment along the chosen side. */
  align: FloatingAlign | null;
}

const FloatingPanelContext = createContext<FloatingPanelContextValue | undefined>(undefined);

/** Reads the floating panel context. */
export function useFloatingPanelContext(): FloatingPanelContextValue {
  const ctx = useContext(FloatingPanelContext);
  if (ctx === undefined) {
    throw new Error("useFloatingPanelContext must be used within <FloatingPanel>");
  }
  return ctx;
}

/** Props for floating panel. */
export interface FloatingPanelProps extends Omit<ComponentPropsWithoutRef<"div">, "style"> {
  /**
   * Controlled open state. FloatingPanel never closes itself; the wrapping primitive owns
   * dismiss and forwards the resolved boolean here.
   */
  open: boolean;
  /** Anchor element the panel positions against. Must be a stable RefObject. */
  triggerRef: RefObject<HTMLElement | null>;
  /** Preferred side relative to the trigger. */
  side?: FloatingSide;
  /** Alignment along the chosen side. */
  align?: FloatingAlign;
  /** Pixel gap from the trigger along the side axis. */
  sideOffset?: number;
  /** Pixel offset along the alignment axis. */
  alignOffset?: number;
  /** Flips to the opposite side, then cross-axis sides, then shifts within the viewport. */
  avoidCollisions?: boolean;
  /** Minimum gap between the panel and the viewport edge during collision avoidance. */
  collisionPadding?: number;
  /**
   * When true, exposes `--ui-floating-trigger-width` on the panel so callers can size the panel
   * against the trigger (use as `width`, `min-width`, or `max-width`).
   */
  matchTriggerWidth?: boolean;
  /**
   * Max ms to wait for `animationend` before forcing unmount. Raise to at least 2×
   * `--ui-content-exit-duration` if you customize that token past 500ms.
   */
  exitFallbackMs?: number;
  /**
   * Explicit portal target forwarded to Portal. Falls back to the ambient
   * PortalContainerProvider scope, then the scoped container's `ownerDocument.body`, then
   * `document.body`.
   */
  portalContainer?: Element | null;
  /**
   * Fired after the exit animation resolves (or the fallback timer fires) and the panel
   * unmounts.
   */
  onExitComplete?: () => void;
  /**
   * Caller styles merged before internal positioning styles. Structural keys cannot be
   * overridden; pass-through keys (background, border, transform, etc.) apply.
   */
  style?: CSSProperties;
  /** Panel body content. */
  children?: ReactNode;
  /** Forwarded ref to the panel element. Composed with the internal measurement ref. */
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
    // Room the panel has before overflowing the viewport for the resolved side.
    // Custom panels can cap their scrollable region with these (e.g.
    // `max-height: var(--floating-panel-available-height); overflow-y: auto`).
    "--floating-panel-available-height": `${position.availableHeight}px`,
    "--floating-panel-available-width": `${position.availableWidth}px`,
  };
  if (matchTriggerWidth) {
    base["--ui-floating-trigger-width"] = `${position.triggerWidth}px`;
  }
  return base;
}

/**
 * Floating overlay positioned against a trigger with collision avoidance.
 *
 * Exposes two CSS variables on its element for custom panels that need to cap
 * their size to the viewport and scroll overflow instead of clipping it:
 * `--floating-panel-available-height` and `--floating-panel-available-width`
 * (the room the panel has for the resolved side, e.g.
 * `max-height: var(--floating-panel-available-height); overflow-y: auto`).
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
  const composedRef = useComposedRefs(panelRef, contentRef, ref);
  const contextValue = useMemo<FloatingPanelContextValue>(
    () => ({
      positioned,
      side: position?.side ?? null,
      align: position?.align ?? null,
    }),
    [positioned, position?.side, position?.align],
  );

  if (!present) return null;

  const positionedStyle = buildPanelStyle(position, matchTriggerWidth);

  return (
    <Portal container={portalContainer}>
      <FloatingPanelContext.Provider value={contextValue}>
        <div
          data-slot="floating-panel"
          {...rest}
          ref={composedRef}
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
