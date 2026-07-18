import type { ReactElement } from "react";

const nativeInteractiveElements = new Set([
  "button",
  "a",
  "input",
  "select",
  "textarea",
  "summary",
]);

export function isNativeInteractiveElement<T>(element: ReactElement<T>): boolean {
  return typeof element.type === "string" && nativeInteractiveElements.has(element.type);
}

export function mergeHandlers<Event extends { defaultPrevented?: boolean }>(
  existing: ((event: Event) => void) | undefined,
  added: ((event: Event) => void) | undefined,
  skipWhenDefaultPrevented = false,
): (event: Event) => void {
  return (event) => {
    existing?.(event);
    if (skipWhenDefaultPrevented && event.defaultPrevented) return;
    added?.(event);
  };
}
