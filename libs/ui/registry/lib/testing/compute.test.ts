import { describe, expect, it } from "vitest";
import { computeDiff } from "../diff/compute";

describe("computeDiff", () => {
  it("returns no hunks for identical input", () => {
    const result = computeDiff("hello\nworld", "hello\nworld");
    expect(result.hunks).toHaveLength(0);
  });

  it("returns hunks for fully different input", () => {
    const result = computeDiff("aaa\nbbb", "xxx\nyyy");
    expect(result.hunks.length).toBeGreaterThan(0);
    const changes = result.hunks.flatMap((h) => h.changes);
    const removes = changes.filter((c) => c.type === "remove");
    const adds = changes.filter((c) => c.type === "add");
    expect(removes).toHaveLength(2);
    expect(adds).toHaveLength(2);
  });

  it("produces mixed changes with context lines", () => {
    const before = "a\nb\nc\nd\ne";
    const after = "a\nb\nX\nd\ne";
    const result = computeDiff(before, after);
    expect(result.hunks).toHaveLength(1);
    const [hunk] = result.hunks;
    if (!hunk) throw new Error("expected hunk");
    expect(hunk.changes.some((c) => c.type === "context")).toBe(true);
    expect(hunk.changes.some((c) => c.type === "remove" && c.content === "c")).toBe(true);
    expect(hunk.changes.some((c) => c.type === "add" && c.content === "X")).toBe(true);
  });

  it("groups nearby changes into one hunk and distant changes into separate hunks", () => {
    const lines = Array.from({ length: 20 }, (_, i) => String(i));
    const modified = [...lines];
    modified[1] = "changed-1";
    modified[18] = "changed-18";
    const result = computeDiff(lines.join("\n"), modified.join("\n"));
    expect(result.hunks.length).toBe(2);
  });

});
