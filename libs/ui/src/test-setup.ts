import "@testing-library/jest-dom/vitest";
import "@diffgazer/core/testing/dom-polyfills";
import matchers from "@chialab/vitest-axe";
import { cleanup } from "@testing-library/react";
import { afterEach, expect } from "vitest";

expect.extend(matchers);

declare module "vitest" {
  // biome-ignore lint/suspicious/noExplicitAny: must match vitest's upstream Assertion<T = any> generic default to merge the augmentation
  interface Assertion<T = any> {
    toHaveNoViolations(): T;
  }
  interface AsymmetricMatchersContaining {
    toHaveNoViolations(): unknown;
  }
}

afterEach(() => {
  cleanup();
});
