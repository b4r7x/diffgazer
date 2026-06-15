import { computeDiff } from "./compute";
import type { DiffInput, ParsedDiff } from "./parse";
import { parseDiff } from "./parse";

const EMPTY: ParsedDiff = { oldPath: null, newPath: null, hunks: [] };

/** Resolves any accepted diff input shape to one parsed diff object. */
export function resolveDiffInput(input: DiffInput): ParsedDiff {
  if ("diff" in input && input.diff != null) return input.diff;
  if ("patch" in input && input.patch != null) return parseDiff(input.patch)[0] ?? EMPTY;
  if ("before" in input && input.before != null && "after" in input && input.after != null) {
    return computeDiff(input.before, input.after);
  }
  return EMPTY;
}
