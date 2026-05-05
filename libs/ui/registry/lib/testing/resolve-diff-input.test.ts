import { describe, it, expect } from "vitest"
import { resolveDiffInput } from "../diff/resolve.js"
import type { ParsedDiff } from "../diff/parse.js"

const EMPTY: ParsedDiff = { oldPath: null, newPath: null, hunks: [] }

describe("resolveDiffInput", () => {
  it("returns diff object directly when { diff } is provided", () => {
    const diff: ParsedDiff = {
      oldPath: "a.ts",
      newPath: "b.ts",
      hunks: [{ oldStart: 1, oldCount: 1, newStart: 1, newCount: 1, heading: "", changes: [] }],
    }
    expect(resolveDiffInput({ diff })).toBe(diff)
  })

  it("parses patch string and returns first file", () => {
    const patch = `--- a/file.ts
+++ b/file.ts
@@ -1,3 +1,3 @@
 line1
-old
+new
 line3`
    const result = resolveDiffInput({ patch })
    expect(result.hunks).toHaveLength(1)
    expect(result.hunks[0].changes).toHaveLength(4)
  })

  it("returns empty ParsedDiff for empty patch string", () => {
    const result = resolveDiffInput({ patch: "" })
    expect(result).toEqual(EMPTY)
  })

  it("computes diff from { before, after }", () => {
    const result = resolveDiffInput({ before: "hello", after: "world" })
    expect(result.hunks.length).toBeGreaterThan(0)
  })

  it("returns no hunks for identical before/after", () => {
    const result = resolveDiffInput({ before: "", after: "" })
    expect(result.hunks).toHaveLength(0)
  })

})
