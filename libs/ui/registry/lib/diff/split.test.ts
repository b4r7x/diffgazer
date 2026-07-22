import { describe, expect, it } from "vitest";
import type { DiffChange } from "./parse";
import { toSplitRows } from "./split";

describe("toSplitRows", () => {
  const mkChange = (
    type: DiffChange["type"],
    content: string,
    oldLine: number | null,
    newLine: number | null,
  ): DiffChange => ({
    type,
    content,
    oldLine,
    newLine,
  });

  it("produces split rows from a single hunk", () => {
    const hunks = [
      {
        oldStart: 1,
        oldCount: 2,
        newStart: 1,
        newCount: 2,
        heading: "",
        changes: [
          mkChange("context", "same", 1, 1),
          mkChange("remove", "old", 2, null),
          mkChange("add", "new", null, 2),
        ],
      },
    ];
    const rows = toSplitRows(hunks, false);
    expect(rows[0]).toMatchObject({ kind: "separator" });
    expect(rows[1]).toMatchObject({
      kind: "change",
      left: { type: "context" },
      right: { type: "context" },
    });
    expect(rows[2]).toMatchObject({
      kind: "change",
      left: { type: "remove" },
      right: { type: "add" },
    });
    if (rows[2]?.kind === "change") {
      expect(rows[2].left.wordSegments).toBeUndefined();
      expect(rows[2].right.wordSegments).toBeUndefined();
    }
  });

  it("produces empty right cell for unmatched removes", () => {
    const hunks = [
      {
        oldStart: 1,
        oldCount: 2,
        newStart: 1,
        newCount: 0,
        heading: "",
        changes: [mkChange("remove", "a", 1, null), mkChange("remove", "b", 2, null)],
      },
    ];
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
    const hunks = [
      {
        oldStart: 1,
        oldCount: 0,
        newStart: 1,
        newCount: 2,
        heading: "",
        changes: [mkChange("add", "x", null, 1), mkChange("add", "y", null, 2)],
      },
    ];
    const rows = toSplitRows(hunks, false);
    const changeRows = rows.filter((r) => r.kind === "change");
    for (const row of changeRows) {
      if (row.kind === "change") {
        expect(row.left.type).toBe("empty");
        expect(row.right.type).toBe("add");
      }
    }
  });

  it("adds word segments when wordDiff is true", () => {
    const hunks = [
      {
        oldStart: 1,
        oldCount: 1,
        newStart: 1,
        newCount: 1,
        heading: "",
        changes: [
          mkChange("remove", "hello world", 1, null),
          mkChange("add", "hello earth", null, 1),
        ],
      },
    ];
    const rows = toSplitRows(hunks, true);
    const changeRow = rows.find((r) => r.kind === "change" && r.left.type === "remove");
    expect(changeRow).toBeDefined();
    if (changeRow?.kind !== "change") throw new Error("expected change row");

    const { left, right } = changeRow;
    expect(left.wordSegments?.some((s) => s.changed && s.text === "world")).toBe(true);
    expect(right.wordSegments?.some((s) => s.changed && s.text === "earth")).toBe(true);
    expect(left.wordSegments?.map((s) => s.text).join("")).toBe(left.content);
    expect(right.wordSegments?.map((s) => s.text).join("")).toBe(right.content);
  });
});
