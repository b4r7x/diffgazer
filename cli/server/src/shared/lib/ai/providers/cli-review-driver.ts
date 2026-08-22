import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { err, ok, type Result } from "@diffgazer/core/result";
import type { FailedTerminalOutcome } from "@diffgazer/core/review";
import type { LocalCliProductId } from "@diffgazer/core/schemas/config";
import type { ExecutionResult, ReviewResult } from "@diffgazer/core/schemas/review";
import { readTextFileWithLimit } from "../bounded-file.js";
import { type AttemptActual, type BudgetLedger, createBudgetLedger } from "../budget/ledger.js";
import { composeExecutionDeadline } from "../deadline.js";
import type { Adapter, AdapterExecuteRequest } from "../types.js";
import {
  buildCliChildEnvironment,
  type CliCompatibilityRecord,
  type CliCompatibilityTuple,
  type CliProcessRunResult,
  digestExecutableRealPath,
  hashExecutableFileSha256,
  matchCliCompatibilityTuple,
  runCliArgvProcess,
} from "./cli-compatibility/compat.js";
import {
  acquireCliVersion,
  type CliAuthProbe,
  type CliModelPolicyProbe,
  type CliProbeInput,
  probeCliAuthStore,
  probeCliModelPolicy,
} from "./cli-vendor-probes.js";
import {
  conservativeAttemptEstimate,
  createCompletedExecutionResult,
  createFailedExecutionResult,
} from "./execution-receipt.js";

type CliReviewProcessInput = Readonly<{
  executable: string;
  argv: readonly string[];
  cwd: string;
  env: Readonly<Record<string, string>>;
  /** The private prompt channel: argv carries only flags and identifiers. */
  stdin: string;
  signal?: AbortSignal;
  timeoutMs?: number;
}>;

export type CliReviewDependencies = Readonly<{
  resolveCompatibilityRecord?: (
    tuple: CliCompatibilityTuple,
  ) => Promise<CliCompatibilityRecord | null>;
  resolveExecutable?: () => Promise<Result<string, string>>;
  acquireVersion?: (input: CliProbeInput) => Promise<Result<string, string>>;
  probeAuth?: (input: CliProbeInput) => Promise<Result<CliAuthProbe, string>>;
  probeModelPolicy?: (
    input: CliProbeInput & Readonly<{ modelId: string }>,
  ) => Promise<Result<CliModelPolicyProbe, string>>;
  runProcess?: (input: CliReviewProcessInput) => Promise<CliProcessRunResult>;
  readResultFile?: (
    resultPath: string,
    maxBytes: number,
  ) => Promise<Result<string, { code: "oversize-response" | "read-failed" }>>;
  now?: () => Date;
}>;

/** Terminal evidence produced by one CLI attempt, handed to the product parser. */
export type CliTerminalOutput = Readonly<{
  stdout: string;
  /** Contents of `resultFileName`, or `""` for products that terminate on stdout. */
  resultFile: string;
}>;

/** Everything that differs between two local-CLI review products. */
export type CliReviewProduct = Readonly<{
  productId: LocalCliProductId;
  /** `mkdtemp` prefix for the disposable fixture root the child runs in. */
  tmpPrefix: string;
  /** Auth-store evidence values that fail admission for this product. */
  rejectedAuthEvidence: readonly CliAuthProbe["authStoreEvidence"][];
  /** File inside the fixture root the CLI writes its terminal payload to. */
  resultFileName?: string;
  /** Writes product inputs (schemas, configs) into the fixture root before argv is built. */
  prepareFixture?: (fixtureRoot: string) => Promise<void>;
  buildArgv: (input: Readonly<{ fixtureRoot: string; modelId: string }>) => readonly string[];
  assertArgvAllowed: (record: CliCompatibilityRecord, argv: readonly string[]) => void;
  parseTerminalOutput: (
    output: CliTerminalOutput,
    record: CliCompatibilityRecord,
  ) => Result<ReviewResult, unknown>;
}>;

export async function buildCliCompatibilityTuple(
  provider: LocalCliProductId,
  request: AdapterExecuteRequest,
  executablePath: string,
  version: string,
): Promise<CliCompatibilityTuple> {
  const [realPathDigest, fileSha256] = await Promise.all([
    digestExecutableRealPath(executablePath),
    hashExecutableFileSha256(executablePath),
  ]);

  return {
    provider,
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

/**
 * The admission pipeline every local-CLI review product shares: environment
 * narrowing, budget reservation, executable and version evidence, compatibility
 * record match, auth and model-policy probes, argv allowlisting, one bounded
 * child run, and terminal parsing. Each step fails closed, releasing the
 * reservation and settling the receipt as a failed attempt.
 */
export async function executeCliReview(
  request: AdapterExecuteRequest,
  product: CliReviewProduct,
  dependencies: CliReviewDependencies = {},
): Promise<ExecutionResult> {
  const now = dependencies.now ?? (() => new Date());
  const startedAt = now().toISOString();
  const limits = request.evidenceKey.limits;
  let responseBytesConsumed = 0;

  const failed = (outcome: FailedTerminalOutcome, finishedAt: string): ExecutionResult =>
    createFailedExecutionResult(request, outcome, { startedAt, finishedAt, attemptCount: 1 });

  if (request.evidenceKey.productId !== product.productId) {
    return failed("transport-failed", startedAt);
  }

  if (request.signal?.aborted) {
    return failed("cancelled", startedAt);
  }

  const envResult = buildCliChildEnvironment();
  if (!envResult.ok) {
    return failed("transport-failed", startedAt);
  }
  const env = envResult.value;

  const ledger: BudgetLedger = createBudgetLedger(limits);
  const reservation = ledger.reserveAttempt(conservativeAttemptEstimate(limits));
  if (!reservation.ok) {
    return failed(reservation.error.outcome, now().toISOString());
  }

  const attemptActual = (finishedAt: string): AttemptActual => {
    const elapsedMs = Math.max(0, Date.parse(finishedAt) - Date.parse(startedAt));
    return {
      inputTokens: 0,
      outputTokens: 0,
      responseBytes: Math.min(responseBytesConsumed, limits.maxResponseBytes),
      wallTimeMs: Math.min(elapsedMs, limits.wallTimeMs),
      costUsd: 0,
    };
  };

  const settleMeasured = (finishedAt: string): FailedTerminalOutcome | null => {
    const settle = ledger.settleAttempt(reservation.value, attemptActual(finishedAt));
    return settle.ok ? null : "budget-exhausted";
  };

  const failWith = (outcome: FailedTerminalOutcome): ExecutionResult => {
    const finishedAt = now().toISOString();
    const exhausted = settleMeasured(finishedAt);
    return failed(exhausted ?? outcome, finishedAt);
  };

  // One absolute deadline spans version, auth, and model probes plus the review
  // process, so the admitted wall time is end-to-end rather than per phase.
  const deadline = composeExecutionDeadline(limits.wallTimeMs, request.signal);

  let fixtureRoot: string | undefined;
  try {
    const resolveExecutable =
      dependencies.resolveExecutable ??
      (async () => err(`Executable resolver unavailable for ${product.productId}`));
    const executableResult = await resolveExecutable();
    if (!executableResult.ok) {
      return failWith("transport-failed");
    }
    const executable = executableResult.value;

    const fixtureDir = await mkdtemp(path.join(tmpdir(), product.tmpPrefix));
    fixtureRoot = fixtureDir;
    const acquireVersion =
      dependencies.acquireVersion ??
      (async (input: CliProbeInput) => {
        const acquired = await acquireCliVersion(product.productId, input);
        return acquired.ok ? ok(acquired.value.value) : err(acquired.error);
      });
    const probeInput = () => ({
      executable,
      cwd: fixtureDir,
      env,
      signal: deadline.signal,
      timeoutMs: deadline.remainingMs(),
    });
    const versionResult = await acquireVersion(probeInput());
    if (!versionResult.ok) {
      return failWith("transport-failed");
    }

    if (request.evidenceKey.runtime?.version !== versionResult.value) {
      return failWith("transport-failed");
    }

    const tuple = await buildCliCompatibilityTuple(
      product.productId,
      request,
      executable,
      versionResult.value,
    );

    const resolveRecord =
      dependencies.resolveCompatibilityRecord ??
      (async () => null as CliCompatibilityRecord | null);
    const record = await resolveRecord(tuple);
    if (!matchCliCompatibilityTuple(record, tuple).matched || !record) {
      return failWith("transport-failed");
    }

    const probeAuth =
      dependencies.probeAuth ??
      ((input: CliProbeInput) => probeCliAuthStore(product.productId, input));
    const authResult = await probeAuth(probeInput());
    if (
      !authResult.ok ||
      product.rejectedAuthEvidence.includes(authResult.value.authStoreEvidence)
    ) {
      return failWith("transport-failed");
    }

    const probeModelPolicy =
      dependencies.probeModelPolicy ??
      ((input: CliProbeInput & { modelId: string }) =>
        probeCliModelPolicy(product.productId, input));
    const modelPolicyResult = await probeModelPolicy({
      ...probeInput(),
      modelId: request.evidenceKey.modelId,
    });
    if (!modelPolicyResult.ok || !modelPolicyResult.value.accepted) {
      return failWith("transport-failed");
    }

    await product.prepareFixture?.(fixtureDir);
    const argv = product.buildArgv({
      fixtureRoot: fixtureDir,
      modelId: request.evidenceKey.modelId,
    });

    try {
      product.assertArgvAllowed(record, argv);
    } catch {
      return failWith("transport-failed");
    }

    const runProcess = dependencies.runProcess ?? runCliArgvProcess;
    // Neither vendor CLI exposes a system channel, so the invariant instructions
    // lead the single stdin payload the child reads its prompt from.
    const stdinPrompt = request.systemPrompt
      ? `${request.systemPrompt}\n\n${request.prompt}`
      : request.prompt;
    const processResult = await runProcess({
      executable,
      argv,
      cwd: fixtureDir,
      env,
      stdin: stdinPrompt,
      signal: deadline.signal,
      timeoutMs: deadline.remainingMs(),
    });

    if (deadline.expired() || processResult.timedOut) {
      return failWith("timed-out");
    }

    if (processResult.cancelledLocally || deadline.signal.aborted) {
      return failWith("cancelled");
    }

    if (processResult.exitCode !== 0 || processResult.outputTruncated) {
      return failWith("transport-failed");
    }

    let resultFile = "";
    if (product.resultFileName !== undefined) {
      const resultPath = path.join(fixtureDir, product.resultFileName);
      const readResultFile =
        dependencies.readResultFile ??
        ((filePath: string, maxBytes: number) => readTextFileWithLimit(filePath, maxBytes));
      const readResult = await readResultFile(resultPath, limits.maxResponseBytes);
      if (!readResult.ok) {
        return failWith(
          readResult.error.code === "oversize-response" ? "transport-failed" : "schema-failed",
        );
      }
      const fileBytes = new TextEncoder().encode(readResult.value).byteLength;
      if (fileBytes > limits.maxResponseBytes) {
        return failWith("transport-failed");
      }
      resultFile = readResult.value;
      responseBytesConsumed = fileBytes;
    }

    const parsed = product.parseTerminalOutput(
      { stdout: processResult.stdout, resultFile },
      record,
    );
    if (!parsed.ok) {
      return failWith("schema-failed");
    }

    const finishedAt = now().toISOString();
    const exhausted = settleMeasured(finishedAt);
    if (exhausted) {
      return failed(exhausted, finishedAt);
    }

    return createCompletedExecutionResult(request, parsed.value, {
      startedAt,
      finishedAt,
      attemptCount: 1,
    });
  } catch {
    return failWith("transport-failed");
  } finally {
    deadline.dispose();
    if (fixtureRoot) {
      await rm(fixtureRoot, { recursive: true, force: true });
    }
  }
}

export function createCliReviewAdapter(
  product: CliReviewProduct,
  dependencies?: CliReviewDependencies,
): Adapter {
  return {
    productId: product.productId,
    transportFamily: "local-cli",
    async execute(request) {
      return executeCliReview(request, product, dependencies);
    },
  };
}
