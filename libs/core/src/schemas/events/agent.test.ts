import { describe, expect, it } from "vitest";
import { LENS_IDS } from "../review/lens.js";
import { AGENT_METADATA, AgentStreamEventSchema, LENS_TO_AGENT, LensStatSchema } from "./agent.js";

describe("AgentStreamEventSchema", () => {
  it.each([
    {
      label: "orchestrator_start.concurrency",
      event: {
        type: "orchestrator_start",
        agents: [AGENT_METADATA.detective],
        concurrency: -1,
        timestamp: "now",
      },
    },
    {
      label: "orchestrator_start fractional concurrency",
      event: {
        type: "orchestrator_start",
        agents: [AGENT_METADATA.detective],
        concurrency: 1.5,
        timestamp: "now",
      },
    },
    {
      label: "orchestrator_start.requestedConcurrency",
      event: {
        type: "orchestrator_start",
        agents: [AGENT_METADATA.detective],
        concurrency: 1,
        requestedConcurrency: 1.5,
        timestamp: "now",
      },
    },
    {
      label: "agent_queued.position",
      event: {
        type: "agent_queued",
        agent: AGENT_METADATA.detective,
        position: -1,
        total: 1,
        timestamp: "now",
      },
    },
    {
      label: "agent_queued.total",
      event: {
        type: "agent_queued",
        agent: AGENT_METADATA.detective,
        position: 1,
        total: 1.5,
        timestamp: "now",
      },
    },
    {
      label: "file_progress.completed",
      event: {
        type: "file_progress",
        agent: "detective",
        file: "src/app.ts",
        completed: -1,
        total: 1,
        timestamp: "now",
      },
    },
    {
      label: "file_progress.total",
      event: {
        type: "file_progress",
        agent: "detective",
        file: "src/app.ts",
        completed: 1,
        total: 1.5,
        timestamp: "now",
      },
    },
    {
      label: "agent_complete.issueCount",
      event: {
        type: "agent_complete",
        agent: "detective",
        issueCount: -1,
        timestamp: "now",
      },
    },
    {
      label: "agent_complete.durationMs",
      event: {
        type: "agent_complete",
        agent: "detective",
        issueCount: 0,
        durationMs: 1.5,
        timestamp: "now",
      },
    },
    {
      label: "agent_complete.promptChars",
      event: {
        type: "agent_complete",
        agent: "detective",
        issueCount: 0,
        promptChars: -1,
        timestamp: "now",
      },
    },
    {
      label: "agent_complete.outputChars",
      event: {
        type: "agent_complete",
        agent: "detective",
        issueCount: 0,
        outputChars: 1.5,
        timestamp: "now",
      },
    },
    {
      label: "agent_complete.tokenEstimate",
      event: {
        type: "agent_complete",
        agent: "detective",
        issueCount: 0,
        tokenEstimate: -1,
        timestamp: "now",
      },
    },
    {
      label: "agent_complete.costUsd",
      event: {
        type: "agent_complete",
        agent: "detective",
        issueCount: 0,
        costUsd: -0.01,
        timestamp: "now",
      },
    },
    {
      label: "orchestrator_complete.totalIssues",
      event: {
        type: "orchestrator_complete",
        totalIssues: -1,
        lensStats: [{ lensId: "correctness", issueCount: 0, status: "success" }],
        filesAnalyzed: 0,
        timestamp: "now",
      },
    },
    {
      label: "orchestrator_complete lensStats issueCount",
      event: {
        type: "orchestrator_complete",
        totalIssues: 0,
        lensStats: [{ lensId: "correctness", issueCount: 1.5, status: "success" }],
        filesAnalyzed: 0,
        timestamp: "now",
      },
    },
    {
      label: "orchestrator_complete.filesAnalyzed",
      event: {
        type: "orchestrator_complete",
        totalIssues: 0,
        lensStats: [{ lensId: "correctness", issueCount: 0, status: "success" }],
        filesAnalyzed: -1,
        timestamp: "now",
      },
    },
    {
      label: "orchestrator_complete.droppedDuplicates",
      event: {
        type: "orchestrator_complete",
        totalIssues: 0,
        lensStats: [{ lensId: "correctness", issueCount: 0, status: "success" }],
        filesAnalyzed: 0,
        droppedDuplicates: 1.5,
        timestamp: "now",
      },
    },
    {
      label: "orchestrator_complete.droppedBelowThreshold",
      event: {
        type: "orchestrator_complete",
        totalIssues: 0,
        lensStats: [{ lensId: "correctness", issueCount: 0, status: "success" }],
        filesAnalyzed: 0,
        droppedBelowThreshold: -1,
        timestamp: "now",
      },
    },
    {
      label: "orchestrator_complete.droppedIncompleteProviderIssues",
      event: {
        type: "orchestrator_complete",
        totalIssues: 0,
        lensStats: [{ lensId: "correctness", issueCount: 0, status: "success" }],
        filesAnalyzed: 0,
        droppedIncompleteProviderIssues: 1.5,
        timestamp: "now",
      },
    },
    {
      label: "orchestrator_complete.batchesAnalyzed",
      event: {
        type: "orchestrator_complete",
        totalIssues: 0,
        lensStats: [{ lensId: "correctness", issueCount: 0, status: "success" }],
        filesAnalyzed: 0,
        batchesAnalyzed: -1,
        timestamp: "now",
      },
    },
    {
      label: "orchestrator_complete.batchesPlanned",
      event: {
        type: "orchestrator_complete",
        totalIssues: 0,
        lensStats: [{ lensId: "correctness", issueCount: 0, status: "success" }],
        filesAnalyzed: 0,
        batchesPlanned: 1.5,
        timestamp: "now",
      },
    },
  ])("rejects negative or fractional counters for $label", ({ event }) => {
    expect(AgentStreamEventSchema.safeParse(event).success).toBe(false);
  });

  it("accepts zero and positive agent-event counters at the wire boundary", () => {
    expect(
      AgentStreamEventSchema.safeParse({
        type: "orchestrator_start",
        agents: [AGENT_METADATA.detective],
        concurrency: 1,
        timestamp: "now",
      }).success,
    ).toBe(true);
    expect(
      AgentStreamEventSchema.safeParse({
        type: "orchestrator_start",
        agents: [AGENT_METADATA.detective],
        concurrency: 1,
        requestedConcurrency: 5,
        timestamp: "now",
      }).success,
    ).toBe(true);
    expect(
      AgentStreamEventSchema.safeParse({
        type: "agent_complete",
        agent: "detective",
        issueCount: 0,
        durationMs: 0,
        promptChars: 0,
        outputChars: 0,
        tokenEstimate: 0,
        costUsd: 0,
        timestamp: "now",
      }).success,
    ).toBe(true);
    expect(
      AgentStreamEventSchema.safeParse({
        type: "orchestrator_complete",
        totalIssues: 2,
        lensStats: [{ lensId: "correctness", issueCount: 0, status: "success" }],
        filesAnalyzed: 0,
        batchesAnalyzed: 1,
        batchesPlanned: 2,
        droppedDuplicates: 0,
        droppedBelowThreshold: 0,
        droppedIncompleteProviderIssues: 0,
        timestamp: "now",
      }).success,
    ).toBe(true);
  });

  it.each(LENS_IDS)("announces a decodable agent for the %s lens", (lensId) => {
    expect(
      AgentStreamEventSchema.safeParse({
        type: "orchestrator_start",
        agents: [AGENT_METADATA[LENS_TO_AGENT[lensId]]],
        concurrency: 1,
        timestamp: "now",
      }).success,
    ).toBe(true);
  });

  it.each(
    Object.values(AGENT_METADATA).flatMap((agent) =>
      Object.keys(LENS_TO_AGENT)
        .filter((lens) => lens !== agent.lens)
        .map((lens) => ({ agentId: agent.id, lens })),
    ),
  )("rejects mismatched agent metadata for $agentId/$lens", ({ agentId, lens }) => {
    expect(
      AgentStreamEventSchema.safeParse({
        type: "agent_start",
        agent: { ...AGENT_METADATA[agentId], lens },
        timestamp: "now",
      }).success,
    ).toBe(false);
  });

  it("validates the incomplete-provider-output diagnostic counter", () => {
    const event = {
      type: "orchestrator_complete",
      totalIssues: 1,
      lensStats: [{ lensId: "correctness", issueCount: 1, status: "success" }],
      filesAnalyzed: 1,
      droppedIncompleteProviderIssues: 2,
      timestamp: "now",
    };

    expect(AgentStreamEventSchema.safeParse(event).success).toBe(true);
    expect(AgentStreamEventSchema.safeParse({ ...event, summary: "Paid prose" }).success).toBe(
      false,
    );
    expect(
      AgentStreamEventSchema.safeParse({ ...event, droppedIncompleteProviderIssues: -1 }).success,
    ).toBe(false);
  });

  it("accepts lens stats with and without per-batch dispatch timing", () => {
    const legacyStat = { lensId: "correctness", issueCount: 1, status: "success" };
    const dispatch = {
      batchIndex: 0,
      startedAt: "2026-08-25T10:00:00.000Z",
      finishedAt: "2026-08-25T10:00:05.000Z",
      outcome: "completed",
    };
    expect(LensStatSchema.safeParse(legacyStat).success).toBe(true);
    expect(LensStatSchema.safeParse({ ...legacyStat, dispatches: [dispatch] }).success).toBe(true);
    expect(
      LensStatSchema.safeParse({
        ...legacyStat,
        dispatches: [{ ...dispatch, finishedAt: "not-a-datetime" }],
      }).success,
    ).toBe(false);
  });

  it.each([
    { type: "file_start", file: "src/app.ts", index: 0, total: 1, timestamp: "now" },
    { type: "file_complete", file: "src/app.ts", index: 0, total: 1, timestamp: "now" },
    { type: "tool_call", agent: "detective", tool: "grep", input: "needle", timestamp: "now" },
    {
      type: "tool_result",
      agent: "detective",
      tool: "grep",
      timestamp: "now",
    },
    { type: "tool_start", agent: "detective", tool: "grep", input: "needle", timestamp: "now" },
    {
      type: "tool_end",
      agent: "detective",
      tool: "grep",
      status: "success",
      timestamp: "now",
    },
  ])("rejects the producerless $type event", (event) => {
    expect(AgentStreamEventSchema.safeParse(event).success).toBe(false);
  });
});
