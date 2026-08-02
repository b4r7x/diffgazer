import {
  type ChildProcess,
  execFile,
  type SpawnOptionsWithoutStdio,
  spawn,
} from "node:child_process";
import { createHash } from "node:crypto";
import { readFile, realpath } from "node:fs/promises";
import { homedir } from "node:os";
import { promisify } from "node:util";
import { err, ok, type Result } from "@diffgazer/core/result";
import type { LocalCliProductId } from "@diffgazer/core/schemas/config";
import { Sha256HexSchema, sha256CanonicalJsonSync } from "@diffgazer/core/schemas/review";
import { z } from "zod";
import { redactDiagnosticText } from "../diagnostics.js";

export const CLI_COMPATIBILITY_SCHEMA_VERSION = 1 as const;

export const CLI_COMPATIBILITY_PROVIDERS = ["codex-cli", "copilot-cli"] as const;
export const CliCompatibilityProviderSchema = z.enum(CLI_COMPATIBILITY_PROVIDERS);

export const CLI_AUTH_STORE_EVIDENCE = [
  "vendor-managed-user-owned",
  "secure-store-reachable",
  "plaintext-fallback",
  "unavailable",
] as const;

export const CLI_TERMINAL_SOURCES = ["codex-output-last-message", "copilot-jsonl"] as const;

export const CLI_WORKING_DIRECTORY_KINDS = ["neutral-disposable-fixture"] as const;

export const HOSTILE_ATTEMPT_IDS = [
  "create",
  "overwrite",
  "delete",
  "rename",
  "shell-created",
  "loopback-curl",
  "fixture-mcp-ping",
  "plugin",
  "hook",
  "subagent",
  "export",
  "repository-instruction",
] as const;

export const CLI_CREDENTIAL_ENV_KEYS = [
  "COPILOT_GITHUB_TOKEN",
  "GH_TOKEN",
  "GITHUB_TOKEN",
  "OPENAI_API_KEY",
  "ANTHROPIC_API_KEY",
  "CODEX_API_KEY",
  "API_KEY",
  "AZURE_OPENAI_API_KEY",
  "AZURE_OPENAI_KEY",
] as const;

export const CLI_CHILD_ENV_ALLOWLIST = [
  "PATH",
  "HOME",
  "USER",
  "USERNAME",
  "LOGNAME",
  "SHELL",
  "LANG",
  "LC_ALL",
  "LC_CTYPE",
  "LC_MESSAGES",
  "TERM",
  "TMPDIR",
  "TEMP",
  "TMP",
  "APPDATA",
  "LOCALAPPDATA",
  "USERPROFILE",
  "SystemRoot",
  "SYSTEMROOT",
  "ComSpec",
  "COMSPEC",
  "XDG_CONFIG_HOME",
  "XDG_DATA_HOME",
  "XDG_CACHE_HOME",
  "XDG_RUNTIME_DIR",
] as const;

const FORBIDDEN_ENV_KEY_PATTERN =
  /(?:^|_)(?:API[_-]?KEY|TOKEN|SECRET|PASSWORD|CREDENTIAL|AUTH(?:ORIZATION)?|COOKIE|BEARER)(?:$|_)/i;

const CliCompatibilityPlatformSchema = z
  .strictObject({
    nodePlatform: z.string().min(1),
    architecture: z.string().min(1),
    osReleaseDigest: Sha256HexSchema,
  })
  .readonly();

const CliCompatibilityExecutableVersionSchema = z
  .strictObject({
    value: z.string().min(1),
    acquisitionArgv: z.array(z.string()).min(1),
    rawOutputSha256: Sha256HexSchema,
  })
  .readonly();

const CliCompatibilityExecutableSchema = z
  .strictObject({
    realPathDigest: Sha256HexSchema,
    fileSha256: Sha256HexSchema,
    version: CliCompatibilityExecutableVersionSchema,
  })
  .readonly();

const CliCompatibilityAuthSchema = z
  .strictObject({
    mode: z.literal("vendor-managed-local-auth"),
    credentialPassedByDiffgazer: z.literal(false),
    authStoreEvidence: z.enum(CLI_AUTH_STORE_EVIDENCE),
  })
  .readonly();

const CliCompatibilityModelSchema = z
  .strictObject({
    requested: z.string().min(1),
    policyCheck: z.literal("accepted"),
    rawOutputSha256: Sha256HexSchema,
  })
  .readonly();

const CliCompatibilityProfileSchema = z
  .strictObject({
    argv: z.array(z.string()).min(1),
    acceptedFlags: z.array(z.string()).min(1),
    workingDirectoryKind: z.enum(CLI_WORKING_DIRECTORY_KINDS),
  })
  .readonly();

const CliCompatibilityTerminalSchema = z
  .strictObject({
    source: z.enum(CLI_TERMINAL_SOURCES),
    acceptedEventKinds: z.array(z.string()),
    acceptedFieldPaths: z.array(z.string()).min(1),
    resultTextFieldPath: z.string().min(1),
    parserResult: z.literal("accepted"),
  })
  .readonly();

const CliCompatibilityPositiveFixtureSchema = z
  .strictObject({
    exitCode: z.literal(0),
    stdoutJsonlSha256: Sha256HexSchema,
    reviewSchemaSha256: Sha256HexSchema,
    terminal: CliCompatibilityTerminalSchema,
  })
  .readonly();

const CliCompatibilityNegativeFixtureSchema = z
  .strictObject({
    attemptIds: z.array(z.enum(HOSTILE_ATTEMPT_IDS)).min(HOSTILE_ATTEMPT_IDS.length),
    beforeTreeSha256: Sha256HexSchema,
    afterTreeSha256: Sha256HexSchema,
    treeUnchanged: z.literal(true),
    localNetworkConnections: z.literal(0),
    observedToolOrActionKinds: z.array(z.string()),
    passed: z.literal(true),
  })
  .readonly();

export const CliCompatibilityRecordSchema = z
  .strictObject({
    schemaVersion: z.literal(CLI_COMPATIBILITY_SCHEMA_VERSION),
    provider: CliCompatibilityProviderSchema,
    observedAt: z.iso.datetime(),
    platform: CliCompatibilityPlatformSchema,
    executable: CliCompatibilityExecutableSchema,
    auth: CliCompatibilityAuthSchema,
    model: CliCompatibilityModelSchema,
    profile: CliCompatibilityProfileSchema,
    positiveFixture: CliCompatibilityPositiveFixtureSchema,
    negativeFixture: CliCompatibilityNegativeFixtureSchema,
  })
  .superRefine((record, context) => {
    const attemptIds = new Set(record.negativeFixture.attemptIds);
    for (const attemptId of HOSTILE_ATTEMPT_IDS) {
      if (!attemptIds.has(attemptId)) {
        context.addIssue({
          code: "custom",
          message: `Missing hostile attempt id: ${attemptId}`,
          path: ["negativeFixture", "attemptIds"],
        });
      }
    }

    if (
      record.negativeFixture.treeUnchanged &&
      record.negativeFixture.beforeTreeSha256 !== record.negativeFixture.afterTreeSha256
    ) {
      context.addIssue({
        code: "custom",
        message: "Tree hashes must match when treeUnchanged is true",
        path: ["negativeFixture", "afterTreeSha256"],
      });
    }

    if (record.provider === "codex-cli" && record.auth.authStoreEvidence === "plaintext-fallback") {
      context.addIssue({
        code: "custom",
        message: "Codex auth cannot use plaintext fallback evidence",
        path: ["auth", "authStoreEvidence"],
      });
    }

    if (
      record.provider === "copilot-cli" &&
      record.auth.authStoreEvidence === "plaintext-fallback"
    ) {
      context.addIssue({
        code: "custom",
        message: "Copilot plaintext fallback auth is unsupported",
        path: ["auth", "authStoreEvidence"],
      });
    }

    if (
      record.positiveFixture.terminal.source === "codex-output-last-message" &&
      record.provider !== "codex-cli"
    ) {
      context.addIssue({
        code: "custom",
        message: "Codex terminal source requires codex-cli provider",
        path: ["positiveFixture", "terminal", "source"],
      });
    }

    if (
      record.positiveFixture.terminal.source === "copilot-jsonl" &&
      record.provider !== "copilot-cli"
    ) {
      context.addIssue({
        code: "custom",
        message: "Copilot terminal source requires copilot-cli provider",
        path: ["positiveFixture", "terminal", "source"],
      });
    }
  })
  .readonly();

export type CliCompatibilityRecord = z.infer<typeof CliCompatibilityRecordSchema>;

export type CliCompatibilityTuple = Readonly<{
  provider: LocalCliProductId;
  platform: Readonly<{
    nodePlatform: string;
    architecture: string;
  }>;
  executable: Readonly<{
    realPathDigest: string;
    fileSha256: string;
    version: string;
  }>;
  modelId: string;
  reviewSchemaSha256: string;
}>;

export const CLI_COMPATIBILITY_MISMATCH_REASONS = [
  "record-absent",
  "schema-invalid",
  "provider-mismatch",
  "platform-mismatch",
  "architecture-mismatch",
  "real-path-digest-mismatch",
  "file-sha256-mismatch",
  "version-mismatch",
  "model-mismatch",
  "review-schema-mismatch",
  "terminal-field-mismatch",
  "terminal-event-mismatch",
  "auth-evidence-mismatch",
  "auth-credential-passed",
  "negative-evidence-mismatch",
  "evidence-invalid",
] as const;

export type CliCompatibilityMismatchReason = (typeof CLI_COMPATIBILITY_MISMATCH_REASONS)[number];

export type CliCompatibilityMatchResult = Readonly<{
  matched: boolean;
  reason?: CliCompatibilityMismatchReason;
}>;

export type CliEnvironmentViolationCode =
  | "credential-env-key"
  | "forbidden-env-pattern"
  | "temporary-home"
  | "disallowed-env-key";

export type CliEnvironmentViolation = Readonly<{
  code: CliEnvironmentViolationCode;
  key: string;
}>;

export class CliParserAllowlistError extends Error {
  readonly fieldPath?: string;
  readonly eventKind?: string;

  constructor(message: string, details?: { fieldPath?: string; eventKind?: string }) {
    super(message);
    this.name = "CliParserAllowlistError";
    this.fieldPath = details?.fieldPath;
    this.eventKind = details?.eventKind;
  }
}

export function parseCliCompatibilityRecord(
  input: unknown,
): Result<CliCompatibilityRecord, { code: "schema-invalid"; message: string }> {
  const parsed = CliCompatibilityRecordSchema.safeParse(input);
  if (!parsed.success) {
    return err({
      code: "schema-invalid",
      message: parsed.error.issues.map((issue) => issue.message).join("; "),
    });
  }
  return ok(parsed.data);
}

export function validateCliCompatibilityEvidence(
  record: CliCompatibilityRecord,
): Result<CliCompatibilityRecord, { code: "evidence-invalid"; message: string }> {
  if (record.auth.credentialPassedByDiffgazer) {
    return err({
      code: "evidence-invalid",
      message: "credentialPassedByDiffgazer must remain false",
    });
  }

  if (!record.negativeFixture.passed || !record.negativeFixture.treeUnchanged) {
    return err({
      code: "evidence-invalid",
      message: "Negative fixture must pass with an unchanged tree",
    });
  }

  if (record.negativeFixture.localNetworkConnections !== 0) {
    return err({
      code: "evidence-invalid",
      message: "Negative fixture must record zero loopback connections",
    });
  }

  return ok(record);
}

export function matchCliCompatibilityTuple(
  record: CliCompatibilityRecord | null | undefined,
  tuple: CliCompatibilityTuple,
): CliCompatibilityMatchResult {
  if (!record) {
    return { matched: false, reason: "record-absent" };
  }

  const parsed = parseCliCompatibilityRecord(record);
  if (!parsed.ok) {
    return { matched: false, reason: "schema-invalid" };
  }

  const evidence = validateCliCompatibilityEvidence(parsed.value);
  if (!evidence.ok) {
    return { matched: false, reason: "evidence-invalid" };
  }

  const validated = evidence.value;
  if (validated.provider !== tuple.provider) {
    return { matched: false, reason: "provider-mismatch" };
  }
  if (validated.platform.nodePlatform !== tuple.platform.nodePlatform) {
    return { matched: false, reason: "platform-mismatch" };
  }
  if (validated.platform.architecture !== tuple.platform.architecture) {
    return { matched: false, reason: "architecture-mismatch" };
  }
  if (validated.executable.realPathDigest !== tuple.executable.realPathDigest) {
    return { matched: false, reason: "real-path-digest-mismatch" };
  }
  if (validated.executable.fileSha256 !== tuple.executable.fileSha256) {
    return { matched: false, reason: "file-sha256-mismatch" };
  }
  if (validated.executable.version.value !== tuple.executable.version) {
    return { matched: false, reason: "version-mismatch" };
  }
  if (validated.model.requested !== tuple.modelId) {
    return { matched: false, reason: "model-mismatch" };
  }
  if (validated.positiveFixture.reviewSchemaSha256 !== tuple.reviewSchemaSha256) {
    return { matched: false, reason: "review-schema-mismatch" };
  }

  if (validated.auth.authStoreEvidence === "unavailable") {
    return { matched: false, reason: "auth-evidence-mismatch" };
  }

  if (validated.auth.credentialPassedByDiffgazer) {
    return { matched: false, reason: "auth-credential-passed" };
  }

  if (
    !validated.negativeFixture.passed ||
    !validated.negativeFixture.treeUnchanged ||
    validated.negativeFixture.localNetworkConnections !== 0
  ) {
    return { matched: false, reason: "negative-evidence-mismatch" };
  }

  return { matched: true };
}

export function assertParserFieldPathAllowlisted(
  record: CliCompatibilityRecord,
  fieldPath: string,
): void {
  if (!record.positiveFixture.terminal.acceptedFieldPaths.includes(fieldPath)) {
    throw new CliParserAllowlistError(`Unrecorded parser field path: ${fieldPath}`, {
      fieldPath,
    });
  }
}

export function assertParserEventKindAllowlisted(
  record: CliCompatibilityRecord,
  eventKind: string,
): void {
  if (!record.positiveFixture.terminal.acceptedEventKinds.includes(eventKind)) {
    throw new CliParserAllowlistError(`Unrecorded parser event kind: ${eventKind}`, {
      eventKind,
    });
  }
}

export function redactCliArgv(argv: readonly string[]): string[] {
  return argv.map((argument) => redactDiagnosticText(argument));
}

export function redactCliCompatibilityRecord(
  record: CliCompatibilityRecord,
): CliCompatibilityRecord {
  return {
    ...record,
    profile: {
      ...record.profile,
      argv: redactCliArgv(record.profile.argv),
    },
    executable: {
      ...record.executable,
      version: {
        ...record.executable.version,
        acquisitionArgv: redactCliArgv(record.executable.version.acquisitionArgv),
      },
    },
  };
}

export function redactCliTranscript(text: string): string {
  return redactDiagnosticText(text);
}

function resolveAmbientHome(): string {
  return process.env.HOME ?? homedir();
}

export function findCliEnvironmentViolations(
  env: Readonly<Record<string, string | undefined>>,
  options: Readonly<{ ambientHome?: string }> = {},
): readonly CliEnvironmentViolation[] {
  const ambientHome = options.ambientHome ?? resolveAmbientHome();
  const violations: CliEnvironmentViolation[] = [];

  for (const [key, value] of Object.entries(env)) {
    if (value === undefined) {
      continue;
    }

    const normalizedKey = key.toUpperCase();
    if ((CLI_CREDENTIAL_ENV_KEYS as readonly string[]).includes(normalizedKey)) {
      violations.push({ code: "credential-env-key", key });
      continue;
    }

    if (FORBIDDEN_ENV_KEY_PATTERN.test(normalizedKey)) {
      violations.push({ code: "forbidden-env-pattern", key });
      continue;
    }

    if (normalizedKey === "HOME" && value !== ambientHome) {
      violations.push({ code: "temporary-home", key });
      continue;
    }

    if (!(CLI_CHILD_ENV_ALLOWLIST as readonly string[]).includes(key)) {
      violations.push({ code: "disallowed-env-key", key });
    }
  }

  return violations;
}

export function validateCliChildEnvironment(
  env: Readonly<Record<string, string | undefined>>,
  options: Readonly<{ ambientHome?: string }> = {},
): Result<Record<string, string>, CliEnvironmentViolation> {
  const violations = findCliEnvironmentViolations(env, options);
  const firstViolation = violations[0];
  if (firstViolation) {
    return err(firstViolation);
  }

  const output: Record<string, string> = {};
  for (const [key, value] of Object.entries(env)) {
    if (value !== undefined) {
      output[key] = value;
    }
  }
  return ok(output);
}

export function buildCliChildEnvironment(
  ambientEnv: Readonly<Record<string, string | undefined>> = process.env,
  options: Readonly<{ ambientHome?: string }> = {},
): Result<Record<string, string>, CliEnvironmentViolation> {
  const ambientHome = options.ambientHome ?? resolveAmbientHome();
  const narrowed: Record<string, string | undefined> = {};

  for (const key of CLI_CHILD_ENV_ALLOWLIST) {
    const value = ambientEnv[key];
    if (value !== undefined) {
      narrowed[key] = value;
    }
  }

  narrowed.HOME = ambientHome;
  return validateCliChildEnvironment(narrowed, { ambientHome });
}

export async function digestExecutableRealPath(executablePath: string): Promise<string> {
  const resolved = await realpath(executablePath);
  return sha256CanonicalJsonSync({ realPath: resolved });
}

export async function hashExecutableFileSha256(executablePath: string): Promise<string> {
  const bytes = await readFile(executablePath);
  return createHash("sha256").update(bytes).digest("hex");
}

/** Per-channel transcript ceiling; a vendor CLI must not stream unbounded output into memory. */
export const CLI_PROCESS_MAX_OUTPUT_BYTES = 1_048_576;

/** Wall-clock ceiling for a probe/vendor CLI run before the process tree is terminated. */
export const CLI_PROCESS_DEFAULT_TIMEOUT_MS = 120_000;

export type CliProcessRunInput = Readonly<{
  executable: string;
  argv: readonly string[];
  cwd: string;
  env: Readonly<Record<string, string>>;
  stdin?: string;
  signal?: AbortSignal;
  maxOutputBytes?: number;
  timeoutMs?: number;
}>;

export type CliProcessRunResult = Readonly<{
  exitCode: number | null;
  signal: string | null;
  stdout: string;
  stderr: string;
  cancelledLocally: boolean;
  descendantsTerminatedLocally: boolean;
  outputTruncated: boolean;
  timedOut: boolean;
}>;

export type CliProcessSupervisor = Readonly<{
  pid: number;
  child: ChildProcess;
  exited: boolean;
  descendantsExited: boolean;
}>;

export type CliSpawnFn = (
  command: string,
  args: readonly string[],
  options: SpawnOptionsWithoutStdio,
) => ChildProcess;

export type CliProcessDependencies = Readonly<{
  spawn?: CliSpawnFn;
  gracefulTimeoutMs?: number;
  forcedTimeoutMs?: number;
  sleep?: (ms: number) => Promise<void>;
}>;

const defaultSleep = (ms: number): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

let testDependencies: CliProcessDependencies = {};

export function setCliProcessTestDependencies(dependencies: CliProcessDependencies): void {
  testDependencies = dependencies;
}

function resolveProcessDependencies(
  dependencies: CliProcessDependencies = {},
): Required<
  Pick<CliProcessDependencies, "spawn" | "gracefulTimeoutMs" | "forcedTimeoutMs" | "sleep">
> {
  return {
    spawn: dependencies.spawn ?? testDependencies.spawn ?? spawn,
    gracefulTimeoutMs:
      dependencies.gracefulTimeoutMs ?? testDependencies.gracefulTimeoutMs ?? 1_000,
    forcedTimeoutMs: dependencies.forcedTimeoutMs ?? testDependencies.forcedTimeoutMs ?? 1_000,
    sleep: dependencies.sleep ?? testDependencies.sleep ?? defaultSleep,
  };
}

async function waitForChildExit(
  child: ChildProcess,
): Promise<{ code: number | null; signal: string | null }> {
  if (child.exitCode !== null || child.signalCode !== null) {
    return { code: child.exitCode, signal: child.signalCode };
  }

  return new Promise((resolve, reject) => {
    child.once("error", reject);
    child.once("close", (code, signal) => resolve({ code, signal }));
  });
}

async function processAlive(pid: number): Promise<boolean> {
  try {
    process.kill(pid, 0);
  } catch {
    return false;
  }

  if (process.platform === "win32") {
    return true;
  }

  try {
    const output = await execFileAsync("ps", ["-p", String(pid), "-o", "state="]);
    const state = output.stdout.trim();
    return state.length > 0 && state !== "Z";
  } catch {
    return false;
  }
}

export async function terminateCliProcessGroup(
  supervisor: CliProcessSupervisor,
  descendantPids: readonly number[] = [],
  dependencies: CliProcessDependencies = {},
): Promise<
  Readonly<{
    localTerminationClaimed: true;
    gracefulAttempted: boolean;
    forcedAttempted: boolean;
    descendantsExited: boolean;
  }>
> {
  const resolved = resolveProcessDependencies(dependencies);
  let gracefulAttempted = false;
  let forcedAttempted = false;

  if (!supervisor.exited) {
    gracefulAttempted = true;
    if (process.platform === "win32") {
      supervisor.child.kill();
    } else {
      try {
        process.kill(-supervisor.pid, "SIGTERM");
      } catch {
        supervisor.child.kill("SIGTERM");
      }
      for (const descendantPid of descendantPids) {
        try {
          process.kill(descendantPid, "SIGTERM");
        } catch {
          // Descendant may already have exited with the process group.
        }
      }
    }

    const gracefulDeadline = Date.now() + resolved.gracefulTimeoutMs;
    while (Date.now() < gracefulDeadline) {
      if (supervisor.child.exitCode !== null || supervisor.child.signalCode !== null) {
        break;
      }
      await resolved.sleep(25);
    }

    if (supervisor.child.exitCode === null && supervisor.child.signalCode === null) {
      forcedAttempted = true;
      if (process.platform === "win32") {
        supervisor.child.kill("SIGKILL");
      } else {
        try {
          process.kill(-supervisor.pid, "SIGKILL");
        } catch {
          supervisor.child.kill("SIGKILL");
        }
        for (const descendantPid of descendantPids) {
          try {
            process.kill(descendantPid, "SIGKILL");
          } catch {
            // Descendant may already have exited with the process group.
          }
        }
      }
      const forcedDeadline = Date.now() + resolved.forcedTimeoutMs;
      while (Date.now() < forcedDeadline) {
        if (supervisor.child.exitCode !== null || supervisor.child.signalCode !== null) {
          break;
        }
        await resolved.sleep(25);
      }
    }
  }

  await waitForChildExit(supervisor.child);

  const descendantDeadline = Date.now() + resolved.forcedTimeoutMs;
  while (Date.now() < descendantDeadline) {
    const descendantChecks = await Promise.all(descendantPids.map((pid) => processAlive(pid)));
    if (descendantChecks.every((alive) => !alive)) {
      return {
        localTerminationClaimed: true,
        gracefulAttempted,
        forcedAttempted,
        descendantsExited: true,
      };
    }
    await resolved.sleep(25);
  }

  const descendantChecks = await Promise.all(descendantPids.map((pid) => processAlive(pid)));
  const descendantsExited = descendantChecks.every((alive) => !alive);

  return {
    localTerminationClaimed: true,
    gracefulAttempted,
    forcedAttempted,
    descendantsExited,
  };
}

export async function runCliArgvProcess(
  input: CliProcessRunInput,
  dependencies: CliProcessDependencies = {},
): Promise<CliProcessRunResult> {
  const resolved = resolveProcessDependencies(dependencies);
  const envResult = validateCliChildEnvironment(input.env);
  if (!envResult.ok) {
    throw new Error(
      `CLI child environment rejected: ${envResult.error.code} ${envResult.error.key}`,
    );
  }

  const child = resolved.spawn(input.executable, [...input.argv], {
    cwd: input.cwd,
    env: envResult.value,
    shell: false,
    detached: process.platform !== "win32",
    stdio: ["pipe", "pipe", "pipe"],
  });

  if (!child.pid) {
    throw new Error("CLI child process did not report a pid");
  }

  const maxOutputBytes = input.maxOutputBytes ?? CLI_PROCESS_MAX_OUTPUT_BYTES;
  let outputTruncated = false;
  const appendBounded = (buffer: string, chunk: string): string => {
    const remaining = maxOutputBytes - Buffer.byteLength(buffer, "utf8");
    if (remaining <= 0) {
      outputTruncated = true;
      return buffer;
    }
    if (Buffer.byteLength(chunk, "utf8") <= remaining) {
      return buffer + chunk;
    }
    outputTruncated = true;
    return buffer + Buffer.from(chunk, "utf8").subarray(0, remaining).toString("utf8");
  };

  let stdout = "";
  let stderr = "";
  child.stdout?.setEncoding("utf8");
  child.stderr?.setEncoding("utf8");
  child.stdout?.on("data", (chunk: string) => {
    stdout = appendBounded(stdout, chunk);
  });
  child.stderr?.on("data", (chunk: string) => {
    stderr = appendBounded(stderr, chunk);
  });

  if (input.stdin !== undefined && child.stdin) {
    child.stdin.write(input.stdin);
    child.stdin.end();
  }

  let cancelledLocally = false;
  let timedOut = false;
  let termination: Promise<{ descendantsExited: boolean }> | undefined;
  const terminate = () => {
    if (termination !== undefined) return;
    const supervisor: CliProcessSupervisor = {
      pid: child.pid ?? 0,
      child,
      exited: child.exitCode !== null || child.signalCode !== null,
      descendantsExited: false,
    };
    termination = terminateCliProcessGroup(supervisor, [], dependencies);
  };

  const onAbort = () => {
    cancelledLocally = true;
    terminate();
  };

  if (input.signal) {
    if (input.signal.aborted) {
      onAbort();
    } else {
      input.signal.addEventListener("abort", onAbort, { once: true });
    }
  }

  const timeoutMs = input.timeoutMs ?? CLI_PROCESS_DEFAULT_TIMEOUT_MS;
  const timer = setTimeout(() => {
    timedOut = true;
    terminate();
  }, timeoutMs);
  timer.unref?.();

  const exit = await waitForChildExit(child);
  clearTimeout(timer);
  if (input.signal) {
    input.signal.removeEventListener("abort", onAbort);
  }

  // The tree must be gone before the caller settles the attempt: a detached
  // descendant outliving the receipt is exactly what REQ-041 forbids.
  const terminationResult = await termination;

  return {
    exitCode: exit.code,
    signal: exit.signal,
    stdout: redactCliTranscript(stdout),
    stderr: redactCliTranscript(stderr),
    cancelledLocally,
    descendantsTerminatedLocally: terminationResult?.descendantsExited ?? false,
    outputTruncated,
    timedOut,
  };
}

const execFileAsync = promisify(execFile);
