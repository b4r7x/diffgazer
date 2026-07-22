import { describe, expect, it } from "vitest";
import { parsedDiffIdentity } from "./identity";
import type { ParsedDiff } from "./parse";

const EMPTY: ParsedDiff = { oldPath: null, newPath: null, hunks: [] };

describe("parsedDiffIdentity", () => {
  it("returns the same identity for structurally equal diffs", () => {
    const build = (): ParsedDiff => ({
      oldPath: "a.ts",
      newPath: "b.ts",
      hunks: [
        {
          oldStart: 1,
          oldCount: 1,
          newStart: 1,
          newCount: 1,
          heading: "fn",
          changes: [{ type: "context", content: "x", oldLine: 1, newLine: 1 }],
        },
      ],
    });
    expect(parsedDiffIdentity(build())).toBe(parsedDiffIdentity(build()));
  });

  it("differs when paths differ", () => {
    const base = parsedDiffIdentity({ ...EMPTY, oldPath: "a.ts" });
    const other = parsedDiffIdentity({ ...EMPTY, oldPath: "b.ts" });
    expect(base).not.toBe(other);
  });

  it("differs when hunk content changes", () => {
    const hunk = (heading: string): ParsedDiff => ({
      oldPath: null,
      newPath: null,
      hunks: [{ oldStart: 1, oldCount: 1, newStart: 1, newCount: 1, heading, changes: [] }],
    });
    expect(parsedDiffIdentity(hunk("one"))).not.toBe(parsedDiffIdentity(hunk("two")));
  });

  it("returns the same identity for structurally equal empty diffs", () => {
    expect(parsedDiffIdentity(EMPTY)).toBe(
      parsedDiffIdentity({ oldPath: null, newPath: null, hunks: [] }),
    );
  });
});
