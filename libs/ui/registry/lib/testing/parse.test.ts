import { describe, expect, it } from "vitest";
import { parseDiff } from "../diff/parse";

describe("parseDiff", () => {
  const basicPatch = [
    "diff --git a/file.ts b/file.ts",
    "--- a/file.ts",
    "+++ b/file.ts",
    "@@ -1,3 +1,3 @@ function foo",
    " line1",
    "-old",
    "+new",
    " line3",
  ].join("\n");

  it("parses a standard unified diff with hunk header", () => {
    const [file] = parseDiff(basicPatch);
    if (!file) throw new Error("expected file");
    expect(file.oldPath).toBe("file.ts");
    expect(file.newPath).toBe("file.ts");
    expect(file.hunks).toHaveLength(1);
    const [hunk] = file.hunks;
    if (!hunk) throw new Error("expected hunk");
    expect(hunk.oldStart).toBe(1);
    expect(hunk.newStart).toBe(1);
    expect(hunk.heading).toBe("function foo");
  });

  it("parses added, removed, and context lines", () => {
    const [file] = parseDiff(basicPatch);
    if (!file) throw new Error("expected file");
    const [hunk] = file.hunks;
    if (!hunk) throw new Error("expected hunk");
    const changes = hunk.changes;
    expect(changes[0]).toMatchObject({ type: "context", content: "line1" });
    expect(changes[1]).toMatchObject({ type: "remove", content: "old", oldLine: 2 });
    expect(changes[2]).toMatchObject({ type: "add", content: "new", newLine: 2 });
    expect(changes[3]).toMatchObject({ type: "context", content: "line3" });
  });

  it("detects rename (skips rename metadata lines)", () => {
    const renamePatch = [
      "diff --git a/old.ts b/new.ts",
      "similarity index 90%",
      "rename from old.ts",
      "rename to new.ts",
      "--- a/old.ts",
      "+++ b/new.ts",
      "@@ -1,1 +1,1 @@",
      "-old",
      "+new",
    ].join("\n");
    const [file] = parseDiff(renamePatch);
    if (!file) throw new Error("expected file");
    expect(file.oldPath).toBe("old.ts");
    expect(file.newPath).toBe("new.ts");
    expect(file.hunks[0]?.changes).toHaveLength(2);
  });

  it("handles mode change metadata", () => {
    const modePatch = [
      "diff --git a/file.sh b/file.sh",
      "old mode 100644",
      "new mode 100755",
      "--- a/file.sh",
      "+++ b/file.sh",
      "@@ -1,1 +1,1 @@",
      "-a",
      "+b",
    ].join("\n");
    const [file] = parseDiff(modePatch);
    if (!file) throw new Error("expected file");
    expect(file.hunks).toHaveLength(1);
  });

  it("returns empty array for empty diff input", () => {
    expect(parseDiff("")).toEqual([]);
  });

  it("returns empty array for malformed input", () => {
    const result = parseDiff("not a diff\nrandom text\n@@ bad @@");
    expect(result).toEqual([]);
  });
});
