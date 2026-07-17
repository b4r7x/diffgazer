import { describe, expect, it } from "vitest";
import type { AgentStreamEvent, StepEvent } from "../schemas/events/index.js";
import type { ReviewIssue } from "../schemas/review/index.js";
import {
  convertAgentEventsToLogEntries,
  convertReviewEventToLogEntry,
  getReviewEventLogSource,
} from "./event-to-log.js";

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

  it("converts only the requested absolute event range", () => {
    const events: AgentStreamEvent[] = Array.from({ length: 5 }, (_, index) => ({
      type: "agent_thinking",
      agent: "detective",
      thought: `event-${index}`,
      timestamp,
    }));

    const entries = convertAgentEventsToLogEntries(events, { start: 2, end: 4 });

    expect(entries.map((entry) => [entry.id, entry.message])).toEqual([
      ["agent_thinking-2", "event-2"],
      ["agent_thinking-3", "event-3"],
    ]);
  });

  it("exposes the same source and entry semantics for sparse range selection", () => {
    const event: AgentStreamEvent = {
      type: "agent_thinking",
      agent: "detective",
      thought: "checking",
      timestamp,
    };

    expect(getReviewEventLogSource(event)).toBe("Detective");
    expect(convertReviewEventToLogEntry(event, 42)).toMatchObject({
      id: "agent_thinking-42",
      source: "Detective",
      message: "checking",
    });
    expect(
      getReviewEventLogSource({
        type: "file_progress",
        agent: "detective",
        file: "src/index.ts",
        completed: 1,
        total: 1,
        timestamp,
      }),
    ).toBeUndefined();
  });

  it.each<[string, AgentStreamEvent | StepEvent, string | undefined]>([
    [
      "review_started",
      { type: "review_started", reviewId: "r1", filesTotal: 1, timestamp },
      undefined,
    ],
    ["step_start", { type: "step_start", step: "diff", timestamp }, undefined],
    ["step_complete", { type: "step_complete", step: "review", timestamp }, undefined],
    ["step_error", { type: "step_error", step: "report", error: "failed", timestamp }, undefined],
    [
      "orchestrator_start",
      { type: "orchestrator_start", agents: [detective], concurrency: 1, timestamp },
      undefined,
    ],
    [
      "agent_queued",
      { type: "agent_queued", agent: detective, position: 1, total: 1, timestamp },
      undefined,
    ],
    [
      "file_start",
      { type: "file_start", file: "src/a.ts", index: 0, total: 1, timestamp },
      undefined,
    ],
    [
      "file_complete",
      { type: "file_complete", file: "src/a.ts", index: 0, total: 1, timestamp },
      undefined,
    ],
    ["agent_start", { type: "agent_start", agent: detective, timestamp }, "Detective"],
    [
      "agent_thinking",
      { type: "agent_thinking", agent: "detective", thought: "checking", timestamp },
      "Detective",
    ],
    [
      "agent_progress",
      { type: "agent_progress", agent: "guardian", progress: 50, timestamp },
      "Guardian",
    ],
    [
      "agent_error",
      { type: "agent_error", agent: "optimizer", error: "failed", timestamp },
      "Optimizer",
    ],
    [
      "file_progress",
      {
        type: "file_progress",
        agent: "detective",
        file: "src/a.ts",
        completed: 1,
        total: 1,
        timestamp,
      },
      undefined,
    ],
    ["issue_found", { type: "issue_found", agent: "guardian", issue, timestamp }, "Guardian"],
    [
      "agent_complete",
      { type: "agent_complete", agent: "simplifier", issueCount: 0, timestamp },
      "Simplifier",
    ],
    [
      "orchestrator_complete",
      {
        type: "orchestrator_complete",
        totalIssues: 0,
        lensStats: [],
        filesAnalyzed: 1,
        timestamp,
      },
      undefined,
    ],
  ])("keeps %s source indexing identical to its rendered entry", (_, event, source) => {
    expect(getReviewEventLogSource(event)).toBe(source);
    expect(convertReviewEventToLogEntry(event, 0)?.source).toBe(source);
  });

  it.each<
    [
      string,
      AgentStreamEvent | StepEvent,
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
      { type: "step_error", step: "report", error: "Timeout reached", timestamp },
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
    [
      "file_progress",
      {
        type: "file_progress",
        agent: "detective",
        file: "src/app.ts",
        completed: 3,
        total: 10,
        timestamp,
      },
      { tag: "FILE", messageIncludes: ["Included", "src/app.ts", "in prompt", "3/10"] },
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
