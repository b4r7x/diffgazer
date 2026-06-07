import { describe, expect, it } from "vitest";
import type { AgentStreamEvent, EnrichEvent, StepEvent } from "../schemas/events/index.js";
import type { ReviewIssue } from "../schemas/review/index.js";
import { convertAgentEventsToLogEntries } from "./event-to-log.js";

const timestamp = "2025-02-01T10:00:00Z";

const detective = {
  id: "detective",
  lens: "correctness",
  name: "Detective",
  badgeLabel: "DET",
  badgeVariant: "info",
  description: "Finds bugs",
} as const;

const guardian = {
  id: "guardian",
  lens: "security",
  name: "Guardian",
  badgeLabel: "SEC",
  badgeVariant: "warning",
  description: "Security",
} as const;

const issue: ReviewIssue = {
  id: "issue-1",
  title: "SQL Injection risk",
  severity: "high",
  category: "security",
  file: "src/db.ts",
  line_start: 42,
  line_end: 42,
  rationale: "Unparameterized query",
  recommendation: "Use parameterized queries",
  suggested_patch: null,
  confidence: 0.9,
  symptom: "User input flows into raw SQL",
  whyItMatters: "Allows arbitrary database access",
  evidence: [],
};

describe("convertAgentEventsToLogEntries", () => {
  it("returns empty array for no events", () => {
    expect(convertAgentEventsToLogEntries([])).toEqual([]);
  });

  it.each<
    [
      string,
      AgentStreamEvent | StepEvent | EnrichEvent,
      {
        tag?: string;
        tagType?: string;
        source?: string;
        isWarning?: boolean;
        isError?: boolean;
        messageIncludes?: string[];
      },
    ]
  >([
    [
      "step_start",
      { type: "step_start", step: "diff", timestamp },
      { tag: "STEP", tagType: "system", messageIncludes: ["Collect diff"] },
    ],
    [
      "step_complete",
      { type: "step_complete", step: "review", timestamp },
      { tag: "DONE", messageIncludes: ["complete"] },
    ],
    [
      "step_error",
      { type: "step_error", step: "enrich", error: "Timeout reached", timestamp },
      { tag: "FAIL", tagType: "error", isWarning: true, messageIncludes: ["Timeout reached"] },
    ],
    [
      "review_started plural",
      { type: "review_started", reviewId: "r1", filesTotal: 5, timestamp },
      { tag: "START", messageIncludes: ["5 files"] },
    ],
    [
      "review_started singular",
      { type: "review_started", reviewId: "r1", filesTotal: 1, timestamp },
      { tag: "START", messageIncludes: ["1 file "] },
    ],
    [
      "enrich_progress",
      {
        type: "enrich_progress",
        issueId: "issue-1",
        enrichmentType: "blame",
        status: "complete",
        timestamp,
      },
      { tag: "ENRICH", tagType: "system", messageIncludes: ["blame", "complete", "issue-1"] },
    ],
    [
      "orchestrator_start",
      { type: "orchestrator_start", agents: [detective], concurrency: 3, timestamp },
      { tag: "ORCH", messageIncludes: ["1 agent", "concurrency 3"] },
    ],
    [
      "agent_queued",
      { type: "agent_queued", agent: detective, position: 1, total: 5, timestamp },
      { tag: "QUEUE", messageIncludes: ["Detective", "1/5"] },
    ],
    [
      "agent_start",
      { type: "agent_start", agent: guardian, timestamp },
      { tag: "SEC", tagType: "agent", source: "Guardian" },
    ],
    [
      "agent_progress",
      {
        type: "agent_progress",
        agent: "optimizer",
        progress: 50,
        message: "Halfway done",
        timestamp,
      },
      { messageIncludes: ["50%", "Halfway done"] },
    ],
    [
      "agent_error",
      { type: "agent_error", agent: "detective", error: "API timeout", timestamp },
      { tagType: "error", isError: true, messageIncludes: ["API timeout"] },
    ],
    [
      "tool_call",
      {
        type: "tool_call",
        agent: "detective",
        tool: "readFileContext",
        input: "src/index.ts:1-20",
        timestamp,
      },
      { tag: "TOOL", tagType: "tool", messageIncludes: ["readFileContext"] },
    ],
    [
      "tool_result",
      {
        type: "tool_result",
        agent: "guardian",
        tool: "readFileContext",
        summary: "Read 50 lines",
        timestamp,
      },
      { tag: "TOOL", messageIncludes: ["Read 50 lines"] },
    ],
    [
      "issue_found",
      { type: "issue_found", agent: "guardian", issue, timestamp },
      { tagType: "warning", isWarning: true, messageIncludes: ["SQL Injection risk"] },
    ],
    [
      "agent_complete plural",
      { type: "agent_complete", agent: "detective", issueCount: 3, timestamp },
      { messageIncludes: ["3 issues"] },
    ],
    [
      "agent_complete singular",
      { type: "agent_complete", agent: "detective", issueCount: 1, timestamp },
      { messageIncludes: ["1 issue"] },
    ],
    [
      "orchestrator_complete",
      {
        type: "orchestrator_complete",
        summary: "Review done",
        totalIssues: 7,
        lensStats: [],
        filesAnalyzed: 10,
        timestamp,
      },
      { tag: "DONE", messageIncludes: ["7 issues"] },
    ],
    [
      "file_start",
      { type: "file_start", file: "src/app.ts", index: 2, total: 10, timestamp },
      { tag: "FILE", messageIncludes: ["src/app.ts", "3/10"] },
    ],
    [
      "file_complete",
      { type: "file_complete", file: "src/app.ts", index: 2, total: 10, timestamp },
      { tag: "DONE", messageIncludes: ["src/app.ts"] },
    ],
  ])("maps %s", (_, event, expected) => {
    const [entry] = convertAgentEventsToLogEntries([event]);

    expect(entry).toEqual(
      expect.objectContaining({
        ...(expected.tag && { tag: expected.tag }),
        ...(expected.tagType && { tagType: expected.tagType }),
        ...(expected.source && { source: expected.source }),
        ...(expected.isWarning !== undefined && { isWarning: expected.isWarning }),
        ...(expected.isError !== undefined && { isError: expected.isError }),
      }),
    );
    for (const text of expected.messageIncludes ?? []) {
      expect(entry?.message).toContain(text);
    }
  });

  it("truncates long agent thoughts", () => {
    const [entry] = convertAgentEventsToLogEntries([
      { type: "agent_thinking", agent: "detective", thought: "A".repeat(200), timestamp },
    ]);

    expect(entry?.tagType).toBe("thinking");
    expect(entry?.message.length).toBeLessThanOrEqual(100);
  });

  it("preserves event order and generates unique ids", () => {
    const entries = convertAgentEventsToLogEntries([
      { type: "review_started", reviewId: "r1", filesTotal: 3, timestamp },
      { type: "agent_complete", agent: "detective", issueCount: 1, timestamp },
      { type: "agent_complete", agent: "guardian", issueCount: 0, timestamp },
    ]);

    const ids = entries.map((entry) => entry.id);
    expect(ids.every((id) => id.length > 0)).toBe(true);
    expect(new Set(ids).size).toBe(entries.length);
    expect(entries.map((entry) => entry.tag)).toEqual(["START", "DET", "SEC"]);
    expect(entries[0]?.message).toContain("3 files");
    expect(entries[1]?.message).toContain("1 issue");
    expect(entries[1]?.message).not.toContain("1 issues");
  });
});
