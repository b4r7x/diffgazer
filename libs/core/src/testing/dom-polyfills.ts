/// <reference lib="dom" />
import { stubMatchMedia } from "./match-media.js";

// Shared jsdom polyfills for app/library vitest suites that render UI
// primitives. jsdom omits ResizeObserver and matchMedia (needed by floating
// indicators and responsive hooks) and ships no HTMLDialogElement methods.
// Import this side-effect module from a package's test-setup file to align it
// with the fuller libs/ui setup. Kept pure-vitest on purpose: the cleanup +
// jest-dom matchers stay in each package's own setup file so this stays free of
// @testing-library deps and consumable from any vitest package.

class TestResizeObserver implements ResizeObserver {
  observe(_target: Element, _options?: ResizeObserverOptions) {}

  unobserve(_target: Element) {}

  disconnect() {}
}

const ResizeObserverBaseline: typeof ResizeObserver = TestResizeObserver;

Object.defineProperty(globalThis, "ResizeObserver", {
  configurable: true,
  writable: true,
  value: ResizeObserverBaseline,
});

stubMatchMedia(false);

if (typeof HTMLDialogElement !== "undefined") {
  HTMLDialogElement.prototype.showModal ??= function showModal() {
    this.setAttribute("open", "");
  };

  HTMLDialogElement.prototype.close ??= function close() {
    this.removeAttribute("open");
  };
}
