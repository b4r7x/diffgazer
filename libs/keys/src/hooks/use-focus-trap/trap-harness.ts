import { renderHook } from "@testing-library/react";
import { useRef } from "react";
import { getDeepActiveElement } from "../../dom/element-guards.js";
import { useFocusTrap } from "../use-focus-trap.js";

export function createContainerIn(ownerDocument: Document, ...focusableHTML: string[]) {
  const container = ownerDocument.createElement("div");
  container.tabIndex = -1;
  for (const html of focusableHTML) {
    container.insertAdjacentHTML("beforeend", html);
  }
  ownerDocument.body.appendChild(container);
  return container;
}

export function createContainer(...focusableHTML: string[]) {
  return createContainerIn(document, ...focusableHTML);
}

export function fireTabFromActive(ownerDocument: Document, shiftKey = false) {
  const KeyboardEventCtor = ownerDocument.defaultView?.KeyboardEvent ?? KeyboardEvent;
  const event = new KeyboardEventCtor("keydown", {
    key: "Tab",
    shiftKey,
    bubbles: true,
    cancelable: true,
    composed: true,
  });
  getDeepActiveElement(ownerDocument)?.dispatchEvent(event);
  return event;
}

export function fireTab(shiftKey = false) {
  return fireTabFromActive(document, shiftKey);
}

export function renderTrap(
  containerEl: HTMLDivElement,
  options?: Parameters<typeof useFocusTrap>[1],
) {
  return renderHook(
    ({ opts }) => {
      const ref = useRef<HTMLElement>(containerEl);
      useFocusTrap(ref, opts);
    },
    { initialProps: { opts: options } },
  );
}
