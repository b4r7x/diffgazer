import type { ParsedDiff, DiffInput } from "./parse.js";
import { parseDiff } from "./parse.js";
import { computeDiff } from "./compute.js";

const EMPTY: ParsedDiff = { oldPath: null, newPath: null, hunks: [] };

export function resolveDiffInput(input: DiffInput): ParsedDiff {
  if ("diff" in input && input.diff != null) return input.diff;
  if ("patch" in input && input.patch != null) return parseDiff(input.patch)[0] ?? EMPTY;
  if ("before" in input && input.before != null && "after" in input && input.after != null) {
    return computeDiff(input.before, input.after);
  }
  return EMPTY;
}
