import { describe, expect, it } from "vitest";
import type { LensStat } from "../../schemas/events/index.js";
import {
  buildCleanRunFactLine,
  buildCleanRunStatement,
  buildModelValue,
  buildScopeValue,
  CLEAN_RUN_RECEIPT_LABELS,
  isCleanRun,
} from "./clean-run.js";

const succeeded: LensStat[] = [
  { lensId: "correctness", issueCount: 0, status: "success" },
  { lensId: "security", issueCount: 0, status: "success" },
];
const oneFailed: LensStat[] = [
  { lensId: "correctness", issueCount: 0, status: "success" },
  { lensId: "security", issueCount: 0, status: "failed", errorCode: "STREAM_ERROR" },
];

describe("isCleanRun", () => {
  it("is clean only when the run finished, every lens reported and nothing was found", () => {
    expect(isCleanRun({ issueCount: 0, lensStats: succeeded, terminalOutcome: "completed" })).toBe(
      true,
    );
  });

  it("treats a missing terminal outcome, and an old record without the incomplete-answer fields, as a completed clean run", () => {
    expect(isCleanRun({ issueCount: 0, lensStats: succeeded })).toBe(true);
    expect(isCleanRun({ issueCount: 0 })).toBe(true);
  });

  it("is not clean when the run found something", () => {
    expect(isCleanRun({ issueCount: 1, lensStats: succeeded })).toBe(false);
  });

  it("is not clean when a lens failed, even with zero issues", () => {
    expect(isCleanRun({ issueCount: 0, lensStats: oneFailed })).toBe(false);
    expect(isCleanRun({ issueCount: 0, failedLensCount: 1 })).toBe(false);
  });

  it("is not clean when a lens answered incompletely, even with zero issues", () => {
    const oneSalvaged: LensStat[] = [
      { lensId: "correctness", issueCount: 0, status: "success" },
      { lensId: "security", issueCount: 0, status: "success", droppedCandidateCount: 2 },
    ];
    expect(isCleanRun({ issueCount: 0, lensStats: oneSalvaged })).toBe(false);
    expect(isCleanRun({ issueCount: 0, salvagedLensCount: 1 })).toBe(false);
  });

  it("is not clean when the run ended on a failed terminal outcome", () => {
    expect(isCleanRun({ issueCount: 0, lensStats: succeeded, terminalOutcome: "timed-out" })).toBe(
      false,
    );
    expect(isCleanRun({ issueCount: 0, terminalOutcome: "cancelled" })).toBe(false);
  });
});

describe("buildCleanRunStatement", () => {
  it("states the unqualified pass when nothing was hidden", () => {
    expect(buildCleanRunStatement({})).toBe("Passed — no issues found");
    expect(buildCleanRunStatement({ droppedBelowThreshold: 0, minSeverity: "medium" })).toBe(
      "Passed — no issues found",
    );
  });

  it("qualifies the pass by the floor that hid findings", () => {
    expect(buildCleanRunStatement({ droppedBelowThreshold: 4, minSeverity: "medium" })).toBe(
      "No issues at or above medium",
    );
  });

  it("still refuses the unqualified pass when the floor is unknown", () => {
    expect(buildCleanRunStatement({ droppedBelowThreshold: 2 })).toBe(
      "No issues at or above the severity threshold",
    );
  });
});

describe("buildCleanRunFactLine", () => {
  it("names what was read, by how many lenses, for how long", () => {
    expect(buildCleanRunFactLine({ fileCount: 12, lensCount: 5, durationMs: 8200 })).toBe(
      "No issues across 12 files · 5 lenses · 8s",
    );
  });

  it("keeps singular counts and an unknown duration readable", () => {
    expect(buildCleanRunFactLine({ fileCount: 1, lensCount: 1, durationMs: undefined })).toBe(
      "No issues across 1 file · 1 lens · --",
    );
  });
});

describe("buildScopeValue", () => {
  it("names the mode, what was read and what changed", () => {
    expect(buildScopeValue({ mode: "staged", fileCount: 12, additions: 248, deletions: 96 })).toBe(
      "Staged · 12 files · +248 -96",
    );
  });

  it("keeps a measured zero and omits the fields the record does not carry", () => {
    expect(buildScopeValue({ mode: "unstaged", fileCount: 0 })).toBe("Unstaged · 0 files");
    expect(buildScopeValue({ fileCount: 1, additions: 3 })).toBe("1 file · +3");
    expect(buildScopeValue({ deletions: 3 })).toBe("-3");
  });

  it("has no row to show when the record carries no scope at all", () => {
    expect(buildScopeValue({})).toBeNull();
  });
});

describe("buildModelValue", () => {
  it("names the model against the product that ran it", () => {
    expect(buildModelValue("deepseek", "deepseek-chat")).toBe("DeepSeek / deepseek-chat");
  });

  it("keeps naming the product on a dual-pool run, so history is never retro-relabelled", () => {
    // A Go run's receipt stores the Go endpoint, but a record is a record: the
    // design declined retro-relabelling history, so every opencode-zen run —
    // past or new, whichever pool billed it — reads as the product here. Only
    // the live surfaces name the pool.
    expect(buildModelValue("opencode-zen", "deepseek-v4-flash")).toBe(
      "OpenCode Zen / DeepSeek V4 Flash",
    );
  });

  it("falls back to the bare id when no product names it, and omits an unknown model", () => {
    expect(buildModelValue(undefined, "deepseek-chat")).toBe("deepseek-chat");
    expect(buildModelValue(undefined, undefined)).toBeNull();
  });
});

describe("CLEAN_RUN_RECEIPT_LABELS", () => {
  it("keeps the shared ledger row labels", () => {
    expect(CLEAN_RUN_RECEIPT_LABELS).toEqual({
      scope: "Scope",
      lenses: "Lenses",
      model: "Model",
      elapsed: "Elapsed",
      run: "Run",
    });
  });
});
