import { describe, it, expect } from "vitest";
import { convertAgentEventsToLogEntries } from "./event-to-log.js";
import type { AgentStreamEvent, StepEvent, EnrichEvent } from "@diffgazer/schemas/events";

function makeTimestamp() {
  return "2025-02-01T10:00:00Z";
}

describe("convertAgentEventsToLogEntries", () => {
  it("returns empty array for no events", () => {
    expect(convertAgentEventsToLogEntries([])).toEqual([]);
  });

  describe("step events", () => {
    it("converts step_start to log entry", () => {
      const event: StepEvent = {
        type: "step_start",
        step: "diff",
        timestamp: makeTimestamp(),
      };

      const [entry] = convertAgentEventsToLogEntries([event]);

      expect(entry.tag).toBe("STEP");
      expect(entry.tagType).toBe("system");
      expect(entry.message).toContain("Collect diff");
    });

    it("converts step_complete to log entry", () => {
      const event: StepEvent = {
        type: "step_complete",
        step: "review",
        timestamp: makeTimestamp(),
      };

      const [entry] = convertAgentEventsToLogEntries([event]);

      expect(entry.tag).toBe("DONE");
      expect(entry.message).toContain("complete");
    });

    it("converts step_error to warning log entry", () => {
      const event: StepEvent = {
        type: "step_error",
        step: "enrich",
        error: "Timeout reached",
        timestamp: makeTimestamp(),
      };

      const [entry] = convertAgentEventsToLogEntries([event]);

      expect(entry.tag).toBe("FAIL");
      expect(entry.tagType).toBe("error");
      expect(entry.isWarning).toBe(true);
      expect(entry.message).toContain("Timeout reached");
    });

    it("converts review_started with file count", () => {
      const event: StepEvent = {
        type: "review_started",
        reviewId: "r1",
        filesTotal: 5,
        timestamp: makeTimestamp(),
      };

      const [entry] = convertAgentEventsToLogEntries([event]);

      expect(entry.tag).toBe("START");
      expect(entry.message).toContain("5 files");
    });

    it("uses singular 'file' for 1 file", () => {
      const event: StepEvent = {
        type: "review_started",
        reviewId: "r1",
        filesTotal: 1,
        timestamp: makeTimestamp(),
      };

      const [entry] = convertAgentEventsToLogEntries([event]);

      expect(entry.message).toContain("1 file ");
    });
  });

  describe("enrich events", () => {
    it("converts enrich_progress to log entry", () => {
      const event: EnrichEvent = {
        type: "enrich_progress",
        issueId: "issue-1",
        enrichmentType: "blame",
        status: "complete",
        timestamp: makeTimestamp(),
      };

      const [entry] = convertAgentEventsToLogEntries([event]);

      expect(entry.tag).toBe("ENRICH");
      expect(entry.tagType).toBe("system");
      expect(entry.message).toContain("blame");
      expect(entry.message).toContain("complete");
      expect(entry.message).toContain("issue-1");
    });
  });

  describe("agent events", () => {
    it("converts orchestrator_start", () => {
      const event: AgentStreamEvent = {
        type: "orchestrator_start",
        agents: [
          { id: "detective", lens: "correctness", name: "Detective", badgeLabel: "DET", badgeVariant: "info", description: "Finds bugs" },
        ],
        concurrency: 3,
        timestamp: makeTimestamp(),
      };

      const [entry] = convertAgentEventsToLogEntries([event]);

      expect(entry.tag).toBe("ORCH");
      expect(entry.message).toContain("1 agents");
      expect(entry.message).toContain("concurrency 3");
    });

    it("converts agent_queued", () => {
      const event: AgentStreamEvent = {
        type: "agent_queued",
        agent: { id: "detective", lens: "correctness", name: "Detective", badgeLabel: "DET", badgeVariant: "info", description: "Finds bugs" },
        position: 1,
        total: 5,
        timestamp: makeTimestamp(),
      };

      const [entry] = convertAgentEventsToLogEntries([event]);

      expect(entry.tag).toBe("QUEUE");
      expect(entry.message).toContain("Detective");
      expect(entry.message).toContain("1/5");
    });

    it("converts agent_start", () => {
      const event: AgentStreamEvent = {
        type: "agent_start",
        agent: { id: "guardian", lens: "security", name: "Guardian", badgeLabel: "SEC", badgeVariant: "warning", description: "Security" },
        timestamp: makeTimestamp(),
      };

      const [entry] = convertAgentEventsToLogEntries([event]);

      expect(entry.tag).toBe("SEC");
      expect(entry.tagType).toBe("agent");
      expect(entry.source).toBe("Guardian");
    });

    it("converts agent_thinking with truncation", () => {
      const event: AgentStreamEvent = {
        type: "agent_thinking",
        agent: "detective",
        thought: "A".repeat(200),
        timestamp: makeTimestamp(),
      };

      const [entry] = convertAgentEventsToLogEntries([event]);

      expect(entry.tagType).toBe("thinking");
      expect(entry.message.length).toBeLessThanOrEqual(100);
    });

    it("converts agent_progress", () => {
      const event: AgentStreamEvent = {
        type: "agent_progress",
        agent: "optimizer",
        progress: 50,
        message: "Halfway done",
        timestamp: makeTimestamp(),
      };

      const [entry] = convertAgentEventsToLogEntries([event]);

      expect(entry.message).toContain("50%");
      expect(entry.message).toContain("Halfway done");
    });

    it("converts agent_error", () => {
      const event: AgentStreamEvent = {
        type: "agent_error",
        agent: "detective",
        error: "API timeout",
        timestamp: makeTimestamp(),
      };

      const [entry] = convertAgentEventsToLogEntries([event]);

      expect(entry.tagType).toBe("error");
      expect(entry.isError).toBe(true);
      expect(entry.message).toContain("API timeout");
    });

    it("converts tool_call", () => {
      const event: AgentStreamEvent = {
        type: "tool_call",
        agent: "detective",
        tool: "readFileContext",
        input: "src/index.ts:1-20",
        timestamp: makeTimestamp(),
      };

      const [entry] = convertAgentEventsToLogEntries([event]);

      expect(entry.tag).toBe("TOOL");
      expect(entry.tagType).toBe("tool");
      expect(entry.message).toContain("readFileContext");
    });

    it("converts tool_result", () => {
      const event: AgentStreamEvent = {
        type: "tool_result",
        agent: "guardian",
        tool: "readFileContext",
        summary: "Read 50 lines from src/app.ts",
        timestamp: makeTimestamp(),
      };

      const [entry] = convertAgentEventsToLogEntries([event]);

      expect(entry.tag).toBe("TOOL");
      expect(entry.message).toContain("Read 50 lines");
    });

    it("converts issue_found", () => {
      const event: AgentStreamEvent = {
        type: "issue_found",
        agent: "guardian",
        issue: {
          id: "issue-1",
          title: "SQL Injection risk",
          severity: "high",
          category: "security",
          file: "src/db.ts",
          line: 42,
          description: "Unparameterized query",
          codeSnippet: "query(input)",
          suggestion: "Use parameterized queries",
        },
        timestamp: makeTimestamp(),
      };

      const [entry] = convertAgentEventsToLogEntries([event]);

      expect(entry.tagType).toBe("warning");
      expect(entry.isWarning).toBe(true);
      expect(entry.message).toContain("SQL Injection risk");
    });

    it("converts agent_complete with issue count", () => {
      const event: AgentStreamEvent = {
        type: "agent_complete",
        agent: "detective",
        issueCount: 3,
        timestamp: makeTimestamp(),
      };

      const [entry] = convertAgentEventsToLogEntries([event]);

      expect(entry.message).toContain("3 issues");
    });

    it("converts agent_complete with 1 issue (singular)", () => {
      const event: AgentStreamEvent = {
        type: "agent_complete",
        agent: "detective",
        issueCount: 1,
        timestamp: makeTimestamp(),
      };

      const [entry] = convertAgentEventsToLogEntries([event]);

      expect(entry.message).toContain("1 issue");
      expect(entry.message).not.toContain("1 issues");
    });

    it("converts orchestrator_complete", () => {
      const event: AgentStreamEvent = {
        type: "orchestrator_complete",
        summary: "Review done",
        totalIssues: 7,
        lensStats: [],
        filesAnalyzed: 10,
        timestamp: makeTimestamp(),
      };

      const [entry] = convertAgentEventsToLogEntries([event]);

      expect(entry.tag).toBe("DONE");
      expect(entry.message).toContain("7 issues");
    });

    it("converts file_start", () => {
      const event: AgentStreamEvent = {
        type: "file_start",
        file: "src/app.ts",
        index: 2,
        total: 10,
        timestamp: makeTimestamp(),
      };

      const [entry] = convertAgentEventsToLogEntries([event]);

      expect(entry.tag).toBe("FILE");
      expect(entry.message).toContain("src/app.ts");
      expect(entry.message).toContain("3/10");
    });

    it("converts file_complete", () => {
      const event: AgentStreamEvent = {
        type: "file_complete",
        file: "src/app.ts",
        index: 2,
        total: 10,
        timestamp: makeTimestamp(),
      };

      const [entry] = convertAgentEventsToLogEntries([event]);

      expect(entry.tag).toBe("DONE");
      expect(entry.message).toContain("src/app.ts");
    });
  });

  it("filters null entries and preserves order", () => {
    const events: (AgentStreamEvent | StepEvent)[] = [
      { type: "review_started", reviewId: "r1", filesTotal: 3, timestamp: makeTimestamp() },
      { type: "agent_complete", agent: "detective", issueCount: 1, timestamp: makeTimestamp() },
    ];

    const entries = convertAgentEventsToLogEntries(events);

    expect(entries).toHaveLength(2);
    expect(entries[0].tag).toBe("START");
    expect(entries[1].message).toContain("1 issue");
  });

  it("generates unique ids from type and index", () => {
    const events: AgentStreamEvent[] = [
      { type: "agent_complete", agent: "detective", issueCount: 0, timestamp: makeTimestamp() },
      { type: "agent_complete", agent: "guardian", issueCount: 1, timestamp: makeTimestamp() },
    ];

    const entries = convertAgentEventsToLogEntries(events);

    expect(entries[0].id).toBe("agent_complete-0");
    expect(entries[1].id).toBe("agent_complete-1");
  });
});
