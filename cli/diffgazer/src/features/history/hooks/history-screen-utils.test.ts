import assert from "node:assert/strict";
import test, { describe } from "node:test";
import type { ReviewMetadata, ReviewIssue } from "@diffgazer/core/schemas/review";
import {
  buildHistorySeverityCounts,
  HISTORY_ZONE_ORDER,
  mapHistoryRun,
  nextHistoryZone,
  sortIssuesBySeverity,
} from "./history-screen-utils.js";

function makeReview(overrides: Partial<ReviewMetadata> = {}): ReviewMetadata {
  return {
    id: "aaaa-bbbb-cccc-dddd",
    projectPath: "/repo",
    mode: "unstaged",
    branch: "main",
    profile: null,
    lenses: [],
    createdAt: "2026-05-14T10:00:00.000Z",
    durationMs: 4_000,
    fileCount: 3,
    issueCount: 4,
    blockerCount: 1,
    highCount: 1,
    mediumCount: 1,
    lowCount: 1,
    nitCount: 0,
    ...overrides,
  } as ReviewMetadata;
}

function makeIssue(severity: ReviewIssue["severity"], overrides: Partial<ReviewIssue> = {}): ReviewIssue {
  return {
    id: `${severity}-1`,
    severity,
    category: "correctness",
    title: `${severity} issue`,
    file: "src/x.ts",
    line_start: 1,
    line_end: 1,
    rationale: "",
    recommendation: "",
    suggested_patch: null,
    confidence: 0.9,
    symptom: "",
    whyItMatters: "",
    evidence: [],
    ...overrides,
  } as ReviewIssue;
}

describe("nextHistoryZone", () => {
  test("cycles search -> timeline -> runs -> insights -> search", () => {
    assert.equal(nextHistoryZone("search"), "timeline");
    assert.equal(nextHistoryZone("timeline"), "runs");
    assert.equal(nextHistoryZone("runs"), "insights");
    assert.equal(nextHistoryZone("insights"), "search");
  });

  test("zone order list contains all four zones", () => {
    assert.deepEqual(HISTORY_ZONE_ORDER, ["search", "timeline", "runs", "insights"]);
  });

  test("applying nextHistoryZone four times returns to the start", () => {
    let zone = HISTORY_ZONE_ORDER[0]!;
    for (let i = 0; i < HISTORY_ZONE_ORDER.length; i++) {
      zone = nextHistoryZone(zone);
    }
    assert.equal(zone, HISTORY_ZONE_ORDER[0]);
  });
});

describe("mapHistoryRun", () => {
  test("maps metadata to display fields used by the runs list", () => {
    const run = mapHistoryRun(
      makeReview({
        id: "11112222-3333-4444-5555-666677778888",
        branch: "feature/x",
        mode: "unstaged",
      }),
    );
    assert.equal(run.id, "11112222-3333-4444-5555-666677778888");
    assert.equal(run.displayId, "#1111");
    assert.equal(run.branch, "feature/x");
    assert.ok(typeof run.summary === "string" && run.summary.length > 0);
    assert.ok(typeof run.timestamp === "string");
  });

  test("staged review surfaces the 'Staged' branch label", () => {
    const run = mapHistoryRun(makeReview({ mode: "staged", branch: "main" }));
    assert.equal(run.branch, "Staged");
  });

  test("passed run shows the 'Passed' summary text", () => {
    const run = mapHistoryRun(
      makeReview({
        issueCount: 0,
        blockerCount: 0,
        highCount: 0,
        mediumCount: 0,
        lowCount: 0,
        nitCount: 0,
      }),
    );
    assert.match(run.summary, /Passed/i);
  });
});

describe("buildHistorySeverityCounts", () => {
  test("returns null when there is no selected run", () => {
    assert.equal(buildHistorySeverityCounts(null), null);
  });

  test("forwards the five severity counts straight through", () => {
    const counts = buildHistorySeverityCounts(
      makeReview({
        blockerCount: 1,
        highCount: 2,
        mediumCount: 3,
        lowCount: 4,
        nitCount: 5,
      }),
    );
    assert.deepEqual(counts, { blocker: 1, high: 2, medium: 3, low: 4, nit: 5 });
  });
});

describe("sortIssuesBySeverity", () => {
  test("returns empty array when no issues", () => {
    assert.deepEqual(sortIssuesBySeverity(undefined), []);
    assert.deepEqual(sortIssuesBySeverity([]), []);
  });

  test("orders blocker > high > medium > low > nit", () => {
    const issues: ReviewIssue[] = [
      makeIssue("low"),
      makeIssue("blocker"),
      makeIssue("nit"),
      makeIssue("medium"),
      makeIssue("high"),
    ];
    const sorted = sortIssuesBySeverity(issues).map((i) => i.severity);
    assert.deepEqual(sorted, ["blocker", "high", "medium", "low", "nit"]);
  });

  test("does not mutate the input array", () => {
    const issues = [makeIssue("low"), makeIssue("blocker")];
    const before = issues.map((i) => i.severity);
    sortIssuesBySeverity(issues);
    assert.deepEqual(
      issues.map((i) => i.severity),
      before,
    );
  });

  test("preserves relative order within a single severity (stable-style ordering)", () => {
    const issues: ReviewIssue[] = [
      makeIssue("high", { id: "h1" }),
      makeIssue("high", { id: "h2" }),
      makeIssue("blocker", { id: "b1" }),
      makeIssue("high", { id: "h3" }),
    ];
    const sortedIds = sortIssuesBySeverity(issues).map((i) => i.id);
    assert.deepEqual(sortedIds, ["b1", "h1", "h2", "h3"]);
  });
});
