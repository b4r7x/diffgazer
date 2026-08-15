import { ok } from "@diffgazer/core/result";
import type { EvidenceKey } from "@diffgazer/core/schemas/review";
import { ExecutionResultSchema } from "@diffgazer/core/schemas/review";
import { describe, expect, it, vi } from "vitest";
import type { AdapterExecuteRequest } from "../../types.js";
import {
  CLI_CREDENTIAL_ENV_KEYS,
  type CliCompatibilityRecord,
  HOSTILE_ATTEMPT_IDS,
} from "../cli-compatibility/compat.js";
import {
  assertCopilotArgvFlagsAllowlisted,
  assertCopilotToolsAllowlisted,
  buildCopilotCliCompatibilityTuple,
  buildCopilotCliExecArgv,
  COPILOT_CLI_ACCEPTED_FLAGS,
  executeCopilotCliReview,
  parseCopilotJsonlTerminal,
} from "./cli.js";

const downstreamCompatibilityRecords = vi.hoisted(() => new WeakSet<object>());

vi.mock("../cli-compatibility/compat.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../cli-compatibility/compat.js")>();
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
  maxOutputTokens: 4_000,
  maxResponseBytes: 1_048_576,
  wallTimeMs: 120_000,
  maxRetries: 2,
  maxConcurrency: 1,
  maxCostUsd: 0.5,
} as const;

const VERSION = "0.42.0";
const MODEL_ID = "gpt-5";
const EXECUTABLE = process.execPath;

function createCopilotRecord(
  overrides: Partial<CliCompatibilityRecord> = {},
): CliCompatibilityRecord {
  const base: CliCompatibilityRecord = {
    schemaVersion: 1,
    provider: "copilot-cli",
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
      authStoreEvidence: "secure-store-reachable",
    },
    model: {
      requested: MODEL_ID,
      policyCheck: "accepted",
      rawOutputSha256: SHA_E,
    },
    profile: {
      argv: [
        "-p",
        "[REDACTED]",
        ...COPILOT_CLI_ACCEPTED_FLAGS.filter((flag) => flag !== "-p" && flag !== "--model"),
        "--model",
        MODEL_ID,
      ],
      acceptedFlags: [...COPILOT_CLI_ACCEPTED_FLAGS],
      workingDirectoryKind: "neutral-disposable-fixture",
    },
    positiveFixture: {
      exitCode: 0,
      stdoutJsonlSha256: SHA_F,
      reviewSchemaSha256: SHA_G,
      terminal: {
        source: "copilot-jsonl",
        acceptedEventKinds: ["result"],
        acceptedFieldPaths: ["issues", "type"],
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
    installationId: "copilot-installation",
    productId: "copilot-cli",
    transportFamily: "local-cli",
    normalizedEndpoint: null,
    region: null,
    workspaceAccountReference: null,
    modelId: MODEL_ID,
    runtime: { identity: "copilot-cli", version: VERSION },
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
  const tuple = await buildCopilotCliCompatibilityTuple(request, EXECUTABLE, VERSION);
  return createCopilotRecord({
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
        source: "copilot-jsonl",
        acceptedEventKinds: ["result"],
        acceptedFieldPaths: ["issues", "type"],
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
    probeAuth: async () => ok({ authStoreEvidence: "secure-store-reachable" as const }),
    probeModelPolicy: async () => ok({ accepted: true, rawOutput: MODEL_ID }),
    resolveCompatibilityRecord: async () => record,
    runProcess: async () => ({
      exitCode: 0,
      signal: null,
      stdout: '{"type":"result","issues":[]}\n',
      stderr: "",
      cancelledLocally: false,
      descendantsTerminatedLocally: false,
      outputTruncated: false,
      timedOut: false,
    }),
    now: () => new Date("2026-01-01T00:00:00.000Z"),
  };
}

function successDependencies(record: CliCompatibilityRecord) {
  downstreamCompatibilityRecords.add(record);
  return dependencies(record);
}

describe("buildCopilotCliExecArgv", () => {
  it("uses only verified Copilot flags and view/glob/grep tools", () => {
    const argv = buildCopilotCliExecArgv({ modelId: MODEL_ID });
    expect(argv).toEqual([
      "--output-format=json",
      "--stream=off",
      "--model",
      MODEL_ID,
      "--available-tools=view,glob,grep",
      "--disable-builtin-mcps",
      "--no-custom-instructions",
      "--no-ask-user",
      "--no-remote",
      "--no-remote-export",
    ]);
    expect(() => assertCopilotToolsAllowlisted(argv)).not.toThrow();
  });
});

describe("parseCopilotJsonlTerminal", () => {
  it("accepts record-named JSONL terminal fields", () => {
    const record = createCopilotRecord();
    const parsed = parseCopilotJsonlTerminal('{"type":"result","issues":[]}\n', record);
    expect(parsed.ok).toBe(true);
  });

  it("rejects JSON-not-JSONL", () => {
    const record = createCopilotRecord();
    expect(parseCopilotJsonlTerminal('{"issues":[]}', record)).toEqual({
      ok: false,
      error: { code: "not-jsonl" },
    });
  });

  it("rejects fabricated result/status/data.review envelopes", () => {
    const record = createCopilotRecord();
    expect(parseCopilotJsonlTerminal('{"type":"result","result":[]}\n', record)).toEqual({
      ok: false,
      error: { code: "fabricated-envelope" },
    });
    expect(
      parseCopilotJsonlTerminal('{"type":"result","status":"ok","issues":[]}\n', record),
    ).toEqual({
      ok: false,
      error: { code: "fabricated-envelope" },
    });
  });

  it("rejects unrecorded event kinds and field paths", () => {
    const record = createCopilotRecord();
    expect(parseCopilotJsonlTerminal('{"type":"completion","issues":[]}\n', record)).toEqual({
      ok: false,
      error: { code: "parser-allowlist" },
    });
    expect(parseCopilotJsonlTerminal('{"type":"result","unknown":[]}\n', record)).toEqual({
      ok: false,
      error: { code: "parser-allowlist" },
    });
  });

  it("rejects partial and unknown terminal output", () => {
    const record = createCopilotRecord();
    expect(parseCopilotJsonlTerminal("", record)).toEqual({
      ok: false,
      error: { code: "partial-terminal" },
    });
    expect(parseCopilotJsonlTerminal('{"type":"progress"}\n', record)).toEqual({
      ok: false,
      error: { code: "parser-allowlist" },
    });
  });
});

describe("executeCopilotCliReview contract", () => {
  it("fails closed before spawning for a read-capable compatibility profile", async () => {
    const record = await createRuntimeMatchedRecord();
    let processStarted = false;
    const result = await executeCopilotCliReview(executeRequest(), {
      ...dependencies(record),
      runProcess: async () => {
        processStarted = true;
        return {
          exitCode: 0,
          signal: null,
          stdout: '{"type":"result","issues":[]}\n',
          stderr: "",
          cancelledLocally: false,
          descendantsTerminatedLocally: false,
          outputTruncated: false,
          timedOut: false,
        };
      },
    });

    expect(result.receipt.outcome).toBe("transport-failed");
    expect(processStarted).toBe(false);
  });

  it("preserves downstream execution behind the test-local admission seam", async () => {
    const record = await createRuntimeMatchedRecord();
    const result = await executeCopilotCliReview(executeRequest(), successDependencies(record));

    expect(result.receipt.outcome).toBe("completed");
    expect(result.result.issues).toEqual([]);
    expect(ExecutionResultSchema.safeParse(result).success).toBe(true);
  });

  it("rejects absent compatibility record", async () => {
    const result = await executeCopilotCliReview(executeRequest(), {
      ...successDependencies(await createRuntimeMatchedRecord()),
      resolveCompatibilityRecord: async () => null,
    });

    expect(result.receipt.outcome).toBe("transport-failed");
    expect(result.result.issues).toEqual([]);
  });

  it("rejects mismatched compatibility record", async () => {
    const record = await createRuntimeMatchedRecord({
      model: { requested: "other-model", policyCheck: "accepted", rawOutputSha256: SHA_E },
    });
    const result = await executeCopilotCliReview(executeRequest(), successDependencies(record));

    expect(result.receipt.outcome).toBe("transport-failed");
  });

  it("rejects unrecorded argv flags", () => {
    const record = createCopilotRecord({
      profile: {
        argv: ["-p", "review", "--model", MODEL_ID],
        acceptedFlags: ["-p", "--model"],
        workingDirectoryKind: "neutral-disposable-fixture",
      },
    });

    expect(() =>
      assertCopilotArgvFlagsAllowlisted(record, buildCopilotCliExecArgv({ modelId: MODEL_ID })),
    ).toThrow(/Unrecorded Copilot argv flag/);
  });

  it("rejects extra tools beyond view/glob/grep", () => {
    expect(() =>
      assertCopilotToolsAllowlisted(["-p", "review", "--available-tools=view,glob,grep,shell"]),
    ).toThrow(/Extra Copilot tool/);
  });

  it("rejects rejected model policy", async () => {
    const record = await createRuntimeMatchedRecord();
    const result = await executeCopilotCliReview(executeRequest(), {
      ...successDependencies(record),
      probeModelPolicy: async () => ok({ accepted: false, rawOutput: "missing model" }),
    });

    expect(result.receipt.outcome).toBe("transport-failed");
  });

  it("rejects nonzero exit", async () => {
    const record = await createRuntimeMatchedRecord();
    const result = await executeCopilotCliReview(executeRequest(), {
      ...successDependencies(record),
      runProcess: async () => ({
        exitCode: 2,
        signal: null,
        stdout: "",
        stderr: "failed",
        cancelledLocally: false,
        descendantsTerminatedLocally: false,
        outputTruncated: false,
        timedOut: false,
      }),
    });

    expect(result.receipt.outcome).toBe("transport-failed");
  });

  it("rejects unavailable auth", async () => {
    const record = await createRuntimeMatchedRecord();
    const result = await executeCopilotCliReview(executeRequest(), {
      ...successDependencies(record),
      probeAuth: async () => ok({ authStoreEvidence: "unavailable" }),
    });

    expect(result.receipt.outcome).toBe("transport-failed");
  });

  it("rejects plaintext auth evidence", async () => {
    const record = await createRuntimeMatchedRecord();
    const result = await executeCopilotCliReview(executeRequest(), {
      ...successDependencies(record),
      probeAuth: async () => ok({ authStoreEvidence: "plaintext-fallback" }),
    });

    expect(result.receipt.outcome).toBe("transport-failed");
  });

  it("rejects schema-invalid terminal JSONL", async () => {
    const record = await createRuntimeMatchedRecord();
    const result = await executeCopilotCliReview(executeRequest(), {
      ...successDependencies(record),
      runProcess: async () => ({
        exitCode: 0,
        signal: null,
        stdout: '{"type":"result","summary":"prose"}\n',
        stderr: "",
        cancelledLocally: false,
        descendantsTerminatedLocally: false,
        outputTruncated: false,
        timedOut: false,
      }),
    });

    expect(result.receipt.outcome).toBe("schema-failed");
    expect(result.result.issues).toEqual([]);
  });

  it.each(
    CLI_CREDENTIAL_ENV_KEYS,
  )("does not pass credential env keys to the child process for %s", async (key) => {
    const record = await createRuntimeMatchedRecord();
    let childEnv: Record<string, string> = {};
    const previous = process.env[key];
    process.env[key] = "injected-secret";
    try {
      await executeCopilotCliReview(executeRequest(), {
        ...successDependencies(record),
        runProcess: async (input) => {
          childEnv = { ...input.env };
          return {
            exitCode: 0,
            signal: null,
            stdout: '{"type":"result","issues":[]}\n',
            stderr: "",
            cancelledLocally: false,
            descendantsTerminatedLocally: false,
            outputTruncated: false,
            timedOut: false,
          };
        },
      });
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

describe("Copilot cancellation and bounded transcripts", () => {
  it("reports cancelled when the child was terminated by the caller's abort", async () => {
    const record = await createRuntimeMatchedRecord();
    const result = await executeCopilotCliReview(executeRequest(), {
      ...successDependencies(record),
      runProcess: async () => ({
        exitCode: null,
        signal: "SIGTERM",
        stdout: "",
        stderr: "",
        cancelledLocally: true,
        descendantsTerminatedLocally: true,
        outputTruncated: false,
        timedOut: false,
      }),
    });

    expect(result.receipt.outcome).toBe("cancelled");
  });

  it("times out the attempt when the child exceeded the wall-time bound", async () => {
    const record = await createRuntimeMatchedRecord();
    const result = await executeCopilotCliReview(executeRequest(), {
      ...successDependencies(record),
      runProcess: async () => ({
        exitCode: 0,
        signal: null,
        stdout: '{"type":"result","issues":[]}\n',
        stderr: "",
        cancelledLocally: false,
        descendantsTerminatedLocally: true,
        outputTruncated: false,
        timedOut: true,
      }),
    });

    expect(result.receipt.outcome).toBe("timed-out");
  });

  it("fails the attempt when the transcript was truncated at the output bound", async () => {
    const record = await createRuntimeMatchedRecord();
    const result = await executeCopilotCliReview(executeRequest(), {
      ...successDependencies(record),
      runProcess: async () => ({
        exitCode: 0,
        signal: null,
        stdout: '{"type":"result","issues":[]}\n',
        stderr: "",
        cancelledLocally: false,
        descendantsTerminatedLocally: false,
        outputTruncated: true,
        timedOut: false,
      }),
    });

    expect(result.receipt.outcome).toBe("transport-failed");
  });

  it("rejects a stream whose trailing line is malformed JSONL", async () => {
    const record = await createRuntimeMatchedRecord();
    const result = await executeCopilotCliReview(executeRequest(), {
      ...successDependencies(record),
      runProcess: async () => ({
        exitCode: 0,
        signal: null,
        stdout: '{"type":"result","issues":[]}\nnot-json\n',
        stderr: "",
        cancelledLocally: false,
        descendantsTerminatedLocally: false,
        outputTruncated: false,
        timedOut: false,
      }),
    });

    expect(result.receipt.outcome).toBe("schema-failed");
  });
});

describe("Copilot prompt privacy and admitted wall time", () => {
  it("keeps a near-limit prompt out of argv and hands it to the child on stdin", async () => {
    const record = await createRuntimeMatchedRecord();
    const request = {
      ...executeRequest(),
      prompt: `secret-diff-${"x".repeat(512 * 1024)}`,
      systemPrompt: "invariant reviewer instructions",
    };
    let observed: { argv: readonly string[]; stdin: string; timeoutMs?: number } | null = null;

    const result = await executeCopilotCliReview(request, {
      ...successDependencies(record),
      runProcess: async (input) => {
        observed = { argv: input.argv, stdin: input.stdin, timeoutMs: input.timeoutMs };
        return {
          exitCode: 0,
          signal: null,
          stdout: '{"type":"result","issues":[]}\n',
          stderr: "",
          cancelledLocally: false,
          descendantsTerminatedLocally: false,
          outputTruncated: false,
          timedOut: false,
        };
      },
    });

    expect(result.receipt.outcome).toBe("completed");
    const run = observed as unknown as { argv: string[]; stdin: string; timeoutMs?: number };
    expect(run.argv.some((token) => token.includes("secret-diff-"))).toBe(false);
    // Copilot ignores piped input whenever a -p/--prompt argument is present.
    expect(run.argv).not.toContain("-p");
    expect(run.stdin).toBe(`invariant reviewer instructions\n\n${request.prompt}`);
    expect(run.timeoutMs).toBeGreaterThan(0);
    expect(run.timeoutMs ?? Number.POSITIVE_INFINITY).toBeLessThanOrEqual(
      request.evidenceKey.limits.wallTimeMs,
    );
  });
});
