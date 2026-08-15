import "@testing-library/jest-dom/vitest";
import "@diffgazer/core/testing/dom-polyfills";
import { cleanup } from "@testing-library/react";
import { afterEach, expect } from "vitest";
import { assertClientSafeDom } from "@/testing/client-safe-assertions";

expect.extend({
  toBeClientSafeDom(received: string) {
    try {
      assertClientSafeDom(received);
      return {
        pass: true,
        message: () => "expected DOM to contain forbidden secret fields",
      };
    } catch (error) {
      return {
        pass: false,
        message: () => (error instanceof Error ? error.message : String(error)),
      };
    }
  },
});

// jsdom ships no scrollIntoView, and the app calls it directly (history zone
// changes) rather than optional-calling it, so the real failure mode - a ref
// pointing at a non-element - still surfaces.
Element.prototype.scrollIntoView ??= function scrollIntoView() {};

afterEach(() => {
  cleanup();
});
