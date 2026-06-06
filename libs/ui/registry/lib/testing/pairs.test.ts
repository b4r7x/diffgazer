import { describe, expect, it } from "vitest";
import { requireValue } from "../../testing/assertions";
import { collectEditPairs, type EditPairGroup } from "../diff/pairs";
import type { DiffChange } from "../diff/parse";

const change = (
  type: DiffChange["type"],
  content: string,
): DiffChange => ({ type, content, oldLine: null, newLine: null });

const isGroup = (item: DiffChange | EditPairGroup): item is EditPairGroup =>
  !("type" in item);

describe("collectEditPairs", () => {
  it("yields context changes individually", () => {
    const result = [...collectEditPairs([change("context", "x")])];
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ type: "context", content: "x" });
  });

  it("groups adjacent removes and adds into one edit pair", () => {
    const result = [...collectEditPairs([
      change("remove", "a"),
      change("remove", "b"),
      change("add", "c"),
    ])];
    expect(result).toHaveLength(1);
    const [group] = result;
    if (!group || !isGroup(group)) throw new Error("expected group");
    expect(group.removes.map((c) => c.content)).toEqual(["a", "b"]);
    expect(group.adds.map((c) => c.content)).toEqual(["c"]);
  });

  it("yields an adds-only group when there are no removes", () => {
    const result = [...collectEditPairs([change("add", "only")])];
    const [group] = result;
    if (!group || !isGroup(group)) throw new Error("expected group");
    expect(group.removes).toEqual([]);
    expect(group.adds.map((c) => c.content)).toEqual(["only"]);
  });

  it("splits edit groups around an intervening context change", () => {
    const result = [...collectEditPairs([
      change("remove", "a"),
      change("context", "ctx"),
      change("add", "b"),
    ])];
    expect(result).toHaveLength(3);
    expect(isGroup(requireValue(result[0], "diff pair item 0"))).toBe(true);
    expect(result[1]).toMatchObject({ type: "context", content: "ctx" });
    expect(isGroup(requireValue(result[2], "diff pair item 2"))).toBe(true);
  });
});
