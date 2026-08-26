import { describe, expect, it } from "vitest";
import type { AgentStreamEvent, LensStat, StepEvent } from "../schemas/events/index.js";
import { AGENT_METADATA } from "../schemas/events/index.js";
import { makeIssue } from "../testing/factories.js";
import {
  convertReviewEventsToLogEntries,
  convertReviewEventToLogEntry,
  getReviewEventLogSource,
} from "./event-to-log.js";

const timestamp = "2025-02-01T10:00:00Z";

const detective = AGENT_METADATA.detective;
const guardian = AGENT_METADATA.guardian;

const issue = makeIssue({ title: "SQL Injection risk", category: "security" });

describe("convertReviewEventsToLogEntries", () => {
  it("returns empty array for no events", () => {
    expect(convertReviewEventsToLogEntries([])).toEqual([]);
  });

  it("converts only the requested absolute event range", () => {
    const events: AgentStreamEvent[] = Array.from({ length: 5 }, (_, index) => ({
      type: "agent_thinking",
      agent: "detective",
      thought: `event-${index}`,
      timestamp,
    }));

    const entries = convertReviewEventsToLogEntries(events, { start: 2, end: 4 });

    expect(entries.map((entry) => [entry.id, entry.message])).toEqual([
      ["agent_thinking-2", "event-2"],
      ["agent_thinking-3", "event-3"],
    ]);
  });

  it("converts an event at an arbitrary absolute index", () => {
    const event: AgentStreamEvent = {
      type: "agent_thinking",
      agent: "detective",
      thought: "checking",
      timestamp,
    };

    expect(convertReviewEventToLogEntry(event, 42)).toMatchObject({
      id: "agent_thinking-42",
      message: "checking",
    });
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
    expect(convertReviewEventToLogEntry(event, 0).source).toBe(source);
  });

  it("gives file_progress its agent's source while the FILE row stays unlabeled", () => {
    const event: AgentStreamEvent = {
      type: "file_progress",
      agent: "detective",
      file: "src/a.ts",
      completed: 1,
      total: 1,
      timestamp,
    };

    expect(getReviewEventLogSource(event)).toBe("Detective");
    expect(convertReviewEventToLogEntry(event, 0).source).toBeUndefined();
  });

  it.each<
    [
      string,
      AgentStreamEvent | StepEvent,
      {
        tag: string;
        tagType: string;
        source?: string;
        isWarning?: boolean;
        isError?: boolean;
        messageIncludes?: string[];
        messageExcludes?: string[];
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
      { tag: "DONE", tagType: "system", messageIncludes: ["complete"] },
    ],
    [
      "fatal step_error",
      { type: "step_error", step: "report", error: "Timeout reached", timestamp },
      {
        tag: "FAIL",
        tagType: "error",
        isError: true,
        messageIncludes: ["Timeout reached"],
      },
    ],
    [
      "non-fatal context step_error",
      { type: "step_error", step: "context", error: "Context unavailable", timestamp },
      {
        tag: "FAIL",
        tagType: "error",
        isWarning: true,
        messageIncludes: ["Context unavailable"],
      },
    ],
    [
      "review_started plural",
      { type: "review_started", reviewId: "r1", filesTotal: 5, timestamp },
      { tag: "START", tagType: "system", messageIncludes: ["5 files"] },
    ],
    [
      "review_started singular",
      { type: "review_started", reviewId: "r1", filesTotal: 1, timestamp },
      { tag: "START", tagType: "system", messageIncludes: ["1 file "] },
    ],
    [
      "orchestrator_start",
      { type: "orchestrator_start", agents: [detective], concurrency: 3, timestamp },
      {
        tag: "ORCH",
        tagType: "system",
        messageIncludes: ["1 agent", "concurrency 3"],
        messageExcludes: ["provider limits parallel requests"],
      },
    ],
    [
      "orchestrator_start clamped concurrency",
      {
        type: "orchestrator_start",
        agents: [detective],
        concurrency: 1,
        requestedConcurrency: 5,
        timestamp,
      },
      {
        tag: "ORCH",
        tagType: "system",
        messageIncludes: ["concurrency 1", "provider limits parallel requests", "5 requested"],
      },
    ],
    [
      "orchestrator_start unclamped requestedConcurrency",
      {
        type: "orchestrator_start",
        agents: [detective],
        concurrency: 3,
        requestedConcurrency: 3,
        timestamp,
      },
      {
        tag: "ORCH",
        tagType: "system",
        messageIncludes: ["concurrency 3"],
        messageExcludes: ["provider limits parallel requests"],
      },
    ],
    [
      "agent_queued",
      { type: "agent_queued", agent: detective, position: 1, total: 5, timestamp },
      { tag: "QUEUE", tagType: "agent", messageIncludes: ["Detective", "1/5"] },
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
      {
        tag: "PERF",
        tagType: "agent",
        source: "Optimizer",
        messageIncludes: ["50%", "Halfway done"],
      },
    ],
    [
      "agent_error",
      { type: "agent_error", agent: "detective", error: "API timeout", timestamp },
      {
        tag: "DET",
        tagType: "error",
        isError: true,
        source: "Detective",
        messageIncludes: ["API timeout"],
      },
    ],
    [
      "issue_found",
      { type: "issue_found", agent: "guardian", issue, timestamp },
      {
        tag: "SEC",
        tagType: "warning",
        isWarning: true,
        source: "Guardian",
        messageIncludes: ["SQL Injection risk"],
      },
    ],
    [
      "agent_complete plural",
      { type: "agent_complete", agent: "detective", issueCount: 3, timestamp },
      {
        tag: "DET",
        tagType: "agent",
        source: "Detective",
        messageIncludes: ["3 issues"],
      },
    ],
    [
      "agent_complete singular",
      { type: "agent_complete", agent: "detective", issueCount: 1, timestamp },
      {
        tag: "DET",
        tagType: "agent",
        source: "Detective",
        messageIncludes: ["1 issue"],
        messageExcludes: ["1 issues"],
      },
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
      { tag: "DONE", tagType: "system", messageIncludes: ["7 issues"] },
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
      {
        tag: "FILE",
        tagType: "system",
        messageIncludes: ["Included", "src/app.ts", "in prompt", "3/10"],
      },
    ],
  ])("maps %s", (_, event, expected) => {
    const [entry] = convertReviewEventsToLogEntries([event]);

    expect(entry).toEqual(
      expect.objectContaining({
        tag: expected.tag,
        tagType: expected.tagType,
        ...(expected.source !== undefined ? { source: expected.source } : {}),
        ...(expected.isWarning !== undefined ? { isWarning: expected.isWarning } : {}),
        ...(expected.isError !== undefined ? { isError: expected.isError } : {}),
      }),
    );
    for (const text of expected.messageIncludes ?? []) {
      expect(entry?.message).toContain(text);
    }
    for (const text of expected.messageExcludes ?? []) {
      expect(entry?.message).not.toContain(text);
    }
  });

  it("reports how far orchestration got when lenses failed", () => {
    const lensStats: LensStat[] = [
      { lensId: "correctness", issueCount: 1, status: "success" },
      { lensId: "security", issueCount: 1, status: "success" },
      { lensId: "performance", issueCount: 0, status: "failed", errorCode: "STREAM_ERROR" },
      { lensId: "simplicity", issueCount: 0, status: "failed", errorCode: "STREAM_ERROR" },
      { lensId: "tests", issueCount: 0, status: "failed", errorCode: "STREAM_ERROR" },
    ];

    const [entry] = convertReviewEventsToLogEntries([
      { type: "orchestrator_complete", totalIssues: 2, lensStats, filesAnalyzed: 4, timestamp },
    ]);

    expect(entry?.message).toBe("Orchestration finished: 2 issues from 2 of 5 lenses (3 failed)");
    expect(entry?.message).not.toContain("Review complete");
  });

  it("keeps the complete wording when every lens reported", () => {
    const lensStats: LensStat[] = [
      { lensId: "correctness", issueCount: 1, status: "success" },
      { lensId: "security", issueCount: 0, status: "success" },
    ];

    const [entry] = convertReviewEventsToLogEntries([
      { type: "orchestrator_complete", totalIssues: 1, lensStats, filesAnalyzed: 4, timestamp },
    ]);

    expect(entry?.message).toBe("Review complete: 1 issue found");
  });

  it("truncates long agent thoughts", () => {
    const [entry] = convertReviewEventsToLogEntries([
      { type: "agent_thinking", agent: "detective", thought: "A".repeat(200), timestamp },
    ]);

    expect(entry?.tagType).toBe("thinking");
    expect(entry?.message.length).toBeLessThanOrEqual(100);
  });

  it("preserves event order and generates unique ids", () => {
    const entries = convertReviewEventsToLogEntries([
      { type: "review_started", reviewId: "r1", filesTotal: 3, timestamp },
      { type: "agent_complete", agent: "detective", issueCount: 1, timestamp },
      { type: "agent_complete", agent: "guardian", issueCount: 0, timestamp },
    ]);

    const ids = entries.map((entry) => entry.id);
    expect(ids.every((id) => id.length > 0)).toBe(true);
    expect(new Set(ids).size).toBe(entries.length);
    expect(entries.map((entry) => entry.tag)).toEqual(["START", "DET", "SEC"]);
  });
});
