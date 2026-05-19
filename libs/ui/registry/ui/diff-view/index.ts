"use client";

export {
  DiffView,
  type DiffViewProps,
  type DiffViewVariant,
  type DiffViewDensity,
  type DiffViewPalette,
} from "./diff-view.js";
export { parseDiff, computeDiff, resolveDiffInput } from "@/lib/diff";
export type {
  ParsedDiff,
  DiffHunk,
  DiffChange,
  ChangeType,
  DiffInput,
  DiffInputPatch,
  DiffInputCompare,
  DiffInputParsed,
} from "@/lib/diff";
