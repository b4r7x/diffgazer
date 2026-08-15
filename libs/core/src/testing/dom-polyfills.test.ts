/** @vitest-environment jsdom */

import { describe, expect, it, vi } from "vitest";
import "./dom-polyfills.js";

describe("dom polyfills", () => {
  it("keeps the shared ResizeObserver baseline after vi.unstubAllGlobals()", () => {
    const baseline = globalThis.ResizeObserver;

    class StubResizeObserver implements ResizeObserver {
      observe(_target: Element, _options?: ResizeObserverOptions) {}

      unobserve(_target: Element) {}

      disconnect() {}
    }

    vi.stubGlobal("ResizeObserver", StubResizeObserver);
    expect(globalThis.ResizeObserver).toBe(StubResizeObserver);

    vi.unstubAllGlobals();

    expect(globalThis.ResizeObserver).toBe(baseline);
  });
});
