import { ok } from "@diffgazer/core/result";
import type { EvidenceKey } from "@diffgazer/core/schemas/review";
import { ExecutionResultSchema } from "@diffgazer/core/schemas/review";
import { makeIssue } from "@diffgazer/core/testing/factories";
import { describe, expect, it, vi } from "vitest";
import type { AdapterExecuteRequest } from "../types.js";
import {
  CLI_CREDENTIAL_ENV_KEYS,
  type CliCompatibilityRecord,
  HOSTILE_ATTEMPT_IDS,
} from "./cli-compatibility/compat.js";
import { buildCliCompatibilityTuple } from "./cli-review-driver.js";
import {
  assertCodexArgvFlagsAllowlisted,
  buildCodexCliExecArgv,
  CODEX_CLI_ACCEPTED_FLAGS,
  createCodexCliAdapter,
  parseCodexOutputLastMessage,
} from "./codex-cli.js";

const downstreamCompatibilityRecords = vi.hoisted(() => new WeakSet<object>());

vi.mock("./cli-compatibility/compat.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./cli-compatibility/compat.js")>();
  return {
    ...actual,
    matchCliCompatibilityTuple: (
      record: Parameters<typeof actual.matchCliCompatibilityTuple>[0],
      tuple: Parameters<typeof actual.matchCliCompatibilityTuple>[1],
    ) => {
      if (!record || !downstreamCompatibilityRecords.has(record)) {
        return actual.matchCliCompatibilityTuple(record, tuple);
      }
      return actual.matchCliCompatibilityTuple(
        {
          ...record,
          profile: {
            ...record.profile,
            argv: ["--model", record.model.requested],
            acceptedFlags: ["--model"],
          },
        },
        tuple,
      );
    },
  };
});

const SHA = "a".repeat(64);
const SHA_B = "b".repeat(64);
const SHA_C = "c".repeat(64);
const SHA_D = "d".repeat(64);
const SHA_E = "e".repeat(64);
const SHA_F = "f".repeat(64);
const SHA_G = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
const SHA_H = "fedcba9876543210fedcba9876543210fedcba9876543210fedcba9876543210";

const limits = {
  maxInputTokens: 20_000,
  maxResponseBytes: 1_048_576,
  wallTimeMs: 120_000,
  maxRetries: 2,
  maxConcurrency: 1,
  maxCostUsd: 0.5,
} as const;

const VERSION = "0.42.0";
const MODEL_ID = "gpt-4.1";
const EXECUTABLE = process.execPath;

function createCodexRecord(
  overrides: Partial<CliCompatibilityRecord> = {},
): CliCompatibilityRecord {
  const base: CliCompatibilityRecord = {
    schemaVersion: 1,
    provider: "codex-cli",
    observedAt: "2026-01-01T00:00:00.000Z",
    platform: {
      nodePlatform: process.platform,
      architecture: process.arch,
      osReleaseDigest: SHA,
    },
    executable: {
      realPathDigest: SHA_B,
      fileSha256: SHA_C,
      version: {
        value: VERSION,
        acquisitionArgv: [EXECUTABLE, "--version"],
        rawOutputSha256: SHA_D,
      },
    },
    auth: {
      mode: "vendor-managed-local-auth",
      credentialPassedByDiffgazer: false,
      authStoreEvidence: "vendor-managed-user-owned",
    },
    model: {
      requested: MODEL_ID,
      policyCheck: "accepted",
      rawOutputSha256: SHA_E,
    },
    profile: {
      argv: [
        "exec",
        ...CODEX_CLI_ACCEPTED_FLAGS.filter((flag) => flag !== "--model"),
        "/tmp/review-schema.json",
        "/tmp/result.json",
        "--model",
        MODEL_ID,
        "[REDACTED]",
      ],
      acceptedFlags: [...CODEX_CLI_ACCEPTED_FLAGS],
      workingDirectoryKind: "neutral-disposable-fixture",
    },
    positiveFixture: {
      exitCode: 0,
      stdoutJsonlSha256: SHA_F,
      reviewSchemaSha256: SHA_G,
      terminal: {
        source: "codex-output-last-message",
        acceptedEventKinds: [],
        acceptedFieldPaths: ["issues"],
        resultTextFieldPath: "issues",
        parserResult: "accepted",
      },
    },
    negativeFixture: {
      attemptIds: [...HOSTILE_ATTEMPT_IDS],
      beforeTreeSha256: SHA_H,
      afterTreeSha256: SHA_H,
      treeUnchanged: true,
      localNetworkConnections: 0,
      observedToolOrActionKinds: [],
      passed: true,
    },
  };

  return {
    ...base,
    ...overrides,
    platform: { ...base.platform, ...overrides.platform },
    executable: {
      ...base.executable,
      ...overrides.executable,
      version: { ...base.executable.version, ...overrides.executable?.version },
    },
    auth: { ...base.auth, ...overrides.auth },
    model: { ...base.model, ...overrides.model },
    profile: { ...base.profile, ...overrides.profile },
    positiveFixture: {
      ...base.positiveFixture,
      ...overrides.positiveFixture,
      terminal: {
        ...base.positiveFixture.terminal,
        ...overrides.positiveFixture?.terminal,
      },
    },
    negativeFixture: { ...base.negativeFixture, ...overrides.negativeFixture },
  };
}

function evidenceKey(): EvidenceKey {
  return {
    authentication: null,
    credentialReferenceIdentity: null,
    installationId: "codex-installation-1",
    productId: "codex-cli",
    transportFamily: "local-cli",
    normalizedEndpoint: null,
    region: null,
    workspaceAccountReference: null,
    modelId: MODEL_ID,
    runtime: { identity: "codex-cli", version: VERSION },
    structuredOutputSchemaSha256: SHA_G,
    noticeVersion: 1,
    limits,
  };
}

function executeRequest(): AdapterExecuteRequest {
  return {
    configurationId: "configuration-1",
    configurationRevision: 3,
    evidenceKey: evidenceKey(),
    prompt: "Return a minimal valid review JSON object with an empty issues array.",
  };
}

async function createRuntimeMatchedRecord(
  overrides: Partial<CliCompatibilityRecord> = {},
): Promise<CliCompatibilityRecord> {
  const request = executeRequest();
  const tuple = await buildCliCompatibilityTuple("codex-cli", request, EXECUTABLE, VERSION);
  return createCodexRecord({
    ...overrides,
    platform: {
      nodePlatform: tuple.platform.nodePlatform,
      architecture: tuple.platform.architecture,
      osReleaseDigest: SHA,
    },
    executable: {
      realPathDigest: tuple.executable.realPathDigest,
      fileSha256: tuple.executable.fileSha256,
      version: {
        value: tuple.executable.version,
        acquisitionArgv: [EXECUTABLE, "--version"],
        rawOutputSha256: SHA_D,
      },
    },
    model: {
      requested: tuple.modelId,
      policyCheck: "accepted",
      rawOutputSha256: SHA_E,
      ...overrides.model,
    },
    positiveFixture: {
      exitCode: 0,
      stdoutJsonlSha256: SHA_F,
      reviewSchemaSha256: tuple.reviewSchemaSha256,
      terminal: {
        source: "codex-output-last-message",
        acceptedEventKinds: [],
        acceptedFieldPaths: ["issues"],
        resultTextFieldPath: "issues",
        parserResult: "accepted",
      },
    },
  });
}

function dependencies(record: CliCompatibilityRecord) {
  return {
    resolveExecutable: async () => ok(EXECUTABLE),
    acquireVersion: async () => ok(VERSION),
    probeAuth: async () => ok({ authStoreEvidence: "vendor-managed-user-owned" as const }),
    probeModelPolicy: async () => ok({ accepted: true, rawOutput: MODEL_ID }),
    resolveCompatibilityRecord: async () => record,
    runProcess: async () => ({
      exitCode: 0,
      signal: null,
      stdout: "",
      stderr: "",
      cancelledLocally: false,
      descendantsTerminatedLocally: false,
      outputTruncated: false,
      timedOut: false,
    }),
    readResultFile: async () => ok(JSON.stringify({ issues: [] })),
    now: () => new Date("2026-01-01T00:00:00.000Z"),
  };
}

function successDependencies(record: CliCompatibilityRecord) {
  downstreamCompatibilityRecords.add(record);
  return dependencies(record);
}

describe("buildCodexCliExecArgv", () => {
  it("uses only verified Codex flags", () => {
    const argv = buildCodexCliExecArgv({
      reviewSchemaPath: "/tmp/review-schema.json",
      resultPath: "/tmp/result.json",
      modelId: MODEL_ID,
    });
    expect(argv).toEqual([
      "exec",
      "--ephemeral",
      "--sandbox",
      "read-only",
      "--ignore-user-config",
      "--ignore-rules",
      "--json",
      "--output-schema",
      "/tmp/review-schema.json",
      "--output-last-message",
      "/tmp/result.json",
      "--model",
      MODEL_ID,
      "-",
    ]);
  });
});

describe("parseCodexOutputLastMessage", () => {
  it("accepts a matching generated record terminal payload", () => {
    const record = createCodexRecord();
    const parsed = parseCodexOutputLastMessage(JSON.stringify({ issues: [makeIssue()] }), record);
    expect(parsed.ok).toBe(true);
  });

  it("rejects malformed last-message JSON", () => {
    const record = createCodexRecord();
    expect(parseCodexOutputLastMessage("{not-json", record)).toEqual({
      ok: false,
      error: { code: "malformed-json" },
    });
  });

  it("rejects schema failure", () => {
    const record = createCodexRecord();
    expect(
      parseCodexOutputLastMessage(JSON.stringify({ issues: [{ invalid: true }] }), record),
    ).toEqual({
      ok: false,
      error: { code: "schema-failed" },
    });
  });

  it("rejects unrecorded terminal field paths", () => {
    const record = createCodexRecord();
    expect(parseCodexOutputLastMessage(JSON.stringify({ unknown: [] }), record)).toEqual({
      ok: false,
      error: { code: "parser-allowlist" },
    });
  });
});

describe("codex CLI adapter execute contract", () => {
  it("fails closed before spawning for a read-capable compatibility profile", async () => {
    const record = await createRuntimeMatchedRecord();
    let processStarted = false;
    const result = await createCodexCliAdapter({
      ...dependencies(record),
      runProcess: async () => {
        processStarted = true;
        return {
          exitCode: 0,
          signal: null,
          stdout: "",
          stderr: "",
          cancelledLocally: false,
          descendantsTerminatedLocally: false,
          outputTruncated: false,
          timedOut: false,
        };
      },
    }).execute(executeRequest());

    expect(result.receipt.outcome).toBe("transport-failed");
    expect(processStarted).toBe(false);
  });

  it("preserves downstream execution behind the test-local admission seam", async () => {
    const record = await createRuntimeMatchedRecord();
    const result = await createCodexCliAdapter(successDependencies(record)).execute(
      executeRequest(),
    );

    expect(result.receipt.outcome).toBe("completed");
    expect(result.result.issues).toEqual([]);
    expect(ExecutionResultSchema.safeParse(result).success).toBe(true);
  });

  it("rejects an oversized result.json before parsing and settles measured bytes", async () => {
    const record = await createRuntimeMatchedRecord();
    const oversized = "x".repeat(limits.maxResponseBytes + 1);
    const result = await createCodexCliAdapter({
      ...successDependencies(record),
      readResultFile: async () => ok(oversized),
    }).execute(executeRequest());

    expect(result.receipt.outcome).toBe("transport-failed");
  });

  it("rejects absent compatibility record", async () => {
    const absent = await createCodexCliAdapter({
      ...successDependencies(await createRuntimeMatchedRecord()),
      resolveCompatibilityRecord: async () => null,
    }).execute(executeRequest());

    expect(absent.receipt.outcome).toBe("transport-failed");
    expect(absent.result.issues).toEqual([]);
  });

  it("rejects mismatched compatibility record", async () => {
    const record = await createRuntimeMatchedRecord({
      model: { requested: "other-model", policyCheck: "accepted", rawOutputSha256: SHA_E },
    });
    const result = await createCodexCliAdapter(successDependencies(record)).execute(
      executeRequest(),
    );

    expect(result.receipt.outcome).toBe("transport-failed");
    expect(result.result.issues).toEqual([]);
  });

  it("rejects event-only JSONL stdout completion", async () => {
    const record = await createRuntimeMatchedRecord();
    const result = await createCodexCliAdapter({
      ...successDependencies(record),
      runProcess: async () => ({
        exitCode: 0,
        signal: null,
        stdout: '{"type":"turn.completed"}\n{"type":"done"}\n',
        stderr: "",
        cancelledLocally: false,
        descendantsTerminatedLocally: false,
        outputTruncated: false,
        timedOut: false,
      }),
    }).execute(executeRequest());

    expect(result.receipt.outcome).toBe("schema-failed");
    expect(result.result.issues).toEqual([]);
  });

  it("rejects unrecorded argv flags", async () => {
    const record = await createRuntimeMatchedRecord({
      profile: {
        argv: ["exec", "--model", MODEL_ID],
        acceptedFlags: ["--model"],
        workingDirectoryKind: "neutral-disposable-fixture",
      },
    });

    expect(() =>
      assertCodexArgvFlagsAllowlisted(
        record,
        buildCodexCliExecArgv({
          reviewSchemaPath: "/tmp/review-schema.json",
          resultPath: "/tmp/result.json",
          modelId: MODEL_ID,
        }),
      ),
    ).toThrow(/Unrecorded Codex argv flag/);
  });

  it("rejects version mismatch", async () => {
    const record = await createRuntimeMatchedRecord();
    const result = await createCodexCliAdapter({
      ...successDependencies(record),
      acquireVersion: async () => ok("9.9.9"),
    }).execute(executeRequest());

    expect(result.receipt.outcome).toBe("transport-failed");
  });

  it("rejects rejected model policy", async () => {
    const record = await createRuntimeMatchedRecord();
    const result = await createCodexCliAdapter({
      ...successDependencies(record),
      probeModelPolicy: async () => ok({ accepted: false, rawOutput: "missing model" }),
    }).execute(executeRequest());

    expect(result.receipt.outcome).toBe("transport-failed");
  });

  it("rejects nonzero exit", async () => {
    const record = await createRuntimeMatchedRecord();
    const result = await createCodexCliAdapter({
      ...successDependencies(record),
      runProcess: async () => ({
        exitCode: 1,
        signal: null,
        stdout: "",
        stderr: "failed",
        cancelledLocally: false,
        descendantsTerminatedLocally: false,
        outputTruncated: false,
        timedOut: false,
      }),
    }).execute(executeRequest());

    expect(result.receipt.outcome).toBe("transport-failed");
  });

  it("rejects unavailable ambient auth", async () => {
    const record = await createRuntimeMatchedRecord();
    const result = await createCodexCliAdapter({
      ...successDependencies(record),
      probeAuth: async () => ok({ authStoreEvidence: "unavailable" }),
    }).execute(executeRequest());

    expect(result.receipt.outcome).toBe("transport-failed");
  });

  it.each(
    CLI_CREDENTIAL_ENV_KEYS,
  )("does not pass credential env keys to the child process for %s", async (key) => {
    const record = await createRuntimeMatchedRecord();
    let childEnv: Record<string, string> = {};
    const previous = process.env[key];
    process.env[key] = "injected-secret";
    try {
      await createCodexCliAdapter({
        ...successDependencies(record),
        runProcess: async (input) => {
          childEnv = { ...input.env };
          return {
            exitCode: 0,
            signal: null,
            stdout: "",
            stderr: "",
            cancelledLocally: false,
            descendantsTerminatedLocally: false,
            outputTruncated: false,
            timedOut: false,
          };
        },
        readResultFile: async () => ok(JSON.stringify({ issues: [] })),
      }).execute(executeRequest());
      expect(childEnv[key]).toBeUndefined();
    } finally {
      if (previous === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = previous;
      }
    }
  });
});

describe("Codex prompt privacy and admitted wall time", () => {
  it("keeps a near-limit prompt out of argv and hands it to the child on stdin", async () => {
    const record = await createRuntimeMatchedRecord();
    const request = {
      ...executeRequest(),
      prompt: `secret-diff-${"x".repeat(512 * 1024)}`,
      systemPrompt: "invariant reviewer instructions",
    };
    let observed: { argv: readonly string[]; stdin: string; timeoutMs?: number } | null = null;

    const result = await createCodexCliAdapter({
      ...successDependencies(record),
      runProcess: async (input) => {
        observed = { argv: input.argv, stdin: input.stdin, timeoutMs: input.timeoutMs };
        return {
          exitCode: 0,
          signal: null,
          stdout: "",
          stderr: "",
          cancelledLocally: false,
          descendantsTerminatedLocally: false,
          outputTruncated: false,
          timedOut: false,
        };
      },
    }).execute(request);

    expect(result.receipt.outcome).toBe("completed");
    const run = observed as unknown as { argv: string[]; stdin: string; timeoutMs?: number };
    expect(run.argv.some((token) => token.includes("secret-diff-"))).toBe(false);
    expect(run.argv.at(-1)).toBe("-");
    expect(run.stdin).toBe(`invariant reviewer instructions\n\n${request.prompt}`);
    expect(run.timeoutMs).toBeGreaterThan(0);
    expect(run.timeoutMs ?? Number.POSITIVE_INFINITY).toBeLessThanOrEqual(
      request.evidenceKey.limits.wallTimeMs,
    );
  });
});
