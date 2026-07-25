import "@testing-library/jest-dom/vitest";
import "@diffgazer/core/testing/dom-polyfills";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

// jsdom ships no scrollIntoView, and the app calls it directly (history zone
// changes) rather than optional-calling it, so the real failure mode - a ref
// pointing at a non-element - still surfaces.
Element.prototype.scrollIntoView ??= function scrollIntoView() {};

afterEach(() => {
  cleanup();
});
