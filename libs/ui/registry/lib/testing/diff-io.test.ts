import { describe, it, expect } from "vitest";
import { parseDiff } from "../diff/parse.js";
import { toSplitRows } from "../diff/split.js";
import type { DiffChange } from "../diff/parse.js";

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
    expect(file.oldPath).toBe("file.ts");
    expect(file.newPath).toBe("file.ts");
    expect(file.hunks).toHaveLength(1);
    expect(file.hunks[0].oldStart).toBe(1);
    expect(file.hunks[0].newStart).toBe(1);
    expect(file.hunks[0].heading).toBe("function foo");
  });

  it("parses added, removed, and context lines", () => {
    const [file] = parseDiff(basicPatch);
    const changes = file.hunks[0].changes;
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
    expect(file.oldPath).toBe("old.ts");
    expect(file.newPath).toBe("new.ts");
    expect(file.hunks[0].changes).toHaveLength(2);
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
    expect(file.hunks).toHaveLength(1);
  });

  it("returns empty array for empty diff input", () => {
    expect(parseDiff("")).toEqual([]);
  });

  it("handles malformed input gracefully", () => {
    const result = parseDiff("not a diff\nrandom text\n@@ bad @@");
    expect(result).toEqual([]);
  });
});

describe("toSplitRows", () => {
  const mkChange = (type: DiffChange["type"], content: string, oldLine: number | null, newLine: number | null): DiffChange => ({
    type, content, oldLine, newLine,
  });

  it("produces split rows from a single hunk", () => {
    const hunks = [{
      oldStart: 1, oldCount: 2, newStart: 1, newCount: 2, heading: "",
      changes: [
        mkChange("context", "same", 1, 1),
        mkChange("remove", "old", 2, null),
        mkChange("add", "new", null, 2),
      ],
    }];
    const rows = toSplitRows(hunks, false);
    expect(rows[0]).toMatchObject({ kind: "separator" });
    expect(rows[1]).toMatchObject({ kind: "change", left: { type: "context" }, right: { type: "context" } });
    expect(rows[2]).toMatchObject({ kind: "change", left: { type: "remove" }, right: { type: "add" } });
  });

  it("produces empty right cell for unmatched removes", () => {
    const hunks = [{
      oldStart: 1, oldCount: 2, newStart: 1, newCount: 0, heading: "",
      changes: [
        mkChange("remove", "a", 1, null),
        mkChange("remove", "b", 2, null),
      ],
    }];
    const rows = toSplitRows(hunks, false);
    const changeRows = rows.filter((r) => r.kind === "change");
    for (const row of changeRows) {
      if (row.kind === "change") {
        expect(row.left.type).toBe("remove");
        expect(row.right.type).toBe("empty");
      }
    }
  });

  it("produces empty left cell for unmatched adds", () => {
    const hunks = [{
      oldStart: 1, oldCount: 0, newStart: 1, newCount: 2, heading: "",
      changes: [
        mkChange("add", "x", null, 1),
        mkChange("add", "y", null, 2),
      ],
    }];
    const rows = toSplitRows(hunks, false);
    const changeRows = rows.filter((r) => r.kind === "change");
    for (const row of changeRows) {
      if (row.kind === "change") {
        expect(row.left.type).toBe("empty");
        expect(row.right.type).toBe("add");
      }
    }
  });

  it("produces context on both sides for context rows", () => {
    const hunks = [{
      oldStart: 1, oldCount: 1, newStart: 1, newCount: 1, heading: "",
      changes: [mkChange("context", "same", 1, 1)],
    }];
    const rows = toSplitRows(hunks, false);
    const row = rows.find((r) => r.kind === "change");
    expect(row).toBeDefined();
    if (row?.kind === "change") {
      expect(row.left.type).toBe("context");
      expect(row.right.type).toBe("context");
    }
  });

  it("adds word segments when wordDiff is true", () => {
    const hunks = [{
      oldStart: 1, oldCount: 1, newStart: 1, newCount: 1, heading: "",
      changes: [
        mkChange("remove", "hello world", 1, null),
        mkChange("add", "hello earth", null, 1),
      ],
    }];
    const rows = toSplitRows(hunks, true);
    const changeRow = rows.find((r) => r.kind === "change" && r.left.type === "remove");
    if (changeRow?.kind === "change") {
      expect(changeRow.left.wordSegments).toBeDefined();
      expect(changeRow.right.wordSegments).toBeDefined();
    }
  });
});
