import { describe, it, expect, vi } from "vitest";
import { triageReview, triageReviewStream, triageWithProfile } from "./triage.js";
import type { AIClient } from "../ai/types.js";
import type { ParsedDiff } from "../diff/types.js";
import type { TriageResult, TriageIssue } from "@repo/schemas/triage";
import type { AgentStreamEvent } from "@repo/schemas/agent-event";
import { ok } from "../result.js";

function createMockAIClient(responses: TriageResult[]): AIClient {
  let callIndex = 0;
  return {
    provider: "gemini",
    generate: vi.fn().mockImplementation(async () => {
      const response = responses[callIndex] ?? responses[0];
      callIndex++;
      return ok(response);
    }),
    generateStream: vi.fn(),
  };
}

function createMockDiff(files: Array<{ path: string; rawDiff: string }>): ParsedDiff {
  return {
    files: files.map((f) => ({
      filePath: f.path,
      previousPath: null,
      operation: "modify" as const,
      hunks: [],
      rawDiff: f.rawDiff,
      stats: { additions: 1, deletions: 1, sizeBytes: f.rawDiff.length },
    })),
    totalStats: {
      filesChanged: files.length,
      additions: files.length,
      deletions: files.length,
      totalSizeBytes: files.reduce((sum, f) => sum + f.rawDiff.length, 0),
    },
  };
}

function createMockIssue(overrides: Partial<TriageIssue>): TriageIssue {
  return {
    id: "test_issue_1",
    severity: "high",
    category: "correctness",
    title: "Test Issue",
    file: "src/index.ts",
    line_start: 10,
    line_end: 10,
    rationale: "This is a test rationale",
    recommendation: "Fix it",
    suggested_patch: null,
    confidence: 0.9,
    symptom: "Observable test symptom",
    whyItMatters: "This matters because it could cause issues",
    evidence: [
      {
        type: "code",
        title: "Code at src/index.ts:10",
        sourceId: "src/index.ts:10-10",
        file: "src/index.ts",
        range: { start: 10, end: 10 },
        excerpt: "const x = null;",
      },
    ],
    ...overrides,
  };
}

describe("triageReview", () => {
  describe("basic functionality", () => {
    it("returns error when no files changed", async () => {
      const client = createMockAIClient([]);
      const diff: ParsedDiff = { files: [], totalStats: { filesChanged: 0, additions: 0, deletions: 0, totalSizeBytes: 0 } };

      const result = await triageReview(client, diff);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("NO_DIFF");
      }
    });

    it("returns issues from AI client", async () => {
      const mockResult: TriageResult = {
        summary: "Found 1 issue",
        issues: [
          createMockIssue({
            id: "correctness_null_1",
            title: "Null check missing",
            symptom: "Variable accessed without null check",
            whyItMatters: "This could crash at runtime",
          }),
        ],
      };
      const client = createMockAIClient([mockResult]);
      const diff = createMockDiff([{ path: "src/index.ts", rawDiff: "+const x = null;" }]);

      const result = await triageReview(client, diff);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.issues).toHaveLength(1);
        expect(result.value.issues[0]!.title).toBe("Null check missing");
        expect(result.value.issues[0]!.symptom).toBe("Variable accessed without null check");
        expect(result.value.issues[0]!.whyItMatters).toBe("This could crash at runtime");
        expect(result.value.issues[0]!.evidence).toHaveLength(1);
      }
    });

    it("ensures evidence is present on issues", async () => {
      const mockResult: TriageResult = {
        summary: "Found 1 issue",
        issues: [
          createMockIssue({
            id: "correctness_null_1",
            evidence: [],
          }),
        ],
      };
      const client = createMockAIClient([mockResult]);
      const diff = createMockDiff([{ path: "src/index.ts", rawDiff: "+const x = null;" }]);

      const result = await triageReview(client, diff);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.issues).toHaveLength(1);
        expect(result.value.issues[0]!.evidence.length).toBeGreaterThan(0);
      }
    });
  });

  describe("multi-lens review", () => {
    it("combines issues from multiple lenses", async () => {
      const correctnessResult: TriageResult = {
        summary: "Correctness issues",
        issues: [
          createMockIssue({
            id: "correctness_1",
            title: "Logic error",
            file: "src/index.ts",
            symptom: "Incorrect logic flow",
            whyItMatters: "Bug in business logic",
          }),
        ],
      };
      const securityResult: TriageResult = {
        summary: "Security issues",
        issues: [
          createMockIssue({
            id: "security_1",
            severity: "blocker",
            category: "security",
            title: "SQL injection",
            file: "src/db.ts",
            line_start: 20,
            line_end: 20,
            symptom: "User input passed directly to query",
            whyItMatters: "Attacker could execute arbitrary SQL",
            evidence: [
              {
                type: "code",
                title: "Code at src/db.ts:20",
                sourceId: "src/db.ts:20-20",
                file: "src/db.ts",
                range: { start: 20, end: 20 },
                excerpt: "db.query(userInput)",
              },
            ],
          }),
        ],
      };

      const client = createMockAIClient([correctnessResult, securityResult]);
      const diff = createMockDiff([
        { path: "src/index.ts", rawDiff: "+bug" },
        { path: "src/db.ts", rawDiff: "+sql" },
      ]);

      const result = await triageReview(client, diff, { lenses: ["correctness", "security"] });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.issues).toHaveLength(2);
        expect(result.value.summary).toContain("Correctness");
        expect(result.value.summary).toContain("Security");
      }
    });

    it("deduplicates similar issues from different lenses", async () => {
      const result1: TriageResult = {
        summary: "Issues",
        issues: [
          createMockIssue({
            id: "lens1_issue",
            severity: "medium",
            title: "Same issue",
          }),
        ],
      };
      const result2: TriageResult = {
        summary: "Issues",
        issues: [
          createMockIssue({
            id: "lens2_issue",
            severity: "high",
            title: "Same issue",
          }),
        ],
      };

      const client = createMockAIClient([result1, result2]);
      const diff = createMockDiff([{ path: "src/index.ts", rawDiff: "+code" }]);

      const triageResult = await triageReview(client, diff, { lenses: ["correctness", "security"] });

      expect(triageResult.ok).toBe(true);
      if (triageResult.ok) {
        expect(triageResult.value.issues).toHaveLength(1);
        expect(triageResult.value.issues[0]!.severity).toBe("high");
      }
    });
  });

  describe("severity filtering", () => {
    it("filters out low severity issues when minSeverity is high", async () => {
      const mockResult: TriageResult = {
        summary: "Issues",
        issues: [
          createMockIssue({
            id: "high_issue",
            severity: "high",
            title: "High severity",
          }),
          createMockIssue({
            id: "low_issue",
            severity: "low",
            category: "style",
            title: "Low severity",
            line_start: 20,
            line_end: 20,
            confidence: 0.7,
          }),
        ],
      };

      const client = createMockAIClient([mockResult]);
      const diff = createMockDiff([{ path: "src/index.ts", rawDiff: "+code" }]);

      const result = await triageReview(client, diff, { filter: { minSeverity: "high" } });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.issues).toHaveLength(1);
        expect(result.value.issues[0]!.severity).toBe("high");
      }
    });

    it("includes blocker and high when minSeverity is high", async () => {
      const mockResult: TriageResult = {
        summary: "Issues",
        issues: [
          createMockIssue({
            id: "blocker_issue",
            severity: "blocker",
            category: "security",
            title: "Blocker",
            line_start: 5,
            line_end: 5,
            confidence: 1.0,
          }),
          createMockIssue({
            id: "high_issue",
            severity: "high",
            title: "High",
          }),
        ],
      };

      const client = createMockAIClient([mockResult]);
      const diff = createMockDiff([{ path: "src/index.ts", rawDiff: "+code" }]);

      const result = await triageReview(client, diff, { filter: { minSeverity: "high" } });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.issues).toHaveLength(2);
      }
    });
  });

  describe("sorting", () => {
    it("sorts issues by severity (blocker first)", async () => {
      const mockResult: TriageResult = {
        summary: "Issues",
        issues: [
          createMockIssue({
            id: "low_issue",
            severity: "low",
            category: "style",
            title: "Low",
            file: "src/a.ts",
            line_start: 1,
            line_end: 1,
            confidence: 0.5,
          }),
          createMockIssue({
            id: "blocker_issue",
            severity: "blocker",
            category: "security",
            title: "Blocker",
            file: "src/b.ts",
            line_start: 1,
            line_end: 1,
            confidence: 1.0,
          }),
          createMockIssue({
            id: "high_issue",
            severity: "high",
            title: "High",
            file: "src/c.ts",
            line_start: 1,
            line_end: 1,
          }),
        ],
      };

      const client = createMockAIClient([mockResult]);
      const diff = createMockDiff([
        { path: "src/a.ts", rawDiff: "+a" },
        { path: "src/b.ts", rawDiff: "+b" },
        { path: "src/c.ts", rawDiff: "+c" },
      ]);

      const result = await triageReview(client, diff);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.issues[0]!.severity).toBe("blocker");
        expect(result.value.issues[1]!.severity).toBe("high");
        expect(result.value.issues[2]!.severity).toBe("low");
      }
    });
  });

  describe("issue validation", () => {
    it("filters out incomplete issues missing required fields", async () => {
      const mockResult: TriageResult = {
        summary: "Issues",
        issues: [
          createMockIssue({
            id: "complete_issue",
            title: "Complete issue",
          }),
          {
            id: "incomplete_issue",
            severity: "high",
            category: "correctness",
            title: "Incomplete issue",
            file: "src/index.ts",
            line_start: 10,
            line_end: 10,
            rationale: "Missing required fields",
            recommendation: "Fix",
            suggested_patch: null,
            confidence: 0.9,
            symptom: "",
            whyItMatters: "",
            evidence: [],
          },
        ],
      };

      const client = createMockAIClient([mockResult]);
      const diff = createMockDiff([{ path: "src/index.ts", rawDiff: "+code" }]);

      const result = await triageReview(client, diff);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.issues).toHaveLength(1);
        expect(result.value.issues[0]!.title).toBe("Complete issue");
      }
    });
  });
});

describe("triageWithProfile", () => {
  it("uses profile lenses and filter", async () => {
    const mockResult: TriageResult = {
      summary: "Quick review",
      issues: [
        createMockIssue({
          id: "high_issue",
          severity: "high",
          title: "High severity issue",
        }),
        createMockIssue({
          id: "low_issue",
          severity: "low",
          category: "style",
          title: "Low severity issue",
          line_start: 20,
          line_end: 20,
          confidence: 0.5,
        }),
      ],
    };

    const client = createMockAIClient([mockResult]);
    const diff = createMockDiff([{ path: "src/index.ts", rawDiff: "+code" }]);

    const result = await triageWithProfile(client, diff, "quick");

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.issues).toHaveLength(1);
      expect(result.value.issues[0]!.severity).toBe("high");
    }
  });
});

describe("triageReviewStream", () => {
  it("emits agent_start event when starting a lens", async () => {
    const mockResult: TriageResult = {
      summary: "Found 1 issue",
      issues: [createMockIssue({})],
    };
    const client = createMockAIClient([mockResult]);
    const diff = createMockDiff([{ path: "src/index.ts", rawDiff: "+code" }]);
    const events: AgentStreamEvent[] = [];

    await triageReviewStream(client, diff, {}, (event) => events.push(event));

    const startEvent = events.find((e) => e.type === "agent_start");
    expect(startEvent).toBeDefined();
    expect(startEvent?.type).toBe("agent_start");
    if (startEvent?.type === "agent_start") {
      expect(startEvent.agent.id).toBe("detective");
      expect(startEvent.agent.name).toBe("Detective");
    }
  });

  it("emits agent_thinking event before AI call", async () => {
    const mockResult: TriageResult = {
      summary: "Found issues",
      issues: [createMockIssue({})],
    };
    const client = createMockAIClient([mockResult]);
    const diff = createMockDiff([{ path: "src/index.ts", rawDiff: "+code" }]);
    const events: AgentStreamEvent[] = [];

    await triageReviewStream(client, diff, {}, (event) => events.push(event));

    const thinkingEvent = events.find((e) => e.type === "agent_thinking");
    expect(thinkingEvent).toBeDefined();
    if (thinkingEvent?.type === "agent_thinking") {
      expect(thinkingEvent.agent).toBe("detective");
      expect(thinkingEvent.thought).toContain("Analyzing diff");
    }
  });

  it("emits issue_found event for each issue", async () => {
    const mockResult: TriageResult = {
      summary: "Found issues",
      issues: [
        createMockIssue({ id: "issue_1", title: "First issue" }),
        createMockIssue({ id: "issue_2", title: "Second issue", line_start: 20, line_end: 20 }),
      ],
    };
    const client = createMockAIClient([mockResult]);
    const diff = createMockDiff([{ path: "src/index.ts", rawDiff: "+code" }]);
    const events: AgentStreamEvent[] = [];

    await triageReviewStream(client, diff, {}, (event) => events.push(event));

    const issueEvents = events.filter((e) => e.type === "issue_found");
    expect(issueEvents).toHaveLength(2);
    if (issueEvents[0]?.type === "issue_found") {
      expect(issueEvents[0].issue.title).toBe("First issue");
    }
  });

  it("emits agent_complete event with issue count", async () => {
    const mockResult: TriageResult = {
      summary: "Found issues",
      issues: [
        createMockIssue({ id: "issue_1" }),
        createMockIssue({ id: "issue_2", line_start: 20, line_end: 20 }),
      ],
    };
    const client = createMockAIClient([mockResult]);
    const diff = createMockDiff([{ path: "src/index.ts", rawDiff: "+code" }]);
    const events: AgentStreamEvent[] = [];

    await triageReviewStream(client, diff, {}, (event) => events.push(event));

    const completeEvent = events.find((e) => e.type === "agent_complete");
    expect(completeEvent).toBeDefined();
    if (completeEvent?.type === "agent_complete") {
      expect(completeEvent.agent).toBe("detective");
      expect(completeEvent.issueCount).toBe(2);
    }
  });

  it("emits orchestrator_complete event at the end", async () => {
    const mockResult: TriageResult = {
      summary: "Review complete",
      issues: [createMockIssue({})],
    };
    const client = createMockAIClient([mockResult]);
    const diff = createMockDiff([{ path: "src/index.ts", rawDiff: "+code" }]);
    const events: AgentStreamEvent[] = [];

    await triageReviewStream(client, diff, {}, (event) => events.push(event));

    const orchestratorEvent = events.find((e) => e.type === "orchestrator_complete");
    expect(orchestratorEvent).toBeDefined();
    if (orchestratorEvent?.type === "orchestrator_complete") {
      expect(orchestratorEvent.totalIssues).toBe(1);
      expect(orchestratorEvent.summary).toContain("Review complete");
    }
  });

  it("emits events for multiple lenses in order", async () => {
    const correctnessResult: TriageResult = {
      summary: "Correctness done",
      issues: [createMockIssue({ id: "correctness_1" })],
    };
    const securityResult: TriageResult = {
      summary: "Security done",
      issues: [
        createMockIssue({
          id: "security_1",
          category: "security",
          file: "src/auth.ts",
          line_start: 5,
          line_end: 5,
        }),
      ],
    };
    const client = createMockAIClient([correctnessResult, securityResult]);
    const diff = createMockDiff([
      { path: "src/index.ts", rawDiff: "+code" },
      { path: "src/auth.ts", rawDiff: "+auth" },
    ]);
    const events: AgentStreamEvent[] = [];

    await triageReviewStream(client, diff, { lenses: ["correctness", "security"] }, (event) =>
      events.push(event)
    );

    const startEvents = events.filter((e) => e.type === "agent_start");
    expect(startEvents).toHaveLength(2);
    if (startEvents[0]?.type === "agent_start" && startEvents[1]?.type === "agent_start") {
      expect(startEvents[0].agent.id).toBe("detective");
      expect(startEvents[1].agent.id).toBe("guardian");
    }

    const completeEvents = events.filter((e) => e.type === "agent_complete");
    expect(completeEvents).toHaveLength(2);
  });

  it("emits events in correct sequence for single lens", async () => {
    const mockResult: TriageResult = {
      summary: "Done",
      issues: [createMockIssue({})],
    };
    const client = createMockAIClient([mockResult]);
    const diff = createMockDiff([{ path: "src/index.ts", rawDiff: "+code" }]);
    const eventTypes: string[] = [];

    await triageReviewStream(client, diff, {}, (event) => eventTypes.push(event.type));

    expect(eventTypes).toEqual([
      "agent_start",
      "agent_thinking",
      "tool_call",
      "tool_result",
      "agent_thinking",
      "issue_found",
      "agent_complete",
      "orchestrator_complete",
    ]);
  });

  it("emits agent_start before agent_complete for each lens in parallel execution", async () => {
    const correctnessResult: TriageResult = {
      summary: "Correctness done",
      issues: [createMockIssue({ id: "correctness_1" })],
    };
    const securityResult: TriageResult = {
      summary: "Security done",
      issues: [
        createMockIssue({
          id: "security_1",
          category: "security",
          file: "src/auth.ts",
          line_start: 5,
          line_end: 5,
        }),
      ],
    };
    const client = createMockAIClient([correctnessResult, securityResult]);
    const diff = createMockDiff([
      { path: "src/index.ts", rawDiff: "+code" },
      { path: "src/auth.ts", rawDiff: "+auth" },
    ]);
    const events: AgentStreamEvent[] = [];

    await triageReviewStream(client, diff, { lenses: ["correctness", "security"] }, (event) =>
      events.push(event)
    );

    // Verify each agent's start comes before its complete
    const detectiveStart = events.findIndex(
      (e) => e.type === "agent_start" && e.agent.id === "detective"
    );
    const detectiveComplete = events.findIndex(
      (e) => e.type === "agent_complete" && e.agent === "detective"
    );
    const guardianStart = events.findIndex(
      (e) => e.type === "agent_start" && e.agent.id === "guardian"
    );
    const guardianComplete = events.findIndex(
      (e) => e.type === "agent_complete" && e.agent === "guardian"
    );

    expect(detectiveStart).toBeLessThan(detectiveComplete);
    expect(guardianStart).toBeLessThan(guardianComplete);

    // orchestrator_complete should be last
    const orchestratorComplete = events.findIndex((e) => e.type === "orchestrator_complete");
    expect(orchestratorComplete).toBe(events.length - 1);
  });
});
