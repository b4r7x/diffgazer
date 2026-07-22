import { describe, expect, it } from "vitest";
import { computeDiff, NO_NEWLINE_MARKER } from "./compute";

describe("computeDiff", () => {
  it("returns no hunks for identical input", () => {
    const result = computeDiff("hello\nworld", "hello\nworld");
    expect(result.hunks).toHaveLength(0);
  });

  it("returns no hunks for identical input beyond the LCS cell budget", () => {
    const input = Array.from({ length: 501 }, (_, index) => `line ${index}`).join("\n");

    expect(computeDiff(input, input).hunks).toHaveLength(0);
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

  it.each([
    {
      before: "",
      after: "created\n",
      expected: { oldStart: 0, oldCount: 0, newStart: 1, newCount: 1 },
    },
    {
      before: "deleted\n",
      after: "",
      expected: { oldStart: 1, oldCount: 1, newStart: 0, newCount: 0 },
    },
  ])("uses line zero for the absent side of a creation or deletion", ({
    before,
    after,
    expected,
  }) => {
    expect(computeDiff(before, after).hunks[0]).toEqual(expect.objectContaining(expected));
  });

  it.each([
    {
      before: "alpha\n",
      after: "alpha",
      markerType: "add",
    },
    {
      before: "alpha",
      after: "alpha\n",
      markerType: "remove",
    },
  ] as const)("preserves an EOF newline change as a visible $markerType marker", (input) => {
    const result = computeDiff(input.before, input.after);

    expect(result.hunks).toHaveLength(1);
    expect(result.hunks[0]).toEqual(
      expect.objectContaining({ oldStart: 1, oldCount: 1, newStart: 1, newCount: 1 }),
    );
    expect(result.hunks[0]?.changes).toContainEqual(
      expect.objectContaining({
        type: input.markerType,
        content: NO_NEWLINE_MARKER,
        oldLine: null,
        newLine: null,
      }),
    );
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
    modified[4] = "changed-4";
    modified[18] = "changed-18";
    const result = computeDiff(lines.join("\n"), modified.join("\n"));
    expect(result.hunks.length).toBe(2);

    const addedContents = result.hunks.map((hunk) =>
      hunk.changes.filter((c) => c.type === "add").map((c) => c.content),
    );
    expect(addedContents).toEqual([["changed-1", "changed-4"], ["changed-18"]]);
  });
});
