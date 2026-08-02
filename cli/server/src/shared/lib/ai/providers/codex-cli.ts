import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { err, ok, type Result } from "@diffgazer/core/result";
import {
  type ExecutionResult,
  type ReviewResult,
  ReviewResultSchema,
} from "@diffgazer/core/schemas/review";
import { type BudgetLedger, createBudgetLedger } from "../budget/ledger.js";
import type { Adapter, AdapterExecuteRequest } from "../types.js";
import {
  assertParserFieldPathAllowlisted,
  buildCliChildEnvironment,
  type CliCompatibilityRecord,
  type CliCompatibilityTuple,
  type CliProcessRunResult,
  digestExecutableRealPath,
  hashExecutableFileSha256,
  matchCliCompatibilityTuple,
  runCliArgvProcess,
} from "./cli-compatibility.js";
import { buildReviewSchemaJson } from "./cli-compatibility-probe.js";
import {
  acquireCliVersion,
  type CliAuthProbe,
  type CliModelPolicyProbe,
  probeCliAuthStore,
  probeCliModelPolicy,
} from "./cli-vendor-probes.js";
import {
  conservativeAttemptEstimate,
  createCompletedExecutionResult,
  createFailedExecutionResult,
  type FailedTerminalOutcome,
  ZERO_ATTEMPT_ACTUAL,
} from "./execution-receipt.js";

export const CODEX_CLI_ACCEPTED_FLAGS = [
  "--ephemeral",
  "--sandbox",
  "read-only",
  "--ignore-user-config",
  "--ignore-rules",
  "--json",
  "--output-schema",
  "--output-last-message",
  "--model",
] as const;

export type CodexCliExecutionInput = Readonly<{
  executable: string;
  argv: readonly string[];
  cwd: string;
  env: Readonly<Record<string, string>>;
  resultPath: string;
  signal?: AbortSignal;
}>;

export type CodexCliDependencies = Readonly<{
  resolveCompatibilityRecord?: (
    tuple: CliCompatibilityTuple,
  ) => Promise<CliCompatibilityRecord | null>;
  resolveExecutable?: () => Promise<Result<string, string>>;
  acquireVersion?: (input: {
    executable: string;
    cwd: string;
    env: Readonly<Record<string, string>>;
  }) => Promise<Result<string, string>>;
  probeAuth?: (input: {
    executable: string;
    cwd: string;
    env: Readonly<Record<string, string>>;
  }) => Promise<Result<CliAuthProbe, string>>;
  probeModelPolicy?: (input: {
    executable: string;
    modelId: string;
    cwd: string;
    env: Readonly<Record<string, string>>;
  }) => Promise<Result<CliModelPolicyProbe, string>>;
  runProcess?: (input: CodexCliExecutionInput) => Promise<CliProcessRunResult>;
  readResultFile?: (resultPath: string) => Promise<string>;
  now?: () => Date;
}>;

let testDependencies: CodexCliDependencies = {};

export function setCodexCliTestDependencies(dependencies: CodexCliDependencies): void {
  testDependencies = dependencies;
}

function resolveDependencies(
  dependencies: CodexCliDependencies = {},
): Required<Pick<CodexCliDependencies, "now">> & CodexCliDependencies {
  return {
    now: dependencies.now ?? testDependencies.now ?? (() => new Date()),
    ...testDependencies,
    ...dependencies,
  };
}

export function buildCodexCliExecArgv(input: {
  reviewSchemaPath: string;
  resultPath: string;
  modelId: string;
  prompt: string;
}): string[] {
  return [
    "exec",
    "--ephemeral",
    "--sandbox",
    "read-only",
    "--ignore-user-config",
    "--ignore-rules",
    "--json",
    "--output-schema",
    input.reviewSchemaPath,
    "--output-last-message",
    input.resultPath,
    "--model",
    input.modelId,
    input.prompt,
  ];
}

export function assertCodexArgvFlagsAllowlisted(
  record: CliCompatibilityRecord,
  argv: readonly string[],
): void {
  const accepted = new Set(record.profile.acceptedFlags);
  for (const token of argv) {
    if (token.startsWith("--") || token === "read-only") {
      if (!accepted.has(token)) {
        throw new Error(`Unrecorded Codex argv flag: ${token}`);
      }
    }
  }
}

export function extractCodexTerminalFieldPaths(payload: unknown): {
  acceptedFieldPaths: string[];
  resultTextFieldPath: string;
} {
  if (!payload || typeof payload !== "object") {
    return { acceptedFieldPaths: [], resultTextFieldPath: "issues" };
  }
  const keys = Object.keys(payload).sort((left, right) => left.localeCompare(right));
  return {
    acceptedFieldPaths: keys,
    resultTextFieldPath: keys.includes("issues") ? "issues" : (keys[0] ?? "issues"),
  };
}

export function parseCodexOutputLastMessage(
  raw: string,
  record: CliCompatibilityRecord,
): Result<ReviewResult, { code: "malformed-json" | "schema-failed" | "parser-allowlist" }> {
  let payload: unknown;
  try {
    payload = JSON.parse(raw) as unknown;
  } catch {
    return err({ code: "malformed-json" });
  }

  const terminal = extractCodexTerminalFieldPaths(payload);
  try {
    for (const fieldPath of terminal.acceptedFieldPaths) {
      assertParserFieldPathAllowlisted(record, fieldPath);
    }
    assertParserFieldPathAllowlisted(record, terminal.resultTextFieldPath);
  } catch {
    return err({ code: "parser-allowlist" });
  }

  const parsed = ReviewResultSchema.safeParse(payload);
  if (!parsed.success) {
    return err({ code: "schema-failed" });
  }

  return ok(parsed.data);
}

function createFailedResult(
  request: AdapterExecuteRequest,
  outcome: FailedTerminalOutcome,
  startedAt: string,
  finishedAt: string,
  attemptCount: number,
): ExecutionResult {
  return createFailedExecutionResult(request, outcome, { startedAt, finishedAt, attemptCount });
}

export async function buildCodexCliCompatibilityTuple(
  request: AdapterExecuteRequest,
  executablePath: string,
  version: string,
): Promise<CliCompatibilityTuple> {
  const [realPathDigest, fileSha256] = await Promise.all([
    digestExecutableRealPath(executablePath),
    hashExecutableFileSha256(executablePath),
  ]);

  return {
    provider: "codex-cli",
    platform: {
      nodePlatform: process.platform,
      architecture: process.arch,
    },
    executable: {
      realPathDigest,
      fileSha256,
      version,
    },
    modelId: request.evidenceKey.modelId,
    reviewSchemaSha256: request.evidenceKey.structuredOutputSchemaSha256,
  };
}

export async function executeCodexCliReview(
  request: AdapterExecuteRequest,
  dependencies: CodexCliDependencies = {},
): Promise<ExecutionResult> {
  const resolved = resolveDependencies(dependencies);
  const now = resolved.now ?? (() => new Date());
  const startedAt = now().toISOString();

  if (request.evidenceKey.productId !== "codex-cli") {
    return createFailedResult(request, "transport-failed", startedAt, startedAt, 1);
  }

  if (request.signal?.aborted) {
    return createFailedResult(request, "cancelled", startedAt, startedAt, 1);
  }

  const envResult = buildCliChildEnvironment();
  if (!envResult.ok) {
    return createFailedResult(request, "transport-failed", startedAt, startedAt, 1);
  }

  const ledger: BudgetLedger = createBudgetLedger(request.evidenceKey.limits);
  const reservation = ledger.reserveAttempt(
    conservativeAttemptEstimate(request.evidenceKey.limits),
  );
  if (!reservation.ok) {
    return createFailedResult(
      request,
      reservation.error.outcome,
      startedAt,
      now().toISOString(),
      1,
    );
  }

  const releaseReservation = () => {
    ledger.releaseReservation(reservation.value);
  };

  let fixtureRoot: string | undefined;
  try {
    const resolveExecutable =
      resolved.resolveExecutable ??
      (async () => err("Executable resolver unavailable for codex-cli"));
    const executableResult = await resolveExecutable();
    if (!executableResult.ok) {
      releaseReservation();
      return createFailedResult(request, "transport-failed", startedAt, now().toISOString(), 1);
    }

    fixtureRoot = await mkdtemp(path.join(tmpdir(), "codex-cli-fixture-"));
    const acquireVersion =
      resolved.acquireVersion ??
      (async (input) => {
        const acquired = await acquireCliVersion("codex-cli", input);
        return acquired.ok ? ok(acquired.value.value) : err(acquired.error);
      });
    const versionResult = await acquireVersion({
      executable: executableResult.value,
      cwd: fixtureRoot,
      env: envResult.value,
    });
    if (!versionResult.ok) {
      releaseReservation();
      return createFailedResult(request, "transport-failed", startedAt, now().toISOString(), 1);
    }

    if (request.evidenceKey.runtime?.version !== versionResult.value) {
      releaseReservation();
      return createFailedResult(request, "transport-failed", startedAt, now().toISOString(), 1);
    }

    const tuple = await buildCodexCliCompatibilityTuple(
      request,
      executableResult.value,
      versionResult.value,
    );

    const resolveRecord =
      resolved.resolveCompatibilityRecord ?? (async () => null as CliCompatibilityRecord | null);
    const record = await resolveRecord(tuple);
    const match = matchCliCompatibilityTuple(record, tuple);
    if (!match.matched) {
      releaseReservation();
      return createFailedResult(request, "transport-failed", startedAt, now().toISOString(), 1);
    }
    if (!record) {
      releaseReservation();
      return createFailedResult(request, "transport-failed", startedAt, now().toISOString(), 1);
    }

    const probeAuth = resolved.probeAuth ?? ((input) => probeCliAuthStore("codex-cli", input));
    const authResult = await probeAuth({
      executable: executableResult.value,
      cwd: fixtureRoot,
      env: envResult.value,
    });
    if (!authResult.ok || authResult.value.authStoreEvidence === "unavailable") {
      releaseReservation();
      return createFailedResult(request, "transport-failed", startedAt, now().toISOString(), 1);
    }

    const probeModelPolicy =
      resolved.probeModelPolicy ?? ((input) => probeCliModelPolicy("codex-cli", input));
    const modelPolicyResult = await probeModelPolicy({
      executable: executableResult.value,
      modelId: request.evidenceKey.modelId,
      cwd: fixtureRoot,
      env: envResult.value,
    });
    if (!modelPolicyResult.ok || !modelPolicyResult.value.accepted) {
      releaseReservation();
      return createFailedResult(request, "transport-failed", startedAt, now().toISOString(), 1);
    }

    const reviewSchemaPath = path.join(fixtureRoot, "review-schema.json");
    const resultPath = path.join(fixtureRoot, "result.json");
    await writeFile(reviewSchemaPath, JSON.stringify(buildReviewSchemaJson()), "utf8");

    const argv = buildCodexCliExecArgv({
      reviewSchemaPath,
      resultPath,
      modelId: request.evidenceKey.modelId,
      prompt: request.prompt,
    });

    try {
      assertCodexArgvFlagsAllowlisted(record, argv);
    } catch {
      releaseReservation();
      return createFailedResult(request, "transport-failed", startedAt, now().toISOString(), 1);
    }

    const runProcess =
      resolved.runProcess ??
      ((input) =>
        runCliArgvProcess({
          executable: input.executable,
          argv: input.argv,
          cwd: input.cwd,
          env: input.env,
          signal: input.signal,
        }));
    const processResult = await runProcess({
      executable: executableResult.value,
      argv,
      cwd: fixtureRoot,
      env: envResult.value,
      resultPath,
      signal: request.signal,
    });

    if (processResult.cancelledLocally || request.signal?.aborted) {
      releaseReservation();
      return createFailedResult(request, "cancelled", startedAt, now().toISOString(), 1);
    }

    if (processResult.exitCode !== 0 || processResult.timedOut || processResult.outputTruncated) {
      releaseReservation();
      return createFailedResult(request, "transport-failed", startedAt, now().toISOString(), 1);
    }

    const readResultFile =
      resolved.readResultFile ?? ((filePath: string) => readFile(filePath, "utf8"));
    let rawResult: string;
    try {
      rawResult = await readResultFile(resultPath);
    } catch {
      releaseReservation();
      return createFailedResult(request, "schema-failed", startedAt, now().toISOString(), 1);
    }

    const parsed = parseCodexOutputLastMessage(rawResult, record);
    if (!parsed.ok) {
      releaseReservation();
      return createFailedResult(request, "schema-failed", startedAt, now().toISOString(), 1);
    }

    if (processResult.stdout.trim().length > 0) {
      const stdoutLines = processResult.stdout
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean);
      const eventOnly =
        stdoutLines.length > 0 &&
        stdoutLines.every((line) => {
          try {
            const event = JSON.parse(line) as Record<string, unknown>;
            return typeof event.type === "string" && !("issues" in event);
          } catch {
            return false;
          }
        });
      if (eventOnly) {
        releaseReservation();
        return createFailedResult(request, "schema-failed", startedAt, now().toISOString(), 1);
      }
    }

    const settle = ledger.settleAttempt(reservation.value, ZERO_ATTEMPT_ACTUAL);
    if (!settle.ok) {
      return createFailedResult(request, "budget-exhausted", startedAt, now().toISOString(), 1);
    }

    return createCompletedExecutionResult(request, parsed.value, {
      startedAt,
      finishedAt: now().toISOString(),
      attemptCount: 1,
    });
  } catch {
    releaseReservation();
    return createFailedResult(request, "transport-failed", startedAt, now().toISOString(), 1);
  } finally {
    if (fixtureRoot) {
      await rm(fixtureRoot, { recursive: true, force: true });
    }
  }
}

export function createCodexCliAdapter(dependencies?: CodexCliDependencies): Adapter {
  return {
    productId: "codex-cli",
    transportFamily: "local-cli",
    async execute(request) {
      return executeCodexCliReview(request, dependencies);
    },
  };
}

export const codexCliAdapter = createCodexCliAdapter();
