import { describe, expect, it } from "vitest";
import { lcsTableCellCost } from "./lcs";
import type { DiffChange } from "./parse";
import { annotateWordDiff, computeWordSegments, createWordDiffBudget } from "./word";

describe("computeWordSegments", () => {
  it("marks changed word in a sentence", () => {
    const { old: oldSegs, new: newSegs } = computeWordSegments("hello world", "hello earth");
    expect(oldSegs.some((s) => s.changed && s.text === "world")).toBe(true);
    expect(newSegs.some((s) => s.changed && s.text === "earth")).toBe(true);
    expect(oldSegs.some((s) => !s.changed && s.text.includes("hello"))).toBe(true);
  });

  it.each([
    {
      name: "detects an added word",
      oldContent: "a b",
      newContent: "a b c",
      old: [{ text: "a b", changed: false }],
      new: [
        { text: "a b", changed: false },
        { text: " c", changed: true },
      ],
    },
    {
      name: "detects a removed word",
      oldContent: "a b c",
      newContent: "a b",
      old: [
        { text: "a b", changed: false },
        { text: " c", changed: true },
      ],
      new: [{ text: "a b", changed: false }],
    },
  ])("$name", ({ oldContent, newContent, old, new: expectedNew }) => {
    const { old: oldSegs, new: newSegs } = computeWordSegments(oldContent, newContent);
    expect(oldSegs).toEqual(old);
    expect(newSegs).toEqual(expectedNew);
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

  it("debits exactly the LCS table cell cost of the compared words", () => {
    const budget = createWordDiffBudget();
    // "hello world" / "hello earth" each split into 3 tokens (word, space, word),
    // so the table costs lcsTableCellCost(3, 3) = 16 cells.
    computeWordSegments("hello world", "hello earth", budget);
    expect(budget.remainingCells).toBe(50_000 - lcsTableCellCost(3, 3));
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

  it.each([
    {
      name: "add-surplus",
      changes: [
        change("remove", "only removed", 1, null),
        change("add", "first added", null, 1),
        change("add", "second added", null, 2),
      ],
      surplusType: "add" as const,
      surplusContent: "second added",
    },
    {
      name: "remove-surplus",
      changes: [
        change("remove", "first removed", 1, null),
        change("remove", "second removed", 2, null),
        change("add", "only added", null, 1),
      ],
      surplusType: "remove" as const,
      surplusContent: "second removed",
    },
  ])("leaves the $name change without word segments", ({
    changes,
    surplusType,
    surplusContent,
  }) => {
    const result = annotateWordDiff(changes);
    const surplus = result.find((c) => c.type === surplusType && c.content === surplusContent);
    expect(surplus?.wordSegments).toBeUndefined();
  });
});
