import { describe, expect, it } from "vitest";
import lighthouseConfig from "../lighthouserc.json";

describe("Lighthouse CI configuration", () => {
  it("leaves server startup and canonical URLs to the dynamic-port runner", () => {
    expect(lighthouseConfig.ci.collect).toEqual({
      numberOfRuns: 1,
      settings: {
        preset: "desktop",
      },
    });
  });

  it("fails the existing budgets and browser console errors", () => {
    expect(lighthouseConfig.ci.assert.assertions).toEqual({
      "categories:performance": ["error", { minScore: 0.9 }],
      "categories:accessibility": ["error", { minScore: 0.95 }],
      "first-contentful-paint": ["error", { maxNumericValue: 2_000 }],
      "largest-contentful-paint": ["error", { maxNumericValue: 2_500 }],
      "cumulative-layout-shift": ["error", { maxNumericValue: 0.1 }],
      "total-blocking-time": ["error", { maxNumericValue: 300 }],
      "color-contrast": "error",
      "heading-order": "error",
      "errors-in-console": "error",
    });
  });
});
