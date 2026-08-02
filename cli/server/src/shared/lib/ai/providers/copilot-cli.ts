import { mkdtemp, rm } from "node:fs/promises";
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
  assertParserEventKindAllowlisted,
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
import {
  acquireCliVersion,
  type CliAuthProbe,
  type CliModelPolicyProbe,
  probeCliAuthStore,
  probeCliModelPolicy,
} from "./cli-vendor-probes.js";
import { type CopilotJsonlFailureCode, parseCopilotJsonlStream } from "./copilot-jsonl.js";
import {
  conservativeAttemptEstimate,
  createCompletedExecutionResult,
  createFailedExecutionResult,
  type FailedTerminalOutcome,
  ZERO_ATTEMPT_ACTUAL,
} from "./execution-receipt.js";

export const COPILOT_CLI_ACCEPTED_FLAGS = [
  "-p",
  "--output-format=json",
  "--stream=off",
  "--model",
  "--available-tools=view,glob,grep",
  "--disable-builtin-mcps",
  "--no-custom-instructions",
  "--no-ask-user",
  "--no-remote",
  "--no-remote-export",
] as const;

export const COPILOT_CLI_ALLOWED_TOOLS = ["view", "glob", "grep"] as const;

export const COPILOT_FABRICATED_ENVELOPE_PATHS = ["result", "status", "data.review"] as const;

export type CopilotCliExecutionInput = Readonly<{
  executable: string;
  argv: readonly string[];
  cwd: string;
  env: Readonly<Record<string, string>>;
  signal?: AbortSignal;
}>;

export type CopilotCliDependencies = Readonly<{
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
  runProcess?: (input: CopilotCliExecutionInput) => Promise<CliProcessRunResult>;
  now?: () => Date;
}>;

let testDependencies: CopilotCliDependencies = {};

export function setCopilotCliTestDependencies(dependencies: CopilotCliDependencies): void {
  testDependencies = dependencies;
}

function resolveDependencies(
  dependencies: CopilotCliDependencies = {},
): Required<Pick<CopilotCliDependencies, "now">> & CopilotCliDependencies {
  return {
    now: dependencies.now ?? testDependencies.now ?? (() => new Date()),
    ...testDependencies,
    ...dependencies,
  };
}

export function buildCopilotCliExecArgv(input: { modelId: string; prompt: string }): string[] {
  return [
    "-p",
    input.prompt,
    "--output-format=json",
    "--stream=off",
    "--model",
    input.modelId,
    "--available-tools=view,glob,grep",
    "--disable-builtin-mcps",
    "--no-custom-instructions",
    "--no-ask-user",
    "--no-remote",
    "--no-remote-export",
  ];
}

export function assertCopilotArgvFlagsAllowlisted(
  record: CliCompatibilityRecord,
  argv: readonly string[],
): void {
  const accepted = new Set(record.profile.acceptedFlags);
  for (const token of argv) {
    if (token.startsWith("-")) {
      if (!accepted.has(token)) {
        throw new Error(`Unrecorded Copilot argv flag: ${token}`);
      }
    }
  }
}

export function assertCopilotToolsAllowlisted(argv: readonly string[]): void {
  const toolsFlag = argv.find((token) => token.startsWith("--available-tools="));
  if (!toolsFlag) {
    throw new Error("Missing Copilot available-tools flag");
  }
  const tools = toolsFlag.slice("--available-tools=".length).split(",");
  const allowed = new Set(COPILOT_CLI_ALLOWED_TOOLS);
  for (const tool of tools) {
    if (!allowed.has(tool as (typeof COPILOT_CLI_ALLOWED_TOOLS)[number])) {
      throw new Error(`Extra Copilot tool not allowlisted: ${tool}`);
    }
  }
}

export function parseCopilotJsonlTerminal(
  stdout: string,
  record: CliCompatibilityRecord,
): Result<
  ReviewResult,
  {
    code:
      | CopilotJsonlFailureCode
      | "schema-failed"
      | "parser-allowlist"
      | "fabricated-envelope"
      | "unknown-terminal";
  }
> {
  const stream = parseCopilotJsonlStream(stdout);
  if (!stream.ok) {
    return err(stream.error);
  }

  const terminal = stream.value;
  if (terminal.acceptedEventKinds.length > 0 && terminal.acceptedFieldPaths.length === 0) {
    return err({ code: "unknown-terminal" });
  }

  for (const fabricatedPath of COPILOT_FABRICATED_ENVELOPE_PATHS) {
    if (
      terminal.acceptedFieldPaths.includes(fabricatedPath) &&
      !record.positiveFixture.terminal.acceptedFieldPaths.includes(fabricatedPath)
    ) {
      return err({ code: "fabricated-envelope" });
    }
  }

  try {
    for (const eventKind of terminal.acceptedEventKinds) {
      assertParserEventKindAllowlisted(record, eventKind);
    }
    for (const fieldPath of terminal.acceptedFieldPaths) {
      assertParserFieldPathAllowlisted(record, fieldPath);
    }
    assertParserFieldPathAllowlisted(record, terminal.resultTextFieldPath);
  } catch {
    return err({ code: "parser-allowlist" });
  }

  const reviewPayload = {
    issues: terminal.terminalRecord.issues,
  };

  const parsed = ReviewResultSchema.safeParse(reviewPayload);
  if (!parsed.success) {
    return err({ code: "schema-failed" });
  }

  return ok(parsed.data);
}

export async function buildCopilotCliCompatibilityTuple(
  request: AdapterExecuteRequest,
  executablePath: string,
  version: string,
): Promise<CliCompatibilityTuple> {
  const [realPathDigest, fileSha256] = await Promise.all([
    digestExecutableRealPath(executablePath),
    hashExecutableFileSha256(executablePath),
  ]);

  return {
    provider: "copilot-cli",
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

function createFailedResult(
  request: AdapterExecuteRequest,
  outcome: FailedTerminalOutcome,
  startedAt: string,
  finishedAt: string,
  attemptCount: number,
): ExecutionResult {
  return createFailedExecutionResult(request, outcome, { startedAt, finishedAt, attemptCount });
}

export async function executeCopilotCliReview(
  request: AdapterExecuteRequest,
  dependencies: CopilotCliDependencies = {},
): Promise<ExecutionResult> {
  const resolved = resolveDependencies(dependencies);
  const now = resolved.now ?? (() => new Date());
  const startedAt = now().toISOString();

  if (request.evidenceKey.productId !== "copilot-cli") {
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
      (async () => err("Executable resolver unavailable for copilot-cli"));
    const executableResult = await resolveExecutable();
    if (!executableResult.ok) {
      releaseReservation();
      return createFailedResult(request, "transport-failed", startedAt, now().toISOString(), 1);
    }

    fixtureRoot = await mkdtemp(path.join(tmpdir(), "copilot-cli-fixture-"));
    const acquireVersion =
      resolved.acquireVersion ??
      (async (input) => {
        const acquired = await acquireCliVersion("copilot-cli", input);
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

    const tuple = await buildCopilotCliCompatibilityTuple(
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

    const probeAuth = resolved.probeAuth ?? ((input) => probeCliAuthStore("copilot-cli", input));
    const authResult = await probeAuth({
      executable: executableResult.value,
      cwd: fixtureRoot,
      env: envResult.value,
    });
    if (
      !authResult.ok ||
      authResult.value.authStoreEvidence === "unavailable" ||
      authResult.value.authStoreEvidence === "plaintext-fallback"
    ) {
      releaseReservation();
      return createFailedResult(request, "transport-failed", startedAt, now().toISOString(), 1);
    }

    const probeModelPolicy =
      resolved.probeModelPolicy ?? ((input) => probeCliModelPolicy("copilot-cli", input));
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

    const argv = buildCopilotCliExecArgv({
      modelId: request.evidenceKey.modelId,
      prompt: request.prompt,
    });

    try {
      assertCopilotArgvFlagsAllowlisted(record, argv);
      assertCopilotToolsAllowlisted(argv);
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

    const parsed = parseCopilotJsonlTerminal(processResult.stdout, record);
    if (!parsed.ok) {
      releaseReservation();
      return createFailedResult(request, "schema-failed", startedAt, now().toISOString(), 1);
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

export function createCopilotCliAdapter(dependencies?: CopilotCliDependencies): Adapter {
  return {
    productId: "copilot-cli",
    transportFamily: "local-cli",
    async execute(request) {
      return executeCopilotCliReview(request, dependencies);
    },
  };
}

export const copilotCliAdapter = createCopilotCliAdapter();
