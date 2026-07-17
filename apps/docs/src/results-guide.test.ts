import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const guide = readFileSync(
  resolve(import.meta.dirname, "../content/docs/app/web/results.mdx"),
  "utf8",
);
const reviewOutputReference = readFileSync(
  resolve(import.meta.dirname, "../content/docs/app/reference/review-output.mdx"),
  "utf8",
);

describe("web results guide", () => {
  it("documents exact-set severity chips without threshold semantics", () => {
    expect(guide).toContain("multi-select severity chips");
    expect(guide).toContain("include exactly those severities");
    expect(guide).toContain("High by itself does not include Blocker");
    expect(guide).toContain("Reset clears the selection and shows every severity again");
    expect(guide).not.toMatch(/\bthreshold\b/i);
  });
});

describe("review output reference", () => {
  it("keeps Patch and Trace tab presence binary and structurally parallel", () => {
    expect(reviewOutputReference).toContain(
      "includes Patch exactly when `suggested_patch` contains a patch",
    );
    expect(reviewOutputReference).toContain(
      "includes Trace exactly when `trace` contains at least one step",
    );
    expect(reviewOutputReference).toContain(
      "A null patch, a missing trace, and an empty trace omit their respective tabs",
    );
    expect(reviewOutputReference).not.toContain("empty Trace tab");
  });
});
