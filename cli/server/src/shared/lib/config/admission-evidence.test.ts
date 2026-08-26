import { sha256CanonicalJsonSync as hashCanonicalJsonSync } from "@diffgazer/core/json";
import type { EvidenceKey } from "@diffgazer/core/schemas/review";
import { describe, expect, it } from "vitest";
import {
  AdmissionEvidenceSchema,
  buildExpectedEvidenceKey,
  canAuthorizeEvidence,
  createAdmissionEvidence,
  evidenceMatchesKey,
  hashAdmissionEvidenceKeySync,
} from "./admission-evidence.js";
import { effectiveBudgetForRecord, executionLimitsFromBudget } from "./budget-ceiling.js";
import type { SupportedProviderConfigurationRecord } from "./provider-config.js";

const limits = {
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
  productId: "openrouter",
  transportFamily: "hosted-api",
  normalizedEndpoint: "https://openrouter.ai/api/v1",
  region: null,
  workspaceAccountReference: null,
  modelId: "openai/gpt-4.1-mini",
  runtime: { identity: "diffgazer-server", version: "1.2.3" },
  structuredOutputSchemaSha256: "1".repeat(64),
  noticeVersion: 1,
  limits,
};

const checkedAt = "2026-07-31T12:00:00.000Z";
const now = "2026-07-31T12:05:00.000Z";

describe("admission evidence", () => {
  it("matches the T-002 canonical SHA-256 algorithm", () => {
    expect(hashCanonicalJsonSync({ z: 1, a: 2 })).toBe(
      "c2985c5ba6f7d2a55e768f92490ca09388e95bc4cccb9fdf11b15f4d42f93e73",
    );
    expect(hashAdmissionEvidenceKeySync(evidenceKey)).toBe(hashCanonicalJsonSync(evidenceKey));
  });

  it.each([
    ["credential reference", { credentialReferenceIdentity: "4".repeat(64) }],
    [
      "product and endpoint",
      { productId: "zai", normalizedEndpoint: "https://api.z.ai/api/paas/v4" },
    ],
    ["model", { modelId: "openai/gpt-4.1" }],
    ["runtime", { runtime: { identity: "diffgazer-server", version: "1.2.4" } }],
    ["schema", { structuredOutputSchemaSha256: "2".repeat(64) }],
    ["notice", { noticeVersion: 2 }],
    ["limits", { limits: { ...limits, maxInputTokens: 20_001 } }],
  ] as const)("invalidates the tuple when %s changes", (_label, patch) => {
    const changed = { ...evidenceKey, ...patch } as EvidenceKey;
    expect(hashAdmissionEvidenceKeySync(changed)).not.toBe(
      hashAdmissionEvidenceKeySync(evidenceKey),
    );
  });

  it("requires a matching passed observation before authorization", () => {
    const evidence = createAdmissionEvidence({
      evidenceKey,
      checkedAt,
      status: "passed",
      expiresAt: "2026-07-31T13:00:00.000Z",
    });

    expect(evidenceMatchesKey(evidence, evidenceKey)).toBe(true);
    expect(canAuthorizeEvidence(evidence, evidenceKey, { now })).toBe(true);
    expect(canAuthorizeEvidence(evidence, { ...evidenceKey, noticeVersion: 2 }, { now })).toBe(
      false,
    );
  });

  it("passed evidence with a null expiry authorizes indefinitely absent tuple change", () => {
    const farFuture = "2027-12-01T00:00:00.000Z";
    const durable = createAdmissionEvidence({
      evidenceKey,
      checkedAt,
      status: "passed",
      expiresAt: null,
    });
    expect(canAuthorizeEvidence(durable, evidenceKey, { now: farFuture })).toBe(true);

    // Pre-campaign evidence files carry no `expiresAt` key at all.
    const withoutExpiry = createAdmissionEvidence({ evidenceKey, checkedAt, status: "passed" });
    expect(canAuthorizeEvidence(withoutExpiry, evidenceKey, { now: farFuture })).toBe(true);
  });

  it("does not authorize failed evidence", () => {
    const evidence = createAdmissionEvidence({ evidenceKey, checkedAt, status: "failed" });
    expect(canAuthorizeEvidence(evidence, evidenceKey, { now })).toBe(false);
  });

  it("does not authorize evidence past a deadline it already carries", () => {
    const evidence = createAdmissionEvidence({
      evidenceKey,
      checkedAt,
      status: "passed",
      expiresAt: "2026-07-31T12:01:00.000Z",
    });
    expect(canAuthorizeEvidence(evidence, evidenceKey, { now })).toBe(false);
  });

  it("admits the profile's per-dispatch wall time for a paced product", () => {
    const record = (
      productId: "zai" | "gemini" | "openrouter",
      endpoint: string,
      selectedModelId: string,
    ): SupportedProviderConfigurationRecord => ({
      schemaVersion: 2,
      status: "supported",
      configurationId: `${productId}-primary`,
      revision: 1,
      productId,
      transportFamily: "hosted-api",
      input: { transportFamily: "hosted-api", productId, endpoint },
      selectedModelId,
      acknowledgement: {
        noticeId: `${productId}-hosted-api`,
        noticeVersion: 1,
        acceptedAt: checkedAt,
      },
      evidenceReference: `evidence-${productId}-1`,
      budget: {
        inputTokens: 20_000,
        responseBytes: 1_048_576,
        wallTimeMs: 120_000,
        retries: 2,
        concurrency: 1,
        perReview: 0.5,
      },
      createdAt: checkedAt,
      updatedAt: checkedAt,
    });
    const build = (input: SupportedProviderConfigurationRecord) =>
      buildExpectedEvidenceKey({
        record: input,
        runtime: { identity: "diffgazer-server", version: "1.2.3" },
        structuredOutputSchemaSha256: "1".repeat(64),
        credentialReferenceIdentity: "3".repeat(64),
      });

    const zaiRecord = record("zai", "https://api.z.ai/api/paas/v4", "glm-5-turbo");
    const zaiKey = build(zaiRecord);
    expect(zaiKey.limits.wallTimeMs).toBe(300_000);
    expect(zaiKey.limits).toEqual({
      ...executionLimitsFromBudget(effectiveBudgetForRecord(zaiRecord)),
      wallTimeMs: 300_000,
    });

    const geminiKey = build(
      record("gemini", "https://generativelanguage.googleapis.com/v1beta", "gemini-2.5-flash"),
    );
    expect(geminiKey.limits.wallTimeMs).toBe(120_000);

    // The openrouter product wall beats the budget wall for every route.
    const openrouterKey = build(
      record(
        "openrouter",
        "https://openrouter.ai/api/v1",
        "nvidia/nemotron-3-super-120b-a12b:free",
      ),
    );
    expect(openrouterKey.limits.wallTimeMs).toBe(600_000);
  });

  it("rejects a forged hash and literal secret reference", () => {
    const evidence = createAdmissionEvidence({ evidenceKey, checkedAt, status: "passed" });
    expect(
      AdmissionEvidenceSchema.safeParse({ ...evidence, evidenceKeyHash: "f".repeat(64) }).success,
    ).toBe(false);
    expect(
      AdmissionEvidenceSchema.safeParse({ ...evidence, apiKey: "literal-secret" }).success,
    ).toBe(false);
    expect(
      AdmissionEvidenceSchema.safeParse({
        ...evidence,
        evidenceKey: { ...evidenceKey, credentialReferenceIdentity: "literal-secret" },
      }).success,
    ).toBe(false);
  });
});
