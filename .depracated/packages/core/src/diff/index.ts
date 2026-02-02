// Type definitions only - kept here because core/review/triage.ts depends on ParsedDiff
// Implementation moved to:
// - CLI: apps/cli/src/lib/diff/ (for classifyDiffLine, parseDiff, filterDiffByFiles)
// - CLI: apps/cli/src/lib/diff/ (for applyPatch)
// - Server: apps/server/src/diff/ (for server API)

export * from "./types.js";
