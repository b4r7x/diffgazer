import { describe, it, expect } from "vitest";
import { computeDiff } from "../diff/compute.js";
import { computeWordSegments } from "../diff/word.js";

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
    const changes = result.hunks[0].changes;
    expect(changes.some((c) => c.type === "context")).toBe(true);
    expect(changes.some((c) => c.type === "remove" && c.content === "c")).toBe(true);
    expect(changes.some((c) => c.type === "add" && c.content === "X")).toBe(true);
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

describe("computeWordSegments", () => {
  it("marks changed word in a sentence", () => {
    const { old: oldSegs, new: newSegs } = computeWordSegments("hello world", "hello earth");
    expect(oldSegs.some((s) => s.changed && s.text === "world")).toBe(true);
    expect(newSegs.some((s) => s.changed && s.text === "earth")).toBe(true);
    expect(oldSegs.some((s) => !s.changed && s.text.includes("hello"))).toBe(true);
  });

  it("detects added word", () => {
    const { new: newSegs } = computeWordSegments("a b", "a b c");
    expect(newSegs.some((s) => s.changed && s.text.includes("c"))).toBe(true);
  });

  it("detects removed word", () => {
    const { old: oldSegs } = computeWordSegments("a b c", "a b");
    expect(oldSegs.some((s) => s.changed && s.text.includes("c"))).toBe(true);
  });

  it("preserves whitespace in unchanged segments", () => {
    const { old: oldSegs } = computeWordSegments("a  b", "a  b");
    const allText = oldSegs.map((s) => s.text).join("");
    expect(allText).toBe("a  b");
    expect(oldSegs.every((s) => !s.changed)).toBe(true);
  });

  it("merges consecutive segments with the same changed flag", () => {
    const { old: oldSegs, new: newSegs } = computeWordSegments("xxx", "yyy");
    expect(oldSegs).toHaveLength(1);
    expect(oldSegs[0].changed).toBe(true);
    expect(newSegs).toHaveLength(1);
    expect(newSegs[0].changed).toBe(true);
  });
});
