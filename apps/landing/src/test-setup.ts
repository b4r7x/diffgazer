/// <reference types="@chialab/vitest-axe/matchers" />
import matchers from "@chialab/vitest-axe";
import { expect } from "vitest";

expect.extend(matchers);

// jsdom has no canvas backend and logs a "Not implemented" error whenever
// getContext is called. Return null instead so the field cleanly no-ops.
Object.defineProperty(HTMLCanvasElement.prototype, "getContext", {
  value: () => null,
  writable: true,
  configurable: true,
});
