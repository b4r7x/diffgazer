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
      frame = requestAnimationFrame(() => {
        frame = null;
        check();
      });
    };

    const resizeObserver = new ResizeObserver(scheduleCheck);
    resizeObserver.observe(node);

    const mutationObserver = new MutationObserver(scheduleCheck);
    mutationObserver.observe(node, {
      childList: true,
      characterData: true,
      subtree: true,
    });
    check();

    return () => {
      active = false;
      resizeObserver.disconnect();
      mutationObserver.disconnect();
      if (frame != null) {
        cancelAnimationFrame(frame);
        frame = null;
      }
    };
  }, [direction, node]);

  return { ref, isOverflowing };
}
