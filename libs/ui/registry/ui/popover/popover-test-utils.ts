import "@testing-library/jest-dom/vitest";
import { expect } from "vitest";

/** Asserts a popover/tooltip element is either closed in place or unmounted, both valid presence-transition end states. */
export function expectClosedOrUnmounted(element: HTMLElement) {
  if (element.isConnected) {
    expect(element).toHaveAttribute("data-state", "closed");
    return;
  }
  expect(element).not.toBeInTheDocument();
}

/** Stubs (or removes) window.PointerEvent so tests can force jsdom's pointerType-detection paths. Returns a restore function. */
export function setPointerEventSupport(enabled: boolean) {
  const descriptor = Object.getOwnPropertyDescriptor(window, "PointerEvent");

  Object.defineProperty(window, "PointerEvent", {
    configurable: true,
    writable: true,
    value: enabled ? class TestPointerEvent extends MouseEvent {} : undefined,
  });

  return () => {
    if (descriptor) {
      Object.defineProperty(window, "PointerEvent", descriptor);
    } else {
      Reflect.deleteProperty(window, "PointerEvent");
    }
  };
}
