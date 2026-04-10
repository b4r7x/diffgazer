import { Children, Fragment, isValidElement } from "react";
import type { ReactElement, ReactNode } from "react";

/**
 * Compute next index with wrap or clamp behavior.
 */
export function clampIndex(
  currentIdx: number,
  direction: 1 | -1,
  length: number,
  wrap: boolean,
): number {
  let nextIdx = currentIdx + direction;

  if (wrap) {
    nextIdx = (nextIdx + length) % length;
  } else {
    nextIdx = Math.max(0, Math.min(nextIdx, length - 1));
  }

  return nextIdx;
}

/**
 * Generic child collection utility that traverses React children,
 * handles Fragments recursively, and extracts data from matching elements.
 */
export function collectChildItems<T>(
  children: ReactNode,
  extract: (element: ReactElement) => T | null,
): T[] {
  const items: T[] = [];
  Children.forEach(children, (child) => {
    if (!isValidElement(child)) return;
    if (child.type === Fragment) {
      items.push(
        ...collectChildItems(
          (child.props as { children: ReactNode }).children,
          extract,
        ),
      );
      return;
    }
    const result = extract(child);
    if (result !== null) {
      items.push(result);
    }
  });
  return items;
}
