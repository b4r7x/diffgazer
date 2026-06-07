import { describe, expect, it } from "vitest";
import type { DiffChange } from "../diff/parse";
import { annotateWordDiff, computeWordSegments, createWordDiffBudget } from "../diff/word";

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
    expect(oldSegs[0]?.changed).toBe(true);
    expect(newSegs).toHaveLength(1);
    expect(newSegs[0]?.changed).toBe(true);
  });

  it("returns whole-line changed segments when the cell budget is exceeded", () => {
    const budget = createWordDiffBudget(1);
    const { old: oldSegs, new: newSegs } = computeWordSegments("a b c", "x y z", budget);
    expect(oldSegs).toEqual([{ text: "a b c", changed: true }]);
    expect(newSegs).toEqual([{ text: "x y z", changed: true }]);
  });
});

describe("createWordDiffBudget", () => {
  it("seeds the default cell budget", () => {
    expect(createWordDiffBudget().remainingCells).toBe(50_000);
  });

  it("accepts an explicit cell budget", () => {
    expect(createWordDiffBudget(10).remainingCells).toBe(10);
  });

  it("is consumed as word comparisons run", () => {
    const budget = createWordDiffBudget();
    computeWordSegments("hello world", "hello earth", budget);
    expect(budget.remainingCells).toBeLessThan(50_000);
  });
});

describe("annotateWordDiff", () => {
  const change = (
    type: DiffChange["type"],
    content: string,
    oldLine: number | null,
    newLine: number | null,
  ): DiffChange => ({ type, content, oldLine, newLine });

  it("passes context changes through unannotated", () => {
    const result = annotateWordDiff([change("context", "same", 1, 1)]);
    expect(result).toHaveLength(1);
    expect(result[0]?.wordSegments).toBeUndefined();
  });

  it("annotates paired remove/add changes with word segments", () => {
    const result = annotateWordDiff([
      change("remove", "hello world", 1, null),
      change("add", "hello earth", null, 1),
    ]);
    const removed = result.find((c) => c.type === "remove");
    const added = result.find((c) => c.type === "add");
    expect(removed?.wordSegments?.some((s) => s.changed && s.text === "world")).toBe(true);
    expect(added?.wordSegments?.some((s) => s.changed && s.text === "earth")).toBe(true);
  });

  it("leaves unpaired removes and adds without word segments", () => {
    const result = annotateWordDiff([
      change("remove", "only removed", 1, null),
      change("add", "first added", null, 1),
      change("add", "second added", null, 2),
    ]);
    const extraAdd = result.find((c) => c.type === "add" && c.content === "second added");
    expect(extraAdd?.wordSegments).toBeUndefined();
  });
});
