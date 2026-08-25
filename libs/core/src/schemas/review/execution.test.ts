import { describe, expect, expectTypeOf, it } from "vitest";
import { sha256CanonicalJsonSync } from "../canonical-json.js";
import {
  type HostedApiProductId,
  LOCAL_OPENAI_PRESET_ENDPOINTS,
  type LocalCliProductId,
  type LocalHttpProductId,
} from "../config/transports.js";
import {
  type EvidenceKey,
  EvidenceKeySchema,
  ExecutionFingerprintInputSchema,
  type ExecutionLimits,
  ExecutionLimitsSchema,
  ExecutionReceiptSchema,
  type ExecutionReceiptUsageState,
  ExecutionReceiptUsageStateSchema,
  ExecutionResultSchema,
  hashExecutionReceiptFingerprintSync,
  type NormalizedUsage,
  NormalizedUsageSchema,
  type RuntimeIdentity,
  TERMINAL_OUTCOMES,
} from "./index.js";

const SCHEMA_SHA256 = "1".repeat(64);
const CREDENTIAL_REFERENCE_IDENTITY = "3".repeat(64);
const INSTALLATION_ID = "codex-installation-1";

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
  credentialReferenceIdentity: CREDENTIAL_REFERENCE_IDENTITY,
  installationId: null,
  productId: "openrouter",
  transportFamily: "hosted-api",
  normalizedEndpoint: "https://openrouter.ai/api/v1",
  region: null,
  workspaceAccountReference: null,
  modelId: "openai/gpt-4.1-mini",
  runtime: { identity: "diffgazer-server", version: "1.2.3" },
  structuredOutputSchemaSha256: SCHEMA_SHA256,
  noticeVersion: 1,
  limits,
};

const localHttpEvidence: EvidenceKey = {
  ...evidenceKey,
  authentication: "none",
  credentialReferenceIdentity: null,
  productId: "local-openai",
  transportFamily: "local-http",
  normalizedEndpoint: "http://127.0.0.1:1234/v1",
  region: null,
  workspaceAccountReference: null,
  runtime: { identity: "lm-studio", version: "0.3.0" },
};

const localHttpBearerEvidence: EvidenceKey = {
  ...localHttpEvidence,
  authentication: "optional-local-bearer",
};

const localHttpCredentialEvidence: EvidenceKey = {
  ...localHttpBearerEvidence,
  credentialReferenceIdentity: "5".repeat(64),
};

const localHttpLlamaCppEvidence: EvidenceKey = {
  ...localHttpEvidence,
  normalizedEndpoint: LOCAL_OPENAI_PRESET_ENDPOINTS["llama-cpp"],
  runtime: { identity: "llama-cpp", version: "0.3.0" },
};

const allowlistEvidence: EvidenceKey = {
  ...evidenceKey,
  productId: "deepseek",
  normalizedEndpoint: "https://api.deepseek.com/v1",
  modelId: "deepseek-v4-flash",
};

type ReceiptFixture = {
  schemaVersion: 1;
  executionFingerprint: string;
  configurationId: string;
  configurationRevision: number;
  authentication: "none" | "optional-local-bearer" | null;
  credentialReferenceIdentity: string | null;
  installationId: string | null;
  productId: EvidenceKey["productId"];
  transportFamily: EvidenceKey["transportFamily"];
  modelId: string;
  normalizedEndpoint: string | null;
  region?: string;
  workspaceAccountReference?: string;
  runtime: RuntimeIdentity | null;
  structuredOutputSchemaSha256: string;
  noticeVersion: number;
  limits: ExecutionLimits;
  attemptCount: number;
  startedAt: string;
  finishedAt: string;
  usage?: NormalizedUsage;
  usageAvailability: "reported" | "required-missing" | "unavailable";
  outcome: (typeof TERMINAL_OUTCOMES)[number];
};

function makeReceipt(overrides: Partial<ReceiptFixture> = {}) {
  const receipt: ReceiptFixture = {
    schemaVersion: 1,
    executionFingerprint: "0".repeat(64),
    configurationId: "configuration-1",
    configurationRevision: 3,
    authentication: null,
    credentialReferenceIdentity: CREDENTIAL_REFERENCE_IDENTITY,
    installationId: null,
    productId: "openrouter",
    transportFamily: "hosted-api",
    modelId: "openai/gpt-4.1-mini",
    normalizedEndpoint: "https://openrouter.ai/api/v1",
    region: undefined,
    workspaceAccountReference: undefined,
    runtime: { identity: "diffgazer-server", version: "1.2.3" },
    structuredOutputSchemaSha256: SCHEMA_SHA256,
    noticeVersion: 1,
    limits,
    attemptCount: 1,
    startedAt: "2026-07-31T10:00:00.000Z",
    finishedAt: "2026-07-31T10:00:05.000Z",
    usage: { inputTokens: 100, outputTokens: 40, totalTokens: 140 },
    usageAvailability: "reported",
    outcome: "completed",
    ...overrides,
  };

  if (overrides.executionFingerprint !== undefined) return receipt;

  try {
    return {
      ...receipt,
      executionFingerprint: hashExecutionReceiptFingerprintSync({
        configurationId: receipt.configurationId,
        configurationRevision: receipt.configurationRevision,
        authentication: receipt.authentication,
        credentialReferenceIdentity: receipt.credentialReferenceIdentity,
        installationId: receipt.installationId,
        productId: receipt.productId,
        transportFamily: receipt.transportFamily,
        modelId: receipt.modelId,
        normalizedEndpoint: receipt.normalizedEndpoint ?? null,
        region: receipt.region ?? null,
        workspaceAccountReference: receipt.workspaceAccountReference ?? null,
        runtime: receipt.runtime,
        structuredOutputSchemaSha256: receipt.structuredOutputSchemaSha256,
        noticeVersion: receipt.noticeVersion,
        limits: receipt.limits,
      }),
    };
  } catch {
    return receipt;
  }
}

const hashEvidenceKey = (input: EvidenceKey): string =>
  sha256CanonicalJsonSync(EvidenceKeySchema.parse(input));

const issue = {
  id: "issue-1",
  severity: "high",
  category: "correctness",
  title: "Incorrect branch",
  file: "src/app.ts",
  line_start: 10,
  line_end: 12,
  rationale: "The branch returns the wrong value.",
  recommendation: "Return the expected value.",
  suggested_patch: null,
  confidence: 0.9,
  symptom: "The result is incorrect.",
  whyItMatters: "Callers receive invalid data.",
  evidence: [],
} as const;

describe("canonical execution hashes", () => {
  const invalidationCases: ReadonlyArray<{
    readonly base: EvidenceKey;
    readonly changed: EvidenceKey;
    readonly label: string;
  }> = [
    {
      label: "credential reference identity",
      base: evidenceKey,
      changed: { ...evidenceKey, credentialReferenceIdentity: "5".repeat(64) },
    },
    {
      label: "product",
      base: evidenceKey,
      changed: {
        ...evidenceKey,
        productId: "groq",
        normalizedEndpoint: "https://api.groq.com/openai/v1",
      },
    },
    { label: "transport family", base: evidenceKey, changed: localHttpEvidence },
    {
      label: "local HTTP authentication mode",
      base: localHttpEvidence,
      changed: localHttpBearerEvidence,
    },
    {
      label: "local HTTP credential reference",
      base: localHttpBearerEvidence,
      changed: localHttpCredentialEvidence,
    },
    {
      label: "normalized endpoint",
      base: localHttpEvidence,
      changed: localHttpLlamaCppEvidence,
    },
    {
      label: "exact model",
      base: evidenceKey,
      changed: { ...evidenceKey, modelId: "openai/gpt-4.1" },
    },
    {
      label: "runtime identity",
      base: evidenceKey,
      changed: { ...evidenceKey, runtime: { identity: "ollama", version: "1.2.3" } },
    },
    {
      label: "runtime version",
      base: evidenceKey,
      changed: { ...evidenceKey, runtime: { identity: "diffgazer-server", version: "1.2.4" } },
    },
    {
      label: "structured-output schema",
      base: evidenceKey,
      changed: { ...evidenceKey, structuredOutputSchemaSha256: "3".repeat(64) },
    },
    { label: "notice version", base: evidenceKey, changed: { ...evidenceKey, noticeVersion: 2 } },
    {
      label: "input-token limit",
      base: evidenceKey,
      changed: { ...evidenceKey, limits: { ...limits, maxInputTokens: 20_001 } },
    },
    {
      label: "response-byte limit",
      base: evidenceKey,
      changed: { ...evidenceKey, limits: { ...limits, maxResponseBytes: 1_048_577 } },
    },
    {
      label: "wall-time limit",
      base: evidenceKey,
      changed: { ...evidenceKey, limits: { ...limits, wallTimeMs: 120_001 } },
    },
    {
      label: "retry limit",
      base: evidenceKey,
      changed: { ...evidenceKey, limits: { ...limits, maxRetries: 3 } },
    },
    {
      label: "concurrency limit",
      base: evidenceKey,
      changed: { ...evidenceKey, limits: { ...limits, maxConcurrency: 2 } },
    },
    {
      label: "per-review budget",
      base: evidenceKey,
      changed: { ...evidenceKey, limits: { ...limits, maxCostUsd: 0.51 } },
    },
  ];

  it.each(invalidationCases)("changes the evidence hash when $label changes", ({
    base,
    changed,
  }) => {
    expect(hashEvidenceKey(changed)).not.toBe(hashEvidenceKey(base));
  });

  it("hashes the complete immutable admitted-plan identity", () => {
    const input = {
      configurationId: "configuration-1",
      configurationRevision: 3,
      evidenceKey,
    };
    const hashFingerprint = (fingerprint: typeof input) =>
      sha256CanonicalJsonSync(ExecutionFingerprintInputSchema.parse(fingerprint));
    const baseHash = hashFingerprint(input);

    expect(hashFingerprint({ ...input, configurationId: "configuration-2" })).not.toBe(baseHash);
    expect(hashFingerprint({ ...input, configurationRevision: 4 })).not.toBe(baseHash);
    expect(
      hashFingerprint({
        ...input,
        evidenceKey: { ...evidenceKey, modelId: "openai/gpt-4.1" },
      }),
    ).not.toBe(baseHash);
  });

  it("hashes the immutable receipt projection and excludes terminal runtime fields", () => {
    const receipt = makeReceipt();
    const input = {
      configurationId: receipt.configurationId,
      configurationRevision: receipt.configurationRevision,
      authentication: receipt.authentication,
      credentialReferenceIdentity: receipt.credentialReferenceIdentity,
      installationId: receipt.installationId,
      productId: receipt.productId,
      transportFamily: receipt.transportFamily,
      modelId: receipt.modelId,
      normalizedEndpoint: receipt.normalizedEndpoint,
      region: receipt.region ?? null,
      workspaceAccountReference: receipt.workspaceAccountReference ?? null,
      runtime: receipt.runtime,
      structuredOutputSchemaSha256: receipt.structuredOutputSchemaSha256,
      noticeVersion: receipt.noticeVersion,
      limits: receipt.limits,
    };

    expect(receipt.executionFingerprint).toBe(
      "ebbd4da18233a9bc508f7c7daf4691166fc764a2276d9cbbaeb97525a0ac6018",
    );
    expect(hashExecutionReceiptFingerprintSync(input)).toBe(receipt.executionFingerprint);
    expect(hashExecutionReceiptFingerprintSync({ ...input, modelId: "openai/gpt-4.1" })).not.toBe(
      receipt.executionFingerprint,
    );
    expect(
      hashExecutionReceiptFingerprintSync({
        ...input,
        limits: { ...limits, maxInputTokens: limits.maxInputTokens + 1 },
      }),
    ).not.toBe(receipt.executionFingerprint);
    expect(
      hashExecutionReceiptFingerprintSync({ ...input, noticeVersion: receipt.noticeVersion + 1 }),
    ).not.toBe(receipt.executionFingerprint);
  });
});

describe("execution contracts", () => {
  it("narrows EvidenceKey transport tuples at the type level", () => {
    type HostedEvidence = Extract<EvidenceKey, { transportFamily: "hosted-api" }>;
    type LocalHttpEvidence = Extract<EvidenceKey, { transportFamily: "local-http" }>;
    type LocalCliEvidence = Extract<EvidenceKey, { transportFamily: "local-cli" }>;

    expectTypeOf<HostedEvidence["productId"]>().toEqualTypeOf<HostedApiProductId>();
    expectTypeOf<LocalHttpEvidence["productId"]>().toEqualTypeOf<LocalHttpProductId>();
    expectTypeOf<LocalCliEvidence["productId"]>().toEqualTypeOf<LocalCliProductId>();
    expectTypeOf<HostedEvidence["authentication"]>().toEqualTypeOf<null>();
    expectTypeOf<LocalHttpEvidence["region"]>().toEqualTypeOf<null>();
    expectTypeOf<LocalCliEvidence["normalizedEndpoint"]>().toEqualTypeOf<null>();
    expectTypeOf<"openrouter">().not.toMatchTypeOf<LocalCliEvidence["productId"]>();
  });

  it("models receipt usage availability as a discriminated union", () => {
    const acceptUsageState = (_state: ExecutionReceiptUsageState) => undefined;

    acceptUsageState({
      usageAvailability: "reported",
      usage: { inputTokens: 1, outputTokens: 2, totalTokens: 3 },
    });
    acceptUsageState({ usageAvailability: "unavailable" });
    acceptUsageState({ usageAvailability: "required-missing" });
    // @ts-expect-error reported usage must include normalized usage.
    acceptUsageState({ usageAvailability: "reported" });
    // @ts-expect-error unavailable usage cannot include normalized usage.
    acceptUsageState({ usageAvailability: "unavailable", usage: { inputTokens: 1 } });

    expect(
      ExecutionReceiptUsageStateSchema.safeParse({
        usageAvailability: "reported",
        usage: { inputTokens: 1, outputTokens: 2, totalTokens: 3 },
      }).success,
    ).toBe(true);
    expect(
      ExecutionReceiptUsageStateSchema.safeParse({ usageAvailability: "reported" }).success,
    ).toBe(false);
    expect(
      ExecutionReceiptUsageStateSchema.safeParse({
        usageAvailability: "unavailable",
        usage: { inputTokens: 1 },
      }).success,
    ).toBe(false);
  });

  it("reports only the contradicted field of a stored receipt, not every usage branch", () => {
    const result = ExecutionReceiptSchema.safeParse(
      makeReceipt({ usageAvailability: "unavailable" }),
    );

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.issues.map((entry) => entry.path.join("."))).toEqual(["usage"]);
  });

  it("freezes parsed identities and normalizes only reported nonnegative usage", () => {
    const parsedLimits = ExecutionLimitsSchema.parse(limits);
    const parsedEvidence = EvidenceKeySchema.parse(evidenceKey);
    const parsedFingerprint = ExecutionFingerprintInputSchema.parse({
      configurationId: "configuration-1",
      configurationRevision: 3,
      evidenceKey,
    });
    const parsedReceipt = ExecutionReceiptSchema.parse(makeReceipt());

    expect(Object.isFrozen(parsedLimits)).toBe(true);
    expect(Object.isFrozen(parsedEvidence)).toBe(true);
    expect(Object.isFrozen(parsedEvidence.runtime)).toBe(true);
    expect(Object.isFrozen(parsedFingerprint)).toBe(true);
    expect(Object.isFrozen(parsedFingerprint.evidenceKey)).toBe(true);
    expect(Object.isFrozen(parsedReceipt)).toBe(true);
    expect(Object.isFrozen(parsedReceipt.limits)).toBe(true);
    expect(NormalizedUsageSchema.parse({ cachedTokens: 0, reasoningTokens: 8 })).toEqual({
      cachedTokens: 0,
      reasoningTokens: 8,
    });
    expect(NormalizedUsageSchema.safeParse({}).success).toBe(false);
    expect(NormalizedUsageSchema.safeParse({ inputTokens: -1 }).success).toBe(false);
  });

  it("rejects arbitrary and stale execution fingerprints", () => {
    const receipt = makeReceipt();
    expect(ExecutionReceiptSchema.safeParse(receipt).success).toBe(true);
    expect(
      ExecutionReceiptSchema.safeParse({
        ...receipt,
        executionFingerprint: "2".repeat(64),
      }).success,
    ).toBe(false);
    expect(
      ExecutionReceiptSchema.safeParse({
        ...receipt,
        configurationRevision: receipt.configurationRevision + 1,
      }).success,
    ).toBe(false);
    expect(
      ExecutionReceiptSchema.safeParse({
        ...receipt,
        limits: { ...limits, maxInputTokens: limits.maxInputTokens + 1 },
      }).success,
    ).toBe(false);
    expect(
      ExecutionReceiptSchema.safeParse({
        ...receipt,
        noticeVersion: receipt.noticeVersion + 1,
      }).success,
    ).toBe(false);
  });

  it("keeps retries on one admitted fingerprint without allowing tuple drift", () => {
    const receipt = makeReceipt({ attemptCount: 2 });
    expect(ExecutionReceiptSchema.safeParse(receipt).success).toBe(true);
    expect(
      ExecutionReceiptSchema.safeParse({
        ...receipt,
        modelId: "openai/gpt-4.1",
      }).success,
    ).toBe(false);
  });

  it("rejects non-runnable identities, mismatched transports, and unsafe references", () => {
    for (const productId of ["xiaomi-mimo", "bogus-product"]) {
      expect(EvidenceKeySchema.safeParse({ ...evidenceKey, productId }).success).toBe(false);
      expect(
        ExecutionReceiptSchema.safeParse(
          makeReceipt({ productId: productId as ReceiptFixture["productId"] }),
        ).success,
      ).toBe(false);
    }

    for (const invalidEvidence of [
      { ...evidenceKey, transportFamily: "local-http" },
      { ...evidenceKey, modelId: "../model" },
      { ...evidenceKey, credentialReferenceIdentity: "keyring:configuration-1:3" },
      { ...evidenceKey, workspaceAccountReference: "workspace:review-team" },
      { ...evidenceKey, runtime: { identity: "/usr/local/bin/tool", version: "1.2.3" } },
    ]) {
      expect(EvidenceKeySchema.safeParse(invalidEvidence).success).toBe(false);
    }

    for (const invalidReceipt of [
      makeReceipt({ transportFamily: "local-cli" }),
      makeReceipt({ modelId: "../model" }),
      makeReceipt({ workspaceAccountReference: "review-team" }),
      makeReceipt({ runtime: { identity: "/usr/local/bin/tool", version: "1.2.3" } }),
      makeReceipt({
        productId: "deepseek",
        modelId: "deepseek-v4-flash",
        normalizedEndpoint: "https://openrouter.ai/api/v1",
      }),
      makeReceipt({
        productId: "local-openai",
        transportFamily: "local-http",
        authentication: "none",
        credentialReferenceIdentity: CREDENTIAL_REFERENCE_IDENTITY,
        normalizedEndpoint: "http://127.0.0.1:1234/v1",
        runtime: { identity: "lm-studio", version: "0.3.0" },
      }),
    ]) {
      expect(ExecutionReceiptSchema.safeParse(invalidReceipt).success).toBe(false);
    }

    expect(
      ExecutionFingerprintInputSchema.safeParse({
        configurationId: "/home/person/configuration.json",
        configurationRevision: 3,
        evidenceKey,
      }).success,
    ).toBe(false);
  });

  it("accepts only transport-applicable execution identity fields", () => {
    expect(
      EvidenceKeySchema.safeParse({
        ...evidenceKey,
        authentication: "none",
        credentialReferenceIdentity: null,
        productId: "local-openai",
        transportFamily: "local-http",
        normalizedEndpoint: "http://127.0.0.1:1234/v1",
        region: null,
        workspaceAccountReference: null,
        runtime: { identity: "lm-studio", version: "0.3.0" },
      }).success,
    ).toBe(true);
    expect(
      EvidenceKeySchema.safeParse({
        ...evidenceKey,
        credentialReferenceIdentity: null,
        productId: "codex-cli",
        transportFamily: "local-cli",
        normalizedEndpoint: null,
        region: null,
        workspaceAccountReference: null,
        installationId: INSTALLATION_ID,
        runtime: { identity: "codex-cli", version: "0.1.0" },
      }).success,
    ).toBe(true);
    expect(
      ExecutionReceiptSchema.safeParse(
        makeReceipt({
          productId: "ollama",
          transportFamily: "local-http",
          authentication: "none",
          normalizedEndpoint: "http://127.0.0.1:11434",
          credentialReferenceIdentity: null,
          installationId: null,
          region: undefined,
          workspaceAccountReference: undefined,
          runtime: { identity: "ollama", version: "0.6.0" },
        }),
      ).success,
    ).toBe(true);
    expect(
      ExecutionReceiptSchema.safeParse(
        makeReceipt({
          productId: "copilot-cli",
          transportFamily: "local-cli",
          normalizedEndpoint: undefined,
          credentialReferenceIdentity: null,
          installationId: "copilot-installation",
          region: undefined,
          workspaceAccountReference: undefined,
          runtime: { identity: "copilot-cli", version: "0.1.0" },
        }),
      ).success,
    ).toBe(true);
  });

  it("binds local runtime identity to the selected product and preset", () => {
    expect(
      EvidenceKeySchema.safeParse({
        ...localHttpEvidence,
        runtime: { identity: "ollama", version: "0.6.0" },
      }).success,
    ).toBe(false);
    expect(
      EvidenceKeySchema.safeParse({
        ...localHttpEvidence,
        normalizedEndpoint: LOCAL_OPENAI_PRESET_ENDPOINTS["llama-cpp"],
        runtime: { identity: "lm-studio", version: "0.3.0" },
      }).success,
    ).toBe(false);
    expect(
      EvidenceKeySchema.safeParse({
        ...localHttpEvidence,
        normalizedEndpoint: LOCAL_OPENAI_PRESET_ENDPOINTS["llama-cpp"],
        runtime: { identity: "llama-cpp", version: "b-version-2026-07" },
      }).success,
    ).toBe(true);

    expect(
      EvidenceKeySchema.safeParse({
        ...localHttpEvidence,
        productId: "ollama",
        normalizedEndpoint: "http://127.0.0.1:11434",
        runtime: { identity: "lm-studio", version: "0.3.0" },
      }).success,
    ).toBe(false);
    expect(
      EvidenceKeySchema.safeParse({
        ...localHttpEvidence,
        productId: "ollama",
        normalizedEndpoint: "http://127.0.0.1:11434",
        runtime: { identity: "ollama", version: "0.6.0" },
      }).success,
    ).toBe(true);

    const localCli = {
      ...localHttpEvidence,
      authentication: null,
      credentialReferenceIdentity: null,
      productId: "codex-cli" as const,
      transportFamily: "local-cli" as const,
      normalizedEndpoint: null,
      installationId: INSTALLATION_ID,
      runtime: { identity: "copilot-cli", version: "1.0.0" },
    };
    expect(EvidenceKeySchema.safeParse(localCli).success).toBe(false);
    expect(
      EvidenceKeySchema.safeParse({
        ...localCli,
        runtime: { identity: "codex-cli", version: "1.0.0" },
      }).success,
    ).toBe(true);

    const parsed = EvidenceKeySchema.parse(localHttpEvidence);
    expect(parsed.runtime).toEqual(localHttpEvidence.runtime);
    expect(
      hashEvidenceKey({
        ...localHttpEvidence,
        runtime: { identity: "lm-studio", version: "0.3.1" },
      }),
    ).not.toBe(hashEvidenceKey(localHttpEvidence));
  });

  it("rejects forged product tuples and missing family-specific evidence", () => {
    const invalidEvidence = [
      { ...evidenceKey, normalizedEndpoint: "https://api.groq.com/openai/v1" },
      { ...evidenceKey, productId: "deepseek", normalizedEndpoint: "https://openrouter.ai/api/v1" },
      { ...evidenceKey, region: "international" },
      { ...evidenceKey, credentialReferenceIdentity: null },
      {
        ...localHttpEvidence,
        credentialReferenceIdentity: CREDENTIAL_REFERENCE_IDENTITY,
      },
      { ...localHttpEvidence, runtime: null },
      {
        ...localHttpEvidence,
        productId: "codex-cli",
        transportFamily: "local-cli",
        normalizedEndpoint: null,
        runtime: null,
      },
      {
        ...localHttpEvidence,
        productId: "codex-cli",
        transportFamily: "local-cli",
        normalizedEndpoint: null,
        installationId: null,
        runtime: { identity: "codex-cli", version: "0.1.0" },
      },
    ];

    for (const candidate of invalidEvidence) {
      expect(EvidenceKeySchema.safeParse(candidate).success).toBe(false);
    }

    expect(
      EvidenceKeySchema.safeParse({
        ...localHttpEvidence,
        authentication: "optional-local-bearer",
        credentialReferenceIdentity: null,
      }).success,
    ).toBe(true);
    expect(
      EvidenceKeySchema.safeParse({
        ...localHttpEvidence,
        authentication: "optional-local-bearer",
        credentialReferenceIdentity: CREDENTIAL_REFERENCE_IDENTITY,
      }).success,
    ).toBe(true);

    expect(
      EvidenceKeySchema.safeParse({
        ...allowlistEvidence,
        modelId: "deepseek-v5-flash",
      }).success,
    ).toBe(false);
  });

  it("admits every id the product allowlist names", () => {
    expect(EvidenceKeySchema.safeParse(allowlistEvidence).success).toBe(true);
    expect(
      EvidenceKeySchema.safeParse({ ...allowlistEvidence, modelId: "deepseek-v4-pro" }).success,
    ).toBe(true);
  });

  const pinnedRoutePolicyCases = [
    { label: "missing downstream provider", modelId: "gpt-4.1-mini", valid: false },
    { label: "automatic provider selector", modelId: "automatic/gpt-4.1", valid: false },
    { label: "automatic model selector", modelId: "openai/automatic", valid: false },
    { label: "auto provider selector", modelId: "auto/gpt-4.1", valid: false },
    { label: "auto model selector", modelId: "openai/auto", valid: false },
    { label: "aggregator self-route", modelId: "openrouter/gpt-4.1", valid: false },
    { label: "aggregator model segment", modelId: "anthropic/openrouter", valid: false },
    // Pinned variant suffixes name separately priced catalog identities; the
    // dynamic selectors below are request-time sort instructions, and an unknown
    // or stacked suffix fails closed rather than riding in on id shape.
    { label: "free suffix", modelId: "openai/gpt-4.1-mini:free", valid: true },
    { label: "thinking suffix", modelId: "openai/gpt-4.1-mini:thinking", valid: true },
    { label: "online suffix", modelId: "openai/gpt-4.1-mini:online", valid: false },
    { label: "nitro suffix", modelId: "openai/gpt-4.1-mini:nitro", valid: false },
    { label: "extended suffix", modelId: "openai/gpt-4.1-mini:extended", valid: false },
    { label: "stacked suffixes", modelId: "openai/gpt-4.1-mini:free:nitro", valid: false },
    { label: "free suffix on a router", modelId: "openrouter/free:free", valid: false },
    { label: "pinned Anthropic route", modelId: "anthropic/claude-3.7-sonnet", valid: true },
    {
      label: "reserved-word substring in provider",
      modelId: "my-openrouter/provider",
      valid: true,
    },
    { label: "reserved-word substring in model", modelId: "openai/automatic-tools", valid: true },
  ] as const;

  it.each(
    pinnedRoutePolicyCases,
  )("applies the pinned route policy to EvidenceKey, receipt, and admission ($label)", ({
    modelId,
    valid,
  }) => {
    const parsedEvidence = EvidenceKeySchema.safeParse({ ...evidenceKey, modelId });
    const parsedReceipt = ExecutionReceiptSchema.safeParse(makeReceipt({ modelId }));
    const parsedAdmission = ExecutionFingerprintInputSchema.safeParse({
      configurationId: "configuration-1",
      configurationRevision: 3,
      evidenceKey: { ...evidenceKey, modelId },
    });

    expect(parsedEvidence.success, `EvidenceKey: ${modelId}`).toBe(valid);
    expect(parsedReceipt.success, `receipt: ${modelId}`).toBe(valid);
    expect(parsedAdmission.success, `admission: ${modelId}`).toBe(valid);
  });

  it("requires the immutable notice and runtime identity for hosted evidence", () => {
    expect(EvidenceKeySchema.safeParse({ ...evidenceKey, noticeVersion: null }).success).toBe(
      false,
    );
    expect(EvidenceKeySchema.safeParse({ ...evidenceKey, noticeVersion: undefined }).success).toBe(
      false,
    );
    expect(EvidenceKeySchema.safeParse({ ...evidenceKey, runtime: null }).success).toBe(false);
    expect(ExecutionReceiptSchema.safeParse(makeReceipt({ runtime: null })).success).toBe(false);
  });

  it("binds local HTTP authentication mode and credential identity to receipt fingerprints", () => {
    const withoutBearer = makeReceipt({
      productId: "local-openai",
      transportFamily: "local-http",
      authentication: "none",
      credentialReferenceIdentity: null,
      normalizedEndpoint: "http://127.0.0.1:1234/v1",
      runtime: { identity: "lm-studio", version: "0.3.0" },
    });
    const optionalBearer = makeReceipt({
      productId: "local-openai",
      transportFamily: "local-http",
      authentication: "optional-local-bearer",
      credentialReferenceIdentity: null,
      normalizedEndpoint: "http://127.0.0.1:1234/v1",
      runtime: { identity: "lm-studio", version: "0.3.0" },
    });

    expect(ExecutionReceiptSchema.safeParse(withoutBearer).success).toBe(true);
    expect(ExecutionReceiptSchema.safeParse(optionalBearer).success).toBe(true);
    expect(optionalBearer.executionFingerprint).not.toBe(withoutBearer.executionFingerprint);
  });

  it("rejects contradictory usage totals and component counts", () => {
    for (const usage of [
      { inputTokens: 2, outputTokens: 3, totalTokens: 4 },
      { inputTokens: 2, cachedTokens: 3 },
      { outputTokens: 2, reasoningTokens: 3 },
    ]) {
      expect(NormalizedUsageSchema.safeParse(usage).success).toBe(false);
    }
    expect(NormalizedUsageSchema.safeParse({ inputTokens: 4, totalTokens: 3 }).success).toBe(false);
    expect(NormalizedUsageSchema.safeParse({ cachedTokens: 4, totalTokens: 3 }).success).toBe(
      false,
    );
    expect(
      NormalizedUsageSchema.parse({ inputTokens: 2, outputTokens: 3, totalTokens: 5 }),
    ).toEqual({
      inputTokens: 2,
      outputTokens: 3,
      totalTokens: 5,
    });
    expect(
      ExecutionReceiptSchema.safeParse(
        makeReceipt({ usage: { inputTokens: limits.maxInputTokens + 1 } }),
      ).success,
    ).toBe(false);
    expect(
      ExecutionReceiptSchema.safeParse(
        makeReceipt({ usageAvailability: "reported", usage: undefined }),
      ).success,
    ).toBe(false);
    expect(
      ExecutionReceiptSchema.safeParse(
        makeReceipt({
          outcome: "transport-failed",
          usageAvailability: "unavailable",
          usage: { inputTokens: 1 },
        }),
      ).success,
    ).toBe(false);
  });

  it("allows over-cap reported usage only for budget-exhausted receipts", () => {
    const overCapUsages: ReadonlyArray<NormalizedUsage> = [
      { inputTokens: limits.maxInputTokens + 1 },
    ];
    const inCapUsage: NormalizedUsage = {
      inputTokens: limits.maxInputTokens,
      outputTokens: 4_000,
      totalTokens: limits.maxInputTokens + 4_000,
    };

    for (const usage of [...overCapUsages, inCapUsage]) {
      expect(
        ExecutionReceiptSchema.safeParse(makeReceipt({ outcome: "budget-exhausted", usage }))
          .success,
        JSON.stringify(usage),
      ).toBe(true);
    }

    for (const outcome of TERMINAL_OUTCOMES.filter((value) => value !== "budget-exhausted")) {
      for (const usage of overCapUsages) {
        expect(
          ExecutionReceiptSchema.safeParse(makeReceipt({ outcome, usage })).success,
          `${outcome}: ${JSON.stringify(usage)}`,
        ).toBe(false);
      }
    }
  });

  it("rejects impossible completed receipt attempts and timestamps", () => {
    expect(ExecutionReceiptSchema.safeParse(makeReceipt({ attemptCount: 0 })).success).toBe(false);
    expect(
      ExecutionReceiptSchema.safeParse(
        makeReceipt({
          attemptCount: 4,
          limits: { ...limits, maxRetries: 2 },
        }),
      ).success,
    ).toBe(false);
    expect(
      ExecutionReceiptSchema.safeParse(
        makeReceipt({
          startedAt: "2026-07-31T10:00:05.000Z",
          finishedAt: "2026-07-31T10:00:04.000Z",
        }),
      ).success,
    ).toBe(false);
    expect(
      ExecutionReceiptSchema.safeParse(
        makeReceipt({
          limits: { ...limits, wallTimeMs: 1_000 },
          finishedAt: "2026-07-31T10:00:05.001Z",
        }),
      ).success,
    ).toBe(false);
  });

  it("allows schema-valid findings only with a completed receipt", () => {
    expect(
      ExecutionResultSchema.safeParse({
        receipt: makeReceipt(),
        result: { issues: [issue] },
      }).success,
    ).toBe(true);

    for (const outcome of TERMINAL_OUTCOMES.filter((value) => value !== "completed")) {
      expect(
        ExecutionResultSchema.safeParse({
          receipt: makeReceipt({ outcome }),
          result: { issues: [issue] },
        }).success,
        outcome,
      ).toBe(false);
      expect(
        ExecutionResultSchema.safeParse({
          receipt: makeReceipt({ outcome }),
          result: { issues: [] },
        }).success,
        outcome,
      ).toBe(true);
    }
  });

  it.each([
    ["malformed output", makeReceipt({ outcome: "schema-failed" })],
    ["partial output", makeReceipt({ outcome: "transport-failed" })],
    [
      "required usage missing",
      makeReceipt({
        outcome: "schema-failed",
        usage: undefined,
        usageAvailability: "required-missing",
      }),
    ],
  ])("keeps zero findings when %s", (_, receipt) => {
    expect(ExecutionResultSchema.safeParse({ receipt, result: { issues: [] } }).success).toBe(true);
    expect(ExecutionResultSchema.safeParse({ receipt, result: { issues: [issue] } }).success).toBe(
      false,
    );
  });

  it("rejects a completed receipt when documented usage is required but missing", () => {
    expect(
      ExecutionReceiptSchema.safeParse(
        makeReceipt({ usage: undefined, usageAvailability: "required-missing" }),
      ).success,
    ).toBe(false);
  });

  it("requires terminal usage for products whose admission policy documents it", () => {
    expect(
      ExecutionReceiptSchema.safeParse(
        makeReceipt({
          productId: "deepseek",
          normalizedEndpoint: "https://api.deepseek.com/v1",
          modelId: "deepseek-v4-flash",
          usage: undefined,
          usageAvailability: "unavailable",
        }),
      ).success,
    ).toBe(false);
    expect(
      ExecutionReceiptSchema.safeParse(
        makeReceipt({
          productId: "deepseek",
          normalizedEndpoint: "https://api.deepseek.com/v1",
          modelId: "deepseek-v4-flash",
          usage: undefined,
          usageAvailability: "required-missing",
          outcome: "transport-failed",
        }),
      ).success,
    ).toBe(true);
  });
});
