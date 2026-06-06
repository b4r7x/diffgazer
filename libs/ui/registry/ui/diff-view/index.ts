"use client";

export type {
  ChangeType,
  DiffChange,
  DiffHunk,
  DiffInput,
  DiffInputCompare,
  DiffInputParsed,
  DiffInputPatch,
  ParsedDiff,
} from "@/lib/diff";
export { computeDiff, parseDiff, resolveDiffInput } from "@/lib/diff";
export {
  DiffView,
  type DiffViewDensity,
  type DiffViewPalette,
  type DiffViewProps,
  type DiffViewVariant,
} from "./diff-view";
