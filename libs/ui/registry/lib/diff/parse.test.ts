import { describe, expect, it } from "vitest";
import { parseDiff } from "./parse";

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

  it("treats '--'-prefixed removed lines inside a hunk as removals, not file headers", () => {
    const patch = [
      "diff --git a/notes.txt b/notes.txt",
      "--- a/notes.txt",
      "+++ b/notes.txt",
      "@@ -1,3 +1,2 @@",
      " keep",
      "--- drop this comment",
      " end",
    ].join("\n");

    const [file] = parseDiff(patch);
    if (!file) throw new Error("expected file");
    const [hunk] = file.hunks;
    if (!hunk) throw new Error("expected hunk");

    expect(file.oldPath).toBe("notes.txt");
    expect(hunk.changes[1]).toMatchObject({
      type: "remove",
      content: "-- drop this comment",
      oldLine: 2,
    });
  });

  it("treats '++'-prefixed added lines inside a hunk as additions, not file headers", () => {
    const patch = [
      "diff --git a/notes.txt b/notes.txt",
      "--- a/notes.txt",
      "+++ b/notes.txt",
      "@@ -1,2 +1,3 @@",
      " keep",
      "+++ keep this flag",
      " end",
    ].join("\n");

    const [file] = parseDiff(patch);
    if (!file) throw new Error("expected file");
    const [hunk] = file.hunks;
    if (!hunk) throw new Error("expected hunk");

    expect(file.newPath).toBe("notes.txt");
    expect(hunk.changes[1]).toMatchObject({
      type: "add",
      content: "++ keep this flag",
      newLine: 2,
    });
  });

  it("parses a patch ending with a trailing newline without a phantom context line", () => {
    const patch = `${[
      "diff --git a/file.ts b/file.ts",
      "--- a/file.ts",
      "+++ b/file.ts",
      "@@ -1,1 +1,1 @@",
      "-old",
      "+new",
    ].join("\n")}\n`;

    const [file] = parseDiff(patch);
    if (!file) throw new Error("expected file");
    const [hunk] = file.hunks;
    if (!hunk) throw new Error("expected hunk");

    expect(hunk.changes).toHaveLength(2);
  });

  it("parses a new-file patch without keeping /dev/null as a path", () => {
    const addedPatch = [
      "diff --git a/added.ts b/added.ts",
      "new file mode 100644",
      "--- /dev/null",
      "+++ b/added.ts",
      "@@ -0,0 +1 @@",
      "+added",
    ].join("\n");
    const deletedPatch = [
      "diff --git a/deleted.ts b/deleted.ts",
      "deleted file mode 100644",
      "--- a/deleted.ts",
      "+++ /dev/null",
      "@@ -1 +0,0 @@",
      "-deleted",
    ].join("\n");

    const [added] = parseDiff(addedPatch);
    const [deleted] = parseDiff(deletedPatch);

    expect(added?.oldPath).toBeNull();
    expect(added?.newPath).toBe("added.ts");
    expect(added?.hunks[0]).toMatchObject({ oldStart: 0, oldCount: 0, newStart: 1, newCount: 1 });
    expect(deleted?.oldPath).toBe("deleted.ts");
    expect(deleted?.newPath).toBeNull();
    expect(deleted?.hunks[0]).toMatchObject({ oldStart: 1, oldCount: 1, newStart: 0, newCount: 0 });
  });

  it("removes standard unified-diff timestamps from file paths", () => {
    const patch = [
      "--- a/src/app.ts\t2026-07-15 09:30:00.000000000 +0200",
      "+++ b/src/app.ts\t2026-07-15 09:31:00.000000000 +0200",
      "@@ -1 +1 @@",
      "-before",
      "+after",
    ].join("\n");

    expect(parseDiff(patch)[0]).toMatchObject({
      oldPath: "src/app.ts",
      newPath: "src/app.ts",
    });
  });

  it("keeps timestamped /dev/null headers pathless", () => {
    const patch = [
      "--- /dev/null\t1970-01-01 00:00:00.000000000 +0000",
      "+++ b/added.ts\t2026-07-15 09:31:00.000000000 +0200",
      "@@ -0,0 +1 @@",
      "+added",
    ].join("\n");

    expect(parseDiff(patch)[0]).toMatchObject({ oldPath: null, newPath: "added.ts" });
  });

  it("decodes tabs in quoted Git paths without treating them as timestamp delimiters", () => {
    const patch = [
      '--- "a/src/before\\tname.ts"\t2026-07-15 09:30:00 +0200',
      '+++ "b/src/after\\tname.ts"\t2026-07-15 09:31:00 +0200',
      "@@ -1 +1 @@",
      "-before",
      "+after",
    ].join("\n");

    expect(parseDiff(patch)[0]).toMatchObject({
      oldPath: "src/before\tname.ts",
      newPath: "src/after\tname.ts",
    });
  });

  it("decodes Git's octal-escaped UTF-8 form of a non-ASCII path for both old and new headers", () => {
    // git quotes `żółć.ts` as octal bytes under default core.quotepath.
    const quoted = "\\305\\274\\303\\263\\305\\202\\304\\207.ts";
    const patch = [
      `--- "a/${quoted}"`,
      `+++ "b/${quoted}"`,
      "@@ -1 +1 @@",
      "-before",
      "+after",
    ].join("\n");

    expect(parseDiff(patch)[0]).toMatchObject({
      oldPath: "żółć.ts",
      newPath: "żółć.ts",
    });
  });

  it("keeps consecutive standard header pairs as separate files without diff --git lines", () => {
    const patch = [
      "--- src/one.ts",
      "+++ src/one.ts",
      "@@ -1 +1 @@",
      "-one before",
      "+one after",
      "--- src/two.ts",
      "+++ src/two.ts",
      "@@ -1 +1 @@",
      "-two before",
      "+two after",
    ].join("\n");

    const files = parseDiff(patch);

    expect(files).toHaveLength(2);
    expect(files[0]).toMatchObject({
      oldPath: "src/one.ts",
      newPath: "src/one.ts",
      hunks: [{ changes: [{ content: "one before" }, { content: "one after" }] }],
    });
    expect(files[1]).toMatchObject({
      oldPath: "src/two.ts",
      newPath: "src/two.ts",
      hunks: [{ changes: [{ content: "two before" }, { content: "two after" }] }],
    });
  });

  it("separates added and deleted files with /dev/null headers without git sentinels", () => {
    const patch = [
      "--- /dev/null",
      "+++ added.ts",
      "@@ -0,0 +1 @@",
      "+added",
      "--- deleted.ts",
      "+++ /dev/null",
      "@@ -1 +0,0 @@",
      "-deleted",
    ].join("\n");

    expect(parseDiff(patch)).toMatchObject([
      { oldPath: null, newPath: "added.ts", hunks: [{ changes: [{ content: "added" }] }] },
      { oldPath: "deleted.ts", newPath: null, hunks: [{ changes: [{ content: "deleted" }] }] },
    ]);
  });

  it("returns empty array for empty diff input", () => {
    expect(parseDiff("")).toEqual([]);
  });

  it("returns empty array for malformed input", () => {
    const result = parseDiff("not a diff\nrandom text\n@@ bad @@");
    expect(result).toEqual([]);
  });
});
