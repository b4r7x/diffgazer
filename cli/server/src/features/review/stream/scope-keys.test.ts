import { describe, expect, it } from "vitest";
import { buildScopeKey } from "./scope-keys.js";

describe("buildScopeKey", () => {
  it("distinguishes file selections whose names contain the join delimiter", () => {
    // "a,b" as one file must not collide with the two files "a" and "b": a
    // naive comma-join collapses both to `f:a,b` and returns the wrong review.
    expect(buildScopeKey({ files: ["a,b"] })).not.toBe(buildScopeKey({ files: ["a", "b"] }));
    expect(buildScopeKey({ files: ["a|b"] })).not.toBe(buildScopeKey({ files: ["a", "b"] }));
    // The key is order-independent so the same selection always dedupes.
    expect(buildScopeKey({ files: ["b", "a"] })).toBe(buildScopeKey({ files: ["a", "b"] }));
  });
});
