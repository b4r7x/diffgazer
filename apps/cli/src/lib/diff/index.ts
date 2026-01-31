// Type definitions come from core
export * from "@repo/core/diff";

// Implementation in CLI
export { parseDiff, filterDiffByFiles, classifyDiffLine } from "./parser.js";
export type { DiffLineType } from "./parser.js";
export { applyPatch } from "./applier.js";
export type { PatchError, PatchErrorCode, ApplyPatchToFileResult } from "./applier.js";
