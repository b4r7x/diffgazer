import type { EvidenceKey } from "@diffgazer/core/schemas/review";
import { sha256CanonicalJsonSync as hashCanonicalJsonSync } from "@diffgazer/core/schemas/review";
import { describe, expect, it } from "vitest";
import {
  AdmissionEvidenceSchema,
  canAuthorizeEvidence,
  createAdmissionEvidence,
  evidenceMatchesKey,
  hashAdmissionEvidenceKey,
  hashAdmissionEvidenceKeySync,
  isEvidenceExpired,
  toSafeEvidenceReference,
} from "./admission-evidence.js";

const limits = {
  maxInputTokens: 20_000,
  maxOutputTokens: 4_000,
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
  it("matches the T-002 canonical SHA-256 algorithm", async () => {
    expect(hashCanonicalJsonSync({ z: 1, a: 2 })).toBe(
      "c2985c5ba6f7d2a55e768f92490ca09388e95bc4cccb9fdf11b15f4d42f93e73",
    );
    expect(await hashAdmissionEvidenceKey(evidenceKey)).toBe(
      hashAdmissionEvidenceKeySync(evidenceKey),
    );
  });

  it.each([
    ["credential reference", { credentialReferenceIdentity: "4".repeat(64) }],
    ["product", { productId: "groq", normalizedEndpoint: "https://api.groq.com/openai/v1" }],
    [
      "endpoint",
      {
        productId: "local-openai",
        transportFamily: "local-http",
        authentication: "none",
        credentialReferenceIdentity: null,
        normalizedEndpoint: "http://127.0.0.1:1234/v1",
        runtime: { identity: "lm-studio", version: "0.3.0" },
      },
    ],
    [
      "region",
      {
        productId: "moonshot",
        normalizedEndpoint: "https://api.moonshot.cn/v1",
        region: "mainland",
        modelId: "kimi-k3-2026-01",
      },
    ],
    [
      "workspace",
      {
        productId: "qwen",
        normalizedEndpoint: "https://dashscope-intl.aliyuncs.com/compatible-mode/v1",
        region: "international",
        workspaceAccountReference: "4".repeat(64),
        modelId: "qwen3-coder-flash",
      },
    ],
    ["model", { modelId: "openai/gpt-4.1" }],
    ["runtime", { runtime: { identity: "diffgazer-server", version: "1.2.4" } }],
    ["schema", { structuredOutputSchemaSha256: "2".repeat(64) }],
    ["notice", { noticeVersion: 2 }],
    ["limits", { limits: { ...limits, maxOutputTokens: 4_001 } }],
  ] as const)("invalidates the tuple when %s changes", async (_label, patch) => {
    const changed = { ...evidenceKey, ...patch } as EvidenceKey;
    expect(await hashAdmissionEvidenceKey(changed)).not.toBe(
      await hashAdmissionEvidenceKey(evidenceKey),
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
    expect(canAuthorizeEvidence(evidence, evidenceKey, { now, maxAgeMs: 60_000 })).toBe(false);
  });

  it.each([
    "not-checked",
    "pending",
    "failed",
    "skipped",
    "expired",
  ] as const)("does not authorize %s evidence", (status) => {
    const evidence = createAdmissionEvidence({
      evidenceKey,
      checkedAt: status === "not-checked" ? null : checkedAt,
      status,
    });
    expect(canAuthorizeEvidence(evidence, evidenceKey, { now })).toBe(false);
  });

  it("expires evidence by explicit deadline or age", () => {
    const evidence = createAdmissionEvidence({
      evidenceKey,
      checkedAt,
      status: "passed",
      expiresAt: "2026-07-31T12:01:00.000Z",
    });
    expect(isEvidenceExpired(evidence, { now })).toBe(true);
    expect(isEvidenceExpired(evidence, { now: checkedAt, maxAgeMs: 0 })).toBe(true);
  });

  it("projects only a bounded, secret-free reference", () => {
    const evidence = createAdmissionEvidence({ evidenceKey, checkedAt, status: "passed" });
    const reference = toSafeEvidenceReference(evidence);
    expect(reference).toEqual({
      evidenceKeyHash: evidence.evidenceKeyHash,
      checkedAt,
      status: "passed",
    });
    expect(JSON.stringify(reference)).not.toContain("credentialReferenceIdentity");
    expect(JSON.stringify(reference)).not.toContain("openrouter.ai");
    expect(JSON.stringify(reference)).not.toContain("3".repeat(64));
    expect(
      AdmissionEvidenceSchema.safeParse({ ...evidence, apiKey: "literal-secret" }).success,
    ).toBe(false);
  });

  it("rejects a forged hash and literal secret reference", () => {
    const evidence = createAdmissionEvidence({ evidenceKey, checkedAt, status: "passed" });
    expect(
      AdmissionEvidenceSchema.safeParse({ ...evidence, evidenceKeyHash: "f".repeat(64) }).success,
    ).toBe(false);
    expect(
      AdmissionEvidenceSchema.safeParse({
        ...evidence,
        evidenceKey: { ...evidenceKey, credentialReferenceIdentity: "literal-secret" },
      }).success,
    ).toBe(false);
  });
});
