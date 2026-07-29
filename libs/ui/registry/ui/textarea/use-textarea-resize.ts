"use client";

import type {
  KeyboardEvent as ReactKeyboardEvent,
  MouseEvent as ReactMouseEvent,
  PointerEvent as ReactPointerEvent,
  RefObject,
} from "react";
import { useRef, useState } from "react";

/** Pixels added or removed by a single arrow-key press. */
export const RESIZE_STEP = 8;

export type TextareaResizeAxis = "vertical" | "horizontal";

interface ResizeStart {
  axis: TextareaResizeAxis;
  clientX: number;
  clientY: number;
  height: number;
  width: number;
}

interface Size {
  height: number | null;
  width: number | null;
}

// Height is the textarea's own; width belongs to the root, because the root also
// reserves the resizer band and both must grow together.
function getSizeLimits(
  textarea: HTMLTextAreaElement,
  root: HTMLDivElement,
  axis: TextareaResizeAxis,
) {
  const element = axis === "vertical" ? textarea : root;
  const styles = element.ownerDocument.defaultView?.getComputedStyle(element);
  const configuredMinimum = Number.parseFloat(
    axis === "vertical" ? (styles?.minHeight ?? "") : (styles?.minWidth ?? ""),
  );
  const maximumValue = axis === "vertical" ? styles?.maxHeight : styles?.maxWidth;
  const configuredMaximum =
    maximumValue?.endsWith("px") === true ? Number.parseFloat(maximumValue) : Number.NaN;
  const parentWidth = root.parentElement?.getBoundingClientRect().width ?? 0;
  const parentMaximum =
    axis === "horizontal" && parentWidth > 0 ? parentWidth : Number.POSITIVE_INFINITY;
  const minimum = Number.isFinite(configuredMinimum) ? configuredMinimum : 0;
  const maximum = Number.isFinite(configuredMaximum) ? configuredMaximum : Number.POSITIVE_INFINITY;

  return { minimum, maximum: Math.max(minimum, Math.min(maximum, parentMaximum)) };
}

/**
 * Pointer and keyboard resizing for the textarea's edge handles. Returns the
 * applied size plus the event handlers each axis button needs.
 */
export function useTextareaResize(
  textareaRef: RefObject<HTMLTextAreaElement | null>,
  rootRef: RefObject<HTMLDivElement | null>,
) {
  const resizeStart = useRef<ResizeStart | null>(null);
  const [size, setSize] = useState<Size>({ height: null, width: null });
  const [activeAxis, setActiveAxis] = useState<TextareaResizeAxis | null>(null);

  const readSize = (axis: TextareaResizeAxis) => {
    const textarea = textareaRef.current;
    const root = rootRef.current;
    if (!textarea || !root) return null;
    return axis === "vertical"
      ? textarea.getBoundingClientRect().height
      : root.getBoundingClientRect().width;
  };

  const setNextSize = (axis: TextareaResizeAxis, nextSize: number) => {
    const textarea = textareaRef.current;
    const root = rootRef.current;
    if (!textarea || !root) return;
    const { minimum, maximum } = getSizeLimits(textarea, root, axis);
    const clamped = Math.min(maximum, Math.max(minimum, nextSize));
    setSize((current) =>
      axis === "vertical" ? { ...current, height: clamped } : { ...current, width: clamped },
    );
  };

  const stepBy = (axis: TextareaResizeAxis, delta: number) => {
    const currentSize = readSize(axis);
    if (currentSize === null) return;
    setNextSize(axis, currentSize + delta);
  };

  const stopResizing = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (!resizeStart.current) return;
    if (event.currentTarget.hasPointerCapture?.(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    resizeStart.current = null;
    setActiveAxis(null);
  };

  const getAxisProps = (axis: TextareaResizeAxis) => ({
    onClick: (event: ReactMouseEvent<HTMLButtonElement>) => {
      // detail 0 means the button was activated by Enter or Space, not a click.
      if (event.detail !== 0) return;
      stepBy(axis, RESIZE_STEP);
    },
    onKeyDown: (event: ReactKeyboardEvent<HTMLButtonElement>) => {
      const decreaseKey = axis === "vertical" ? "ArrowUp" : "ArrowLeft";
      const increaseKey = axis === "vertical" ? "ArrowDown" : "ArrowRight";
      if (event.key !== decreaseKey && event.key !== increaseKey) return;
      event.preventDefault();
      stepBy(axis, event.key === increaseKey ? RESIZE_STEP : -RESIZE_STEP);
    },
    onPointerDown: (event: ReactPointerEvent<HTMLButtonElement>) => {
      const textarea = textareaRef.current;
      const root = rootRef.current;
      if (!event.isPrimary || event.button !== 0 || !textarea || !root) return;
      event.preventDefault();
      event.currentTarget.focus({ preventScroll: true });
      event.currentTarget.setPointerCapture?.(event.pointerId);
      resizeStart.current = {
        axis,
        clientX: event.clientX,
        clientY: event.clientY,
        height: textarea.getBoundingClientRect().height,
        width: root.getBoundingClientRect().width,
      };
      setActiveAxis(axis);
    },
    onPointerMove: (event: ReactPointerEvent<HTMLButtonElement>) => {
      const start = resizeStart.current;
      if (!start) return;
      event.preventDefault();
      setNextSize(
        start.axis,
        start.axis === "vertical"
          ? start.height + event.clientY - start.clientY
          : start.width + event.clientX - start.clientX,
      );
    },
    onPointerUp: stopResizing,
    onPointerCancel: stopResizing,
    onLostPointerCapture: stopResizing,
  });

  return { activeAxis, size, getAxisProps };
}
