import { describe, expect, it } from "vitest";
import {
  CanonicalJsonParseError,
  canonicalJson,
  MAX_CANONICAL_JSON_BYTES,
  MAX_CANONICAL_JSON_COLLECTION_ITEMS,
  MAX_CANONICAL_JSON_DEPTH,
  parseCanonicalJson,
  sha256CanonicalJson,
  sha256CanonicalJsonSync,
} from "../canonical-json.js";
import { REMOVED_PRODUCT_ID } from "../config/providers.js";
import { LOCAL_OPENAI_PRESET_ENDPOINTS } from "../config/transports.js";
import {
  type EvidenceKey,
  EvidenceKeySchema,
  ExecutionFingerprintInputSchema,
  type ExecutionLimits,
  ExecutionLimitsSchema,
  ExecutionReceiptSchema,
  ExecutionResultSchema,
  hashEvidenceKey,
  hashExecutionFingerprint,
  hashExecutionReceiptFingerprintSync,
  type NormalizedUsage,
  NormalizedUsageSchema,
  type RuntimeIdentity,
  TERMINAL_OUTCOMES,
} from "./index.js";

const SCHEMA_SHA256 = "1".repeat(64);
const CREDENTIAL_REFERENCE_IDENTITY = "3".repeat(64);
const WORKSPACE_ACCOUNT_REFERENCE = "4".repeat(64);
const INSTALLATION_ID = "codex-installation-1";

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
  runtime: { identity: "lm-studio", version: "0.3.0" },
};

const regionalEvidence: EvidenceKey = {
  ...evidenceKey,
  productId: "moonshot",
  normalizedEndpoint: "https://api.moonshot.cn/v1",
  region: "mainland",
  modelId: "kimi-k3-2026-01",
};

const workspaceEvidence: EvidenceKey = {
  ...evidenceKey,
  productId: "qwen",
  normalizedEndpoint: "https://dashscope-intl.aliyuncs.com/compatible-mode/v1",
  region: "international",
  workspaceAccountReference: WORKSPACE_ACCOUNT_REFERENCE,
  modelId: "qwen3-coder-flash",
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
  workspace?: string;
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
    workspace: undefined,
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
        workspaceAccountReference: receipt.workspace ?? null,
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

function captureParseError(parse: () => unknown): CanonicalJsonParseError {
  try {
    parse();
  } catch (error) {
    if (error instanceof CanonicalJsonParseError) return error;
    throw error;
  }
  throw new Error("Expected canonical JSON parsing to fail");
}

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
  it("produces a deterministic lowercase SHA-256 vector from canonical UTF-8 JSON", async () => {
    expect(canonicalJson({ z: 1, a: 2 })).toBe('{"a":2,"z":1}');
    expect(canonicalJson({ list: ["z", "a"], nested: { z: null, a: true } })).toBe(
      '{"list":["z","a"],"nested":{"a":true,"z":null}}',
    );

    const digest = await sha256CanonicalJson({ z: 1, a: 2 });

    expect(digest).toBe("c2985c5ba6f7d2a55e768f92490ca09388e95bc4cccb9fdf11b15f4d42f93e73");
    expect(sha256CanonicalJsonSync({ z: 1, a: 2 })).toBe(digest);
    expect(digest).toMatch(/^[a-f0-9]{64}$/);
  });

  it("rejects values that cannot have an unambiguous canonical JSON encoding", () => {
    expect(() => canonicalJson({ value: undefined })).toThrow("does not support undefined");
    expect(() => canonicalJson({ value: Number.POSITIVE_INFINITY })).toThrow(
      "requires finite numbers",
    );
    expect(() => canonicalJson(new Array(1))).toThrow("does not accept sparse arrays");
    const cyclic: { self?: unknown } = {};
    cyclic.self = cyclic;
    expect(() => canonicalJson(cyclic)).toThrow("cyclic values");
  });

  it("rejects duplicate keys before materializing untrusted JSON", () => {
    expect(() => parseCanonicalJson('{"a":1,"a":2}')).toThrow("duplicate object key");
    expect(() => parseCanonicalJson('{"outer":{"a":1,"a":2}}')).toThrow("duplicate object key");
    expect(() => parseCanonicalJson('{"a":')).toThrow("expected JSON value");
    expect(parseCanonicalJson('{"z":1,"a":[true,null]}')).toEqual({
      z: 1,
      a: [true, null],
    });
  });

  it("does not include untrusted duplicate keys in parser diagnostics", () => {
    const secretLikeKey = "authorization-token=super-secret-value";
    const error = captureParseError(() =>
      parseCanonicalJson(`{"${secretLikeKey}":1,"${secretLikeKey}":2}`),
    );

    expect(error.reason).toBe("duplicate object key");
    expect(error.message).not.toContain(secretLikeKey);
  });

  it("accepts only the four JSON whitespace characters", () => {
    for (const whitespace of [" ", "\t", "\n", "\r"]) {
      expect(parseCanonicalJson(`${whitespace}{"a":1}${whitespace}`)).toEqual({ a: 1 });
      expect(parseCanonicalJson(`{"a"${whitespace}:1}`)).toEqual({ a: 1 });
    }

    for (const whitespace of [
      "\u000b",
      "\u000c",
      "\u0085",
      "\u00a0",
      "\u2028",
      "\u2029",
      "\ufeff",
    ]) {
      expect(() => parseCanonicalJson(`${whitespace}{"a":1}`)).toThrow(CanonicalJsonParseError);
      expect(() => parseCanonicalJson(`{"a"${whitespace}:1}`)).toThrow(CanonicalJsonParseError);
      expect(() => parseCanonicalJson(`{"a":1}${whitespace}`)).toThrow(CanonicalJsonParseError);
    }
  });

  it("fails with a typed error before parsing oversized, deeply nested, or wide JSON", () => {
    const oversized = `"${"x".repeat(MAX_CANONICAL_JSON_BYTES)}"`;
    expect(() => parseCanonicalJson(oversized)).toThrow(CanonicalJsonParseError);
    expect(() => parseCanonicalJson(oversized)).toThrow("bounded 64 KiB limit");

    const astralOversized = `"${"😀".repeat(Math.ceil(MAX_CANONICAL_JSON_BYTES / 4))}"`;
    expect(() => parseCanonicalJson(astralOversized)).toThrow(CanonicalJsonParseError);

    const deeplyNested = `${"[".repeat(MAX_CANONICAL_JSON_DEPTH + 1)}0${"]".repeat(
      MAX_CANONICAL_JSON_DEPTH + 1,
    )}`;
    const depthError = captureParseError(() => parseCanonicalJson(deeplyNested));
    expect(depthError).toBeInstanceOf(CanonicalJsonParseError);
    expect(depthError.reason).toBe("maximum JSON depth exceeded");

    const wide = `[${Array.from({ length: MAX_CANONICAL_JSON_COLLECTION_ITEMS + 1 }, () => "0").join(",")}]`;
    const collectionError = captureParseError(() => parseCanonicalJson(wide));
    expect(collectionError).toBeInstanceOf(CanonicalJsonParseError);
    expect(collectionError.reason).toBe("maximum JSON collection size exceeded");
  });

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
      changed: { ...localHttpEvidence, authentication: "optional-local-bearer" },
    },
    {
      label: "local HTTP credential reference",
      base: { ...localHttpEvidence, authentication: "optional-local-bearer" },
      changed: {
        ...localHttpEvidence,
        authentication: "optional-local-bearer",
        credentialReferenceIdentity: "5".repeat(64),
      },
    },
    {
      label: "normalized endpoint",
      base: localHttpEvidence,
      changed: {
        ...localHttpEvidence,
        normalizedEndpoint: LOCAL_OPENAI_PRESET_ENDPOINTS["llama-cpp"],
        runtime: { identity: "llama-cpp", version: "0.3.0" },
      },
    },
    {
      label: "region",
      base: regionalEvidence,
      changed: {
        ...regionalEvidence,
        normalizedEndpoint: "https://api.moonshot.ai/v1",
        region: "international",
      },
    },
    {
      label: "workspace/account reference",
      base: workspaceEvidence,
      changed: { ...workspaceEvidence, workspaceAccountReference: "6".repeat(64) },
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
      label: "output-token limit",
      base: evidenceKey,
      changed: { ...evidenceKey, limits: { ...limits, maxOutputTokens: 4_001 } },
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

  it.each(invalidationCases)("changes the evidence hash when $label changes", async ({
    base,
    changed,
  }) => {
    expect(await hashEvidenceKey(changed)).not.toBe(await hashEvidenceKey(base));
  });

  it("hashes the complete immutable admitted-plan identity", async () => {
    const input = {
      configurationId: "configuration-1",
      configurationRevision: 3,
      evidenceKey,
    };
    const baseHash = await hashExecutionFingerprint(input);

    expect(
      await hashExecutionFingerprint({ ...input, configurationId: "configuration-2" }),
    ).not.toBe(baseHash);
    expect(await hashExecutionFingerprint({ ...input, configurationRevision: 4 })).not.toBe(
      baseHash,
    );
    expect(
      await hashExecutionFingerprint({
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
      workspaceAccountReference: receipt.workspace ?? null,
      runtime: receipt.runtime,
      structuredOutputSchemaSha256: receipt.structuredOutputSchemaSha256,
      noticeVersion: receipt.noticeVersion,
      limits: receipt.limits,
    };

    expect(hashExecutionReceiptFingerprintSync(input)).toBe(receipt.executionFingerprint);
    expect(hashExecutionReceiptFingerprintSync({ ...input, modelId: "openai/gpt-4.1" })).not.toBe(
      receipt.executionFingerprint,
    );
    expect(
      hashExecutionReceiptFingerprintSync({
        ...input,
        limits: { ...limits, maxOutputTokens: limits.maxOutputTokens + 1 },
      }),
    ).not.toBe(receipt.executionFingerprint);
    expect(
      hashExecutionReceiptFingerprintSync({ ...input, noticeVersion: receipt.noticeVersion + 1 }),
    ).not.toBe(receipt.executionFingerprint);
  });
});

describe("execution contracts", () => {
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
        limits: { ...limits, maxOutputTokens: limits.maxOutputTokens + 1 },
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
    for (const productId of [REMOVED_PRODUCT_ID, "xiaomi-mimo", "bogus-product"]) {
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
      makeReceipt({ workspace: "review-team" }),
      makeReceipt({ runtime: { identity: "/usr/local/bin/tool", version: "1.2.3" } }),
      makeReceipt({
        productId: "qwen",
        modelId: "qwen3-coder-flash",
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
          workspace: undefined,
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
          workspace: undefined,
          runtime: { identity: "copilot-cli", version: "0.1.0" },
        }),
      ).success,
    ).toBe(true);
  });

  it("binds local runtime identity to the selected product and preset", async () => {
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
      await hashEvidenceKey({
        ...localHttpEvidence,
        runtime: { identity: "lm-studio", version: "0.3.1" },
      }),
    ).not.toBe(await hashEvidenceKey(localHttpEvidence));
  });

  it("rejects forged product tuples and missing family-specific evidence", () => {
    const invalidEvidence = [
      { ...evidenceKey, normalizedEndpoint: "https://api.groq.com/openai/v1" },
      { ...evidenceKey, productId: "qwen", normalizedEndpoint: "https://openrouter.ai/api/v1" },
      {
        ...evidenceKey,
        productId: "qwen",
        region: "international",
        workspaceAccountReference: null,
      },
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
        ...workspaceEvidence,
        modelId: "kimi-k3-2026-01",
      }).success,
    ).toBe(false);
    expect(
      EvidenceKeySchema.safeParse({
        ...regionalEvidence,
        modelId: "kimi-latest",
      }).success,
    ).toBe(false);
  });

  it("fails closed for opt-in and higher-cost model policies", () => {
    const zaiFlash = {
      ...evidenceKey,
      productId: "zai" as const,
      normalizedEndpoint: "https://api.z.ai/api/paas/v4",
      modelId: "glm-4.7-flash",
    };
    expect(EvidenceKeySchema.safeParse(zaiFlash).success).toBe(false);
    expect(EvidenceKeySchema.safeParse({ ...zaiFlash, modelId: "glm-4.7" }).success).toBe(true);

    const qwenPlus = { ...workspaceEvidence, modelId: "qwen3-coder-plus" };
    expect(EvidenceKeySchema.safeParse(qwenPlus).success).toBe(false);
    expect(EvidenceKeySchema.safeParse({ ...qwenPlus, modelId: "qwen3-coder-flash" }).success).toBe(
      true,
    );

    // DeepSeek's higher-cost marker has no output-limit/conformance requirement;
    // the generic allowlist must not accidentally reject that separate policy.
    expect(
      EvidenceKeySchema.safeParse({
        ...evidenceKey,
        productId: "deepseek" as const,
        normalizedEndpoint: "https://api.deepseek.com/v1",
        modelId: "deepseek-v4-pro",
      }).success,
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
    { label: "free suffix", modelId: "openai/gpt-4.1-mini:free", valid: false },
    { label: "online suffix", modelId: "openai/gpt-4.1-mini:online", valid: false },
    { label: "nitro suffix", modelId: "openai/gpt-4.1-mini:nitro", valid: false },
    { label: "thinking suffix", modelId: "openai/gpt-4.1-mini:thinking", valid: false },
    { label: "extended suffix", modelId: "openai/gpt-4.1-mini:extended", valid: false },
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
        makeReceipt({ usage: { outputTokens: limits.maxOutputTokens + 1 } }),
      ).success,
    ).toBe(false);
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
          productId: "qwen",
          normalizedEndpoint: "https://dashscope-intl.aliyuncs.com/compatible-mode/v1",
          region: "international",
          workspace: WORKSPACE_ACCOUNT_REFERENCE,
          modelId: "qwen3-coder-flash",
          usage: undefined,
          usageAvailability: "unavailable",
        }),
      ).success,
    ).toBe(false);
    expect(
      ExecutionReceiptSchema.safeParse(
        makeReceipt({
          productId: "qwen",
          normalizedEndpoint: "https://dashscope-intl.aliyuncs.com/compatible-mode/v1",
          region: "international",
          workspace: WORKSPACE_ACCOUNT_REFERENCE,
          modelId: "qwen3-coder-flash",
          usage: undefined,
          usageAvailability: "required-missing",
          outcome: "transport-failed",
        }),
      ).success,
    ).toBe(true);
  });

  it("resolves execution schemas and hashing inputs from the review schema barrel", () => {
    expect(EvidenceKeySchema.parse(evidenceKey)).toEqual(evidenceKey);
    expect(
      ExecutionFingerprintInputSchema.safeParse({
        configurationId: "configuration-1",
        configurationRevision: 3,
        evidenceKey,
      }).success,
    ).toBe(true);
    expect(ExecutionReceiptSchema.safeParse(makeReceipt()).success).toBe(true);
  });
});
