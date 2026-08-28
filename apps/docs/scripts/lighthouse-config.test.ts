import { describe, expect, it } from "vitest";
import lighthouseConfig from "../lighthouserc.json";

const { collect, assert } = lighthouseConfig.ci;
const assertions: Record<string, unknown> = assert.assertions;

/** Lowest category score the release gate accepts; the config may only be stricter. */
const MIN_SCORE_FLOORS: Record<string, number> = {
  "categories:performance": 0.9,
  "categories:accessibility": 0.95,
};

/** Slowest timing the release gate accepts, in the unit Lighthouse reports. */
const MAX_TIMING_BUDGETS: Record<string, number> = {
  "first-contentful-paint": 2_000,
  "largest-contentful-paint": 2_500,
  "cumulative-layout-shift": 0.1,
  "total-blocking-time": 300,
};

function severityOf(assertion: unknown): unknown {
  return Array.isArray(assertion) ? assertion[0] : assertion;
}

function optionsOf(assertion: unknown): Record<string, number> {
  if (!Array.isArray(assertion)) return {};
  const options: unknown = assertion[1];
  return typeof options === "object" && options !== null ? (options as Record<string, number>) : {};
}

describe("Lighthouse CI configuration", () => {
  it("leaves server startup and canonical URLs to the dynamic-port runner", () => {
    // The runner boots the preview server on a free port and passes the URLs it
    // resolved, so a URL pinned here would collect against the wrong origin.
    expect(collect).not.toHaveProperty("url");
    expect(collect).not.toHaveProperty("startServerCommand");
    // More than one run so LHCI's median absorbs shared-runner variance before
    // the numeric budgets below decide a release gate.
    expect(collect.numberOfRuns).toBeGreaterThan(1);
  });

  it("gates the release on every assertion rather than warning", () => {
    // The pass/fail audits that carry no numeric budget: dropping one would
    // otherwise leave every remaining invariant below still green.
    for (const audit of ["color-contrast", "heading-order", "errors-in-console"]) {
      expect(assertions, audit).toHaveProperty(audit);
    }
    for (const [audit, assertion] of Object.entries(assertions)) {
      expect(severityOf(assertion), audit).toBe("error");
    }
  });

  it("holds the score floors and timing budgets the release gate depends on", () => {
    for (const [audit, floor] of Object.entries(MIN_SCORE_FLOORS)) {
      expect(optionsOf(assertions[audit]).minScore, audit).toBeGreaterThanOrEqual(floor);
    }
    for (const [audit, budget] of Object.entries(MAX_TIMING_BUDGETS)) {
      expect(optionsOf(assertions[audit]).maxNumericValue, audit).toBeLessThanOrEqual(budget);
    }
  });
});
