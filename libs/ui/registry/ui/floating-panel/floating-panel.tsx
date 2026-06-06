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
import {
  type FloatingAlign,
  type FloatingSide,
  useFloatingPosition,
} from "@/hooks/use-floating-position";
import { usePresence } from "@/hooks/use-presence";
import { composeRefs } from "@/lib/compose-refs";
import { cn } from "@/lib/utils";
import { Portal } from "../shared/portal";

interface FloatingCSS extends CSSProperties {
  [key: `--${string}`]: string | number;
}

export interface FloatingPanelContextValue {
  positioned: boolean;
  side: FloatingSide | null;
  align: FloatingAlign | null;
}

const FloatingPanelContext = createContext<FloatingPanelContextValue | undefined>(undefined);

export function useFloatingPanelContext(): FloatingPanelContextValue {
  const ctx = useContext(FloatingPanelContext);
  if (ctx === undefined) {
    throw new Error("useFloatingPanelContext must be used within <FloatingPanel>");
  }
  return ctx;
}

export interface FloatingPanelProps
  extends Omit<ComponentPropsWithoutRef<"div">, "style"> {
  open: boolean;
  triggerRef: RefObject<HTMLElement | null>;
  side?: FloatingSide;
  align?: FloatingAlign;
  sideOffset?: number;
  alignOffset?: number;
  avoidCollisions?: boolean;
  collisionPadding?: number;
  matchTriggerWidth?: boolean;
  exitFallbackMs?: number;
  portalContainer?: Element | null;
  onExitComplete?: () => void;
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
