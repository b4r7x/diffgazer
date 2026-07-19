import { describe, expect, it } from "vitest";
import type { SetupStatus } from "../schemas/config/index.js";
import { AGENT_METADATA, type AgentState } from "../schemas/events/index.js";
import { SavedReviewSchema } from "../schemas/review/index.js";
import {
  AGENT_STATUS_META,
  buildSeverityBreakdownRows,
  CONFIGURATION_ERROR_COPY,
  CONFIGURE_PROVIDER_LABEL,
  classifyReviewStreamError,
  DETAILS_EMPTY_COPY,
  describeReviewStartError,
  formatSeverityFilterLabel,
  getAgentStatusMeta,
  getAlternateReviewMode,
  getApiKeyMissingCopy,
  getDetailsEmptyCopy,
  getNoChangesCopy,
  getPartialFailureWarning,
  NO_CHANGES_COPY,
  toIssueDetailsPresentation,
} from "./presentation.js";

function makeAgent(
  name: string,
  status: AgentState["status"],
  id: AgentState["id"] = "guardian",
): AgentState {
  return {
    id,
    meta: {
      ...AGENT_METADATA[id],
      name,
    },
    status,
    progress: 0,
    issueCount: 0,
  } as AgentState;
}

describe("review presentation contracts", () => {
  it("builds ordered severity rows with zero-count tracks", () => {
    const rows = buildSeverityBreakdownRows({ blocker: 0, high: 3, medium: 1, low: 0, nit: 0 });

    expect(rows.map((row) => row.severity)).toEqual(["blocker", "high", "medium", "low", "nit"]);
    expect(rows[0]).toMatchObject({ count: 0, filledCells: 0, emptyCells: 16 });
    expect(rows[1]).toMatchObject({ count: 3, total: 4, filledCells: 12, emptyCells: 4 });
  });

  it("builds complete issue metadata and fix-step presentation from a saved review", () => {
    const saved = SavedReviewSchema.parse({
      metadata: {
        id: "11111111-1111-4111-8111-111111111111",
        projectPath: "/repo",
        createdAt: "2026-07-14T08:00:00.000Z",
        mode: "unstaged",
        branch: "main",
        profile: null,
        lenses: [],
        issueCount: 1,
        blockerCount: 0,
        highCount: 1,
        mediumCount: 0,
        lowCount: 0,
        nitCount: 0,
        fileCount: 2,
      },
      result: {
        issues: [
          {
            id: "saved-issue",
            severity: "high",
            category: "security",
            title: "Unsafe redirect",
            file: "src/auth.ts",
            line_start: 14,
            line_end: 18,
            rationale: "rationale",
            recommendation: "recommendation",
            suggested_patch: null,
            confidence: 0.876,
            symptom: "symptom",
            whyItMatters: "impact",
            evidence: [],
            fixPlan: [
              {
                step: 4,
                action: "Validate the redirect target",
                risk: "high",
                files: ["src/auth.ts", "src/auth.test.ts"],
              },
            ],
            trace: [
              {
                step: 1,
                tool: "search",
                timestamp: "2026-07-14T08:00:01.000Z",
                inputSummary: "find the caller",
                outputSummary: "found one caller",
              },
            ],
          },
        ],
      },
      gitContext: {
        branch: "main",
        commit: "abc123",
        fileCount: 2,
        additions: 5,
        deletions: 1,
      },
    });

    const issue = saved.result.issues[0];
    if (!issue) throw new Error("Expected saved issue fixture");

    expect(toIssueDetailsPresentation(issue)).toEqual({
      category: "security",
      confidence: "88%",
      range: "14-18",
      location: "src/auth.ts:14-18",
      fixPlan: [
        {
          completionIndex: 0,
          number: 4,
          action: "Validate the redirect target",
          risk: "high",
          files: ["src/auth.ts", "src/auth.test.ts"],
        },
      ],
      trace: [
        {
          step: 1,
          tool: "search",
          timestamp: "2026-07-14T08:00:01.000Z",
          input: { label: "in:", summary: "find the caller" },
          output: { label: "out:", summary: "found one caller" },
        },
      ],
    });
  });

  it("keeps the severity-filter label shared across surfaces", () => {
    expect(formatSeverityFilterLabel("high", 3)).toBe("HIGH 3");
  });

  it("keeps the shared issue-details empty copy", () => {
    expect(getDetailsEmptyCopy("no-issues")).toEqual({
      title: "No issues in this review",
      description: "This analysis passed without issues.",
    });
    expect(getDetailsEmptyCopy("filter-empty")).toEqual({
      title: "No issues match this filter",
      description: "Choose another severity to continue.",
    });
    expect(getDetailsEmptyCopy("no-selection")).toEqual({
      title: "Select an issue to view details",
    });
    expect(Object.keys(DETAILS_EMPTY_COPY)).toEqual(["no-issues", "filter-empty", "no-selection"]);
  });

  it("keeps the shared no-diff copy", () => {
    expect(getNoChangesCopy("staged")).toMatchObject({
      title: "No Staged Changes",
      switchLabel: "Review Unstaged",
    });
    expect(getNoChangesCopy("unstaged")).toMatchObject({
      title: "No Unstaged Changes",
      switchLabel: "Review Staged",
    });
    expect(getNoChangesCopy("files")).toMatchObject({
      title: "No Changes in Selected Files",
      switchLabel: "Review Unstaged",
    });
    expect(Object.keys(NO_CHANGES_COPY)).toEqual(["staged", "unstaged", "files"]);
    expect(getAlternateReviewMode("staged")).toBe("unstaged");
    expect(getAlternateReviewMode("unstaged")).toBe("staged");
    expect(getAlternateReviewMode("files")).toBe("unstaged");
  });

  it("keeps the shared agent status badge metadata", () => {
    expect(AGENT_STATUS_META).toEqual({
      queued: { label: "WAIT", variant: "neutral" },
      running: { label: "RUN", variant: "info" },
      complete: { label: "DONE", variant: "success" },
      error: { label: "FAIL", variant: "error" },
    });
    expect(getAgentStatusMeta("running")).toEqual({ label: "RUN", variant: "info" });
  });

  it("derives the partial-failure warning only when agents failed and no error is surfaced", () => {
    const agents = [
      makeAgent("Detective", "complete", "detective"),
      makeAgent("Guardian", "error"),
    ];

    expect(getPartialFailureWarning(agents, null)).toEqual({
      hasPartialFailure: true,
      message: "1 agent failed: Guardian. Results may be incomplete.",
    });
    expect(
      getPartialFailureWarning(agents, null, [
        {
          lensId: "security",
          issueCount: 0,
          status: "failed",
          errorCode: "MODEL_ERROR",
        },
      ]),
    ).toEqual({
      hasPartialFailure: true,
      message: "1 agent failed: Guardian. Results may be incomplete.",
    });
    expect(
      getPartialFailureWarning(agents, null, [
        {
          lensId: "security",
          issueCount: 0,
          status: "failed",
          errorCode: "RATE_LIMITED",
        },
      ]),
    ).toEqual({
      hasPartialFailure: true,
      message: "1 agent failed (rate limited): Guardian. Results may be incomplete.",
    });
    // An active error takes precedence and suppresses the partial-failure warning.
    expect(getPartialFailureWarning(agents, "Run failed").hasPartialFailure).toBe(false);
    expect(
      getPartialFailureWarning([makeAgent("Detective", "complete")], null).hasPartialFailure,
    ).toBe(false);
  });

  it("uses the generic warning when any failed lens was not explicitly rate limited", () => {
    const agents = [
      makeAgent("Detective", "error", "detective"),
      makeAgent("Guardian", "error", "guardian"),
    ];

    expect(
      getPartialFailureWarning(agents, null, [
        {
          lensId: "correctness",
          issueCount: 0,
          status: "failed",
          errorCode: "RATE_LIMITED",
        },
        {
          lensId: "security",
          issueCount: 0,
          status: "failed",
          errorCode: "MODEL_ERROR",
        },
      ]).message,
    ).toBe("2 agents failed: Detective, Guardian. Results may be incomplete.");
  });

  it("derives setup copy from the authoritative missing fields", () => {
    const providerMissing: SetupStatus["missing"] = ["provider"];
    const modelMissing = ["model"] as const satisfies Readonly<SetupStatus["missing"]>;
    const providerAndModelMissing: SetupStatus["missing"] = ["provider", "model"];

    expect(getApiKeyMissingCopy({ provider: "openai", missing: providerMissing })).toEqual({
      title: "API Key Required",
      body: "No API key configured for openai. Add your API key in Settings to start reviewing code.",
    });
    expect(getApiKeyMissingCopy({ provider: "openai", missing: modelMissing })).toEqual({
      title: "Model Required",
      body: "No model selected for openai. Set up a model in Settings to start reviewing code.",
    });
    expect(getApiKeyMissingCopy({ missing: providerAndModelMissing })).toEqual({
      title: "API Key Required",
      body: "No API key configured. Add your API key in Settings to start reviewing code.",
    });
    expect(CONFIGURATION_ERROR_COPY).toEqual({
      title: "Configuration Unavailable",
      body: "Diffgazer could not load the current configuration. Retry the request or return home.",
    });
    expect(CONFIGURE_PROVIDER_LABEL).toBe("Configure Provider");
  });

  it.each([
    {
      code: "API_KEY_MISSING",
      title: "API Key Missing",
      message: "API key not found. Add one in Settings → Providers.",
    },
    {
      code: "UNSUPPORTED_PROVIDER",
      title: "Provider Not Configured",
      message: "Pick an AI provider in Settings → Providers.",
    },
    {
      code: "MODEL_ERROR",
      title: "Model Not Selected",
      message: "API key not found",
    },
    {
      code: "KEYRING_READ_FAILED",
      title: "Credential Storage Unavailable",
      message: "API key not found. Check Settings → Storage.",
    },
  ])("describes $code review start failures", ({ code, title, message }) => {
    const error = Object.assign(new Error("API key not found"), { code, status: 400 });

    expect(describeReviewStartError(error)).toEqual({ title, message });
  });

  it("falls back for unstructured review start failures", () => {
    expect(describeReviewStartError(new Error("network failed"))).toEqual({
      title: "Failed to Start Review",
      message: "Could not create a review session.",
    });
  });

  it("classifies review stream failures by structured code before message fallback", () => {
    expect(classifyReviewStreamError("credentials rejected", "API_KEY_MISSING")).toEqual({
      kind: "api-key",
      title: "API Key Error",
      guidance: "Your API key may be invalid or expired.",
      ctaLabel: "Configure Provider",
    });
    expect(classifyReviewStreamError("API key connection dropped", "STREAM_ERROR")).toEqual({
      kind: "transport",
      title: "Connection Lost",
      guidance: "The review stream was interrupted. Retry to reconnect to the active review.",
      ctaLabel: "Retry",
    });
    expect(classifyReviewStreamError("API-key rejected", "SESSION_STALE").kind).toBe("other");
    expect(classifyReviewStreamError("API-key rejected", null).kind).toBe("api-key");
  });
});
