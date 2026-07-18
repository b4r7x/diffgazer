"use client";

import { type RefCallback, useCallback, useLayoutEffect, useRef, useState } from "react";

/** Axis used when checking whether content exceeds an element's bounds. */
export type OverflowDirection = "horizontal" | "vertical" | "both";

/** Detects whether an element's content overflows its container using ResizeObserver. */
export function useOverflowDetection<T extends HTMLElement = HTMLElement>(
  direction: OverflowDirection = "horizontal",
): { ref: RefCallback<T>; isOverflowing: boolean } {
  const [node, setNode] = useState<T | null>(null);
  const attachmentRef = useRef<{ generation: number; node: T | null }>({
    generation: 0,
    node: null,
  });
  const [isOverflowing, setIsOverflowing] = useState(false);
  const ref = useCallback((nextNode: T | null) => {
    attachmentRef.current = {
      generation: attachmentRef.current.generation + 1,
      node: nextNode,
    };
    setNode(nextNode);
  }, []);

  useLayoutEffect(() => {
    if (!node) {
      setIsOverflowing(false);
      return;
    }

    const generation = attachmentRef.current.generation;
    const view = node.ownerDocument.defaultView ?? globalThis;
    let active = true;
    let frame: number | null = null;
    const isCurrentAttachment = () => {
      const attachment = attachmentRef.current;
      return active && attachment.generation === generation && attachment.node === node;
    };
    const check = () => {
      if (!isCurrentAttachment()) return;

      const horizontal = node.scrollWidth > node.clientWidth;
      const vertical = node.scrollHeight > node.clientHeight;
      setIsOverflowing({ horizontal, vertical, both: horizontal || vertical }[direction]);
    };
    const scheduleCheck = () => {
      if (!isCurrentAttachment() || frame != null) return;
      if (typeof view.requestAnimationFrame !== "function") {
        check();
        return;
      }
      frame = view.requestAnimationFrame(() => {
        frame = null;
        check();
      });
    };

    const ResizeObserverCtor = view.ResizeObserver;
    const resizeObserver =
      typeof ResizeObserverCtor === "function" ? new ResizeObserverCtor(scheduleCheck) : null;
    const observeChildren = () => {
      if (!isCurrentAttachment()) return;
      resizeObserver?.disconnect();
      resizeObserver?.observe(node);
      for (const child of Array.from(node.children)) {
        resizeObserver?.observe(child);
      }
    };

    const MutationObserverCtor = view.MutationObserver;
    const mutationObserver =
      typeof MutationObserverCtor === "function"
        ? new MutationObserverCtor(() => {
            if (!isCurrentAttachment()) return;
            observeChildren();
            scheduleCheck();
          })
        : null;
    observeChildren();
    mutationObserver?.observe(node, {
      childList: true,
      characterData: true,
      subtree: true,
      attributes: true,
    });
    check();

    return () => {
      active = false;
      resizeObserver?.disconnect();
      mutationObserver?.disconnect();
      if (frame != null) {
        if (typeof view?.cancelAnimationFrame === "function") view.cancelAnimationFrame(frame);
        frame = null;
      }
    };
  }, [direction, node]);

  return { ref, isOverflowing };
}
