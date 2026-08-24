import { canonicalJson } from "@diffgazer/core/json";
import type { EvidenceKey } from "@diffgazer/core/schemas/review";
import { describe, expect, it } from "vitest";
import { createBudgetLedger } from "../budget/ledger.js";
import {
  createCompletedExecutionResult,
  createFailedExecutionResult,
  estimatePromptTokens,
  estimateReviewInputTokens,
  promptAttemptEstimate,
} from "./execution-receipt.js";

const LIMITS = {
  maxInputTokens: 20_000,
  maxResponseBytes: 1_048_576,
  wallTimeMs: 120_000,
  maxRetries: 2,
  maxConcurrency: 1,
  maxCostUsd: 0.5,
} as const;

const evidenceKey: EvidenceKey = {
  authentication: null,
  credentialReferenceIdentity: "3".repeat(64),
  installationId: null,
  productId: "gemini",
  transportFamily: "hosted-api",
  normalizedEndpoint: "https://generativelanguage.googleapis.com/v1beta",
  region: null,
  workspaceAccountReference: null,
  modelId: "gemini-2.5-flash",
  runtime: { identity: "diffgazer-server", version: "1.0.0" },
  structuredOutputSchemaSha256: "1".repeat(64),
  noticeVersion: 1,
  limits: LIMITS,
};

describe("review input token accounting", () => {
  it("includes the user role and content when no system prompt is present", () => {
    const prompt = "a".repeat(8);

    expect(estimateReviewInputTokens({ prompt })).toBe(
      estimatePromptTokens("user") + estimatePromptTokens(prompt),
    );
  });

  it("treats an empty system prompt as absent in both estimates", () => {
    const input = { prompt: "a".repeat(8) };
    const withoutSystemPrompt = promptAttemptEstimate(input, LIMITS);
    const withEmptySystemPrompt = promptAttemptEstimate({ ...input, systemPrompt: "" }, LIMITS);

    expect(estimateReviewInputTokens({ ...input, systemPrompt: "" })).toBe(
      estimateReviewInputTokens(input),
    );
    expect(withEmptySystemPrompt).toEqual(withoutSystemPrompt);
  });

  it("sums system, separator, user role, and content independently", () => {
    const input = {
      systemPrompt: "界".repeat(8),
      prompt: "a".repeat(8),
    };
    const expected =
      estimatePromptTokens("system") +
      estimatePromptTokens(input.systemPrompt) +
      estimatePromptTokens("\n\n") +
      estimatePromptTokens("user") +
      estimatePromptTokens(input.prompt);

    expect(estimateReviewInputTokens(input)).toBe(expected);
    expect(estimateReviewInputTokens(input)).toBeGreaterThan(
      estimatePromptTokens(`${input.systemPrompt}\n\n${input.prompt}`),
    );
  });

  it("passes an exact input bound and rejects an over-limit estimate", () => {
    const input = { systemPrompt: "界", prompt: "a".repeat(8) };
    const exactEstimate = promptAttemptEstimate(input, {
      ...LIMITS,
      maxInputTokens: estimateReviewInputTokens(input),
    });
    const exactLedger = createBudgetLedger({
      ...LIMITS,
      maxInputTokens: exactEstimate.inputTokens,
    });

    expect(exactLedger.reserveAttempt(exactEstimate).ok).toBe(true);

    const overLimits = { ...LIMITS, maxInputTokens: exactEstimate.inputTokens - 1 };
    const overEstimate = promptAttemptEstimate(input, overLimits);
    const overLedger = createBudgetLedger(overLimits);
    const reservation = overLedger.reserveAttempt(overEstimate);

    expect(overEstimate.inputTokens).toBeGreaterThan(overLimits.maxInputTokens);
    expect(reservation).toEqual({
      ok: false,
      error: {
        outcome: "budget-exhausted",
        limit: "maxInputTokens",
        result: { issues: [] },
      },
    });
  });
});

describe("createFailedExecutionResult", () => {
  it("degrades invalid reported usage to unavailable instead of throwing", () => {
    const result = createFailedExecutionResult(
      {
        configurationId: "configuration-1",
        configurationRevision: 1,
        evidenceKey,
        prompt: "review",
      },
      "schema-failed",
      {
        startedAt: "2026-01-01T00:00:00.000Z",
        finishedAt: "2026-01-01T00:00:01.000Z",
        attemptCount: 1,
        usage: { inputTokens: 8, outputTokens: 12, totalTokens: 1096 },
        usageAvailability: "reported",
      },
    );

    expect(result.receipt.outcome).toBe("schema-failed");
    expect(result.receipt.usageAvailability).toBe("unavailable");
    expect(result.receipt.usage).toBeUndefined();
  });

  it("omits region, workspace, and usage keys the evidence key does not carry", () => {
    const result = createFailedExecutionResult(
      {
        configurationId: "configuration-1",
        configurationRevision: 1,
        evidenceKey,
        prompt: "review",
      },
      "transport-failed",
      {
        startedAt: "2026-01-01T00:00:00.000Z",
        finishedAt: "2026-01-01T00:00:01.000Z",
        attemptCount: 1,
      },
    );

    for (const field of ["region", "workspace", "usage"] as const) {
      expect(result.receipt).not.toHaveProperty(field);
    }
    expect(() => canonicalJson(result.receipt)).not.toThrow();
  });

  it("retains valid reported usage", () => {
    const usage = { inputTokens: 8, outputTokens: 12, totalTokens: 20 } as const;
    const result = createCompletedExecutionResult(
      {
        configurationId: "configuration-1",
        configurationRevision: 1,
        evidenceKey,
        prompt: "review",
      },
      { issues: [] },
      {
        startedAt: "2026-01-01T00:00:00.000Z",
        finishedAt: "2026-01-01T00:00:01.000Z",
        attemptCount: 1,
        usage,
        usageAvailability: "reported",
      },
    );

    expect(result.receipt.usageAvailability).toBe("reported");
    expect(result.receipt.usage).toEqual(usage);
  });
});
