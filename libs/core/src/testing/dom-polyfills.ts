/// <reference lib="dom" />
import { vi } from "vitest";

// Shared jsdom polyfills for app/library vitest suites that render UI
// primitives. jsdom omits ResizeObserver and matchMedia (needed by floating
// indicators and responsive hooks) and ships no HTMLDialogElement methods.
// Import this side-effect module from a package's test-setup file to align it
// with the fuller libs/ui setup. Kept pure-vitest on purpose: the cleanup +
// jest-dom matchers stay in each package's own setup file so this stays free of
// @testing-library deps and consumable from any vitest package.

class TestResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}

vi.stubGlobal("ResizeObserver", TestResizeObserver);

Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

if (typeof HTMLDialogElement !== "undefined") {
  HTMLDialogElement.prototype.showModal ??= function showModal() {
    this.setAttribute("open", "");
  };

  HTMLDialogElement.prototype.close ??= function close() {
    this.removeAttribute("open");
  };
}
