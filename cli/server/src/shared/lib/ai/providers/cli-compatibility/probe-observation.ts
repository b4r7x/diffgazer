import { readFile } from "node:fs/promises";
import path from "node:path";
import { err, ok, type Result } from "@diffgazer/core/result";
import { LensReviewResultSchema } from "@diffgazer/core/schemas/review";
import {
  buildCodexCliExecArgv,
  CODEX_CLI_ACCEPTED_FLAGS,
  extractCodexTerminalFieldPaths,
} from "../codex-cli.js";
import { buildCopilotCliExecArgv, COPILOT_CLI_ACCEPTED_FLAGS } from "../copilot/cli.js";
import { parseCopilotJsonlStream } from "../copilot/jsonl.js";
import type { CliNegativeFixtureRun } from "./probe-fixture.js";
import {
  type CliProcessRunInput,
  type CliProcessRunResult,
  runCliArgvProcess,
} from "./process-supervisor.js";
import type { CLI_COMPATIBILITY_PROVIDERS } from "./record.js";

export type CliCompatibilityProbeProvider = (typeof CLI_COMPATIBILITY_PROVIDERS)[number];

type CliProcessRunner = (input: CliProcessRunInput) => Promise<CliProcessRunResult>;

export type CliPositiveFixtureRun = Readonly<{
  exitCode: number;
  stdoutJsonl: string;
  terminalPayload: unknown;
  argv: readonly string[];
  acceptedFlags: readonly string[];
  acceptedEventKinds: readonly string[];
  acceptedFieldPaths: readonly string[];
  resultTextFieldPath: string;
}>;

export async function defaultRunPositiveFixture(input: {
  provider: CliCompatibilityProbeProvider;
  executable: string;
  modelId: string;
  fixtureRoot: string;
  env: Readonly<Record<string, string>>;
  reviewSchemaPath: string;
  resultPath: string;
  signal?: AbortSignal;
  runProcess?: CliProcessRunner;
}): Promise<Result<CliPositiveFixtureRun, string>> {
  const argv =
    input.provider === "codex-cli"
      ? buildCodexCliExecArgv({
          reviewSchemaPath: input.reviewSchemaPath,
          resultPath: input.resultPath,
          modelId: input.modelId,
        })
      : buildCopilotCliExecArgv({ modelId: input.modelId });

  const runProcess = input.runProcess ?? runCliArgvProcess;
  const result = await runProcess({
    executable: input.executable,
    argv,
    cwd: input.fixtureRoot,
    env: input.env,
    stdin: "Return a minimal valid review JSON object with an empty issues array.",
    signal: input.signal,
  });

  if ((result.timedOut || result.cancelledLocally) && !result.descendantsTerminatedLocally) {
    return err("Positive fixture process termination could not be confirmed");
  }

  if (result.timedOut) {
    return err("Positive fixture exceeded the probe wall-time limit");
  }

  if (result.outputTruncated) {
    return err("Positive fixture exceeded the probe output limit");
  }

  if (result.exitCode !== 0) {
    return err(`Positive fixture exited with code ${result.exitCode ?? "null"}`);
  }

  if (input.provider === "codex-cli") {
    let terminalPayload: unknown;
    try {
      const raw = await readFile(input.resultPath, "utf8");
      terminalPayload = JSON.parse(raw) as unknown;
    } catch {
      return err("Positive fixture last-message JSON is malformed");
    }

    const parsed = LensReviewResultSchema.safeParse(terminalPayload);
    if (!parsed.success) {
      return err("Positive fixture terminal payload failed review schema validation");
    }

    const terminal = extractCodexTerminalFieldPaths(parsed.data);
    return ok({
      exitCode: 0,
      stdoutJsonl: result.stdout,
      terminalPayload: parsed.data,
      argv,
      acceptedFlags: [...CODEX_CLI_ACCEPTED_FLAGS],
      acceptedEventKinds: [],
      acceptedFieldPaths: terminal.acceptedFieldPaths,
      resultTextFieldPath: terminal.resultTextFieldPath,
    });
  }

  const stream = parseCopilotJsonlStream(result.stdout);
  if (!stream.ok) {
    return err(`Positive fixture terminal JSONL was rejected: ${stream.error.code}`);
  }

  const terminal = stream.value;
  const parsed = LensReviewResultSchema.safeParse({
    issues: terminal.terminalRecord.issues,
  });
  if (!parsed.success) {
    return err("Positive fixture terminal JSONL failed review schema validation");
  }

  return ok({
    exitCode: 0,
    stdoutJsonl: result.stdout,
    terminalPayload: parsed.data,
    argv,
    acceptedFlags: [...COPILOT_CLI_ACCEPTED_FLAGS],
    acceptedEventKinds: terminal.acceptedEventKinds,
    acceptedFieldPaths: terminal.acceptedFieldPaths,
    resultTextFieldPath: terminal.resultTextFieldPath,
  });
}

const OBSERVED_ACTION_KINDS: Readonly<Record<string, string>> = {
  bash: "shell",
  command_execution: "shell",
  edit: "write",
  export: "export",
  file_change: "write",
  glob: "glob",
  grep: "grep",
  hook: "hook",
  mcp: "mcp",
  mcp_tool_call: "mcp",
  plugin: "plugin",
  read: "read",
  read_file: "read",
  readfile: "read",
  shell: "shell",
  subagent: "subagent",
  view: "view",
  write: "write",
};

const CODEX_ACTION_EVENT_TYPES = new Set(["item.completed", "item.started"]);
const COPILOT_ACTION_EVENT_TYPES = new Set([
  "tool.execution_complete",
  "tool.execution_end",
  "tool.execution_start",
  "tool_call",
  "tool_use",
]);
const EXPLICIT_ACTION_LINE =
  /^(?:action|tool)(?:[ ._-](?:call|completed|execution|started|use))?\s*[:=]\s*([a-z][\w.-]*)\b/i;

function isUnknownRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readStringField(record: Record<string, unknown> | null, field: string): string | null {
  if (record === null) return null;
  const value = record[field];
  return typeof value === "string" ? value : null;
}

export function observeCliToolOrActionKinds(input: {
  provider: CliCompatibilityProbeProvider;
  stdout: string;
  stderr: string;
  outOfFixtureCanaryValue: string;
}): string[] {
  const output = `${input.stdout}\n${input.stderr}`;
  const observed = new Set<string>();
  const actionEventTypes =
    input.provider === "codex-cli" ? CODEX_ACTION_EVENT_TYPES : COPILOT_ACTION_EVENT_TYPES;

  for (const line of output.split(/\r?\n/u)) {
    const trimmed = line.trim();
    if (trimmed.length === 0) continue;

    let actionName: string | null = null;
    try {
      const event: unknown = JSON.parse(trimmed);
      if (!isUnknownRecord(event)) continue;

      const eventType = readStringField(event, "type") ?? readStringField(event, "event");
      if (eventType === null || !actionEventTypes.has(eventType.toLowerCase())) {
        continue;
      }

      const item = isUnknownRecord(event.item) ? event.item : null;
      const data = isUnknownRecord(event.data) ? event.data : null;
      actionName =
        readStringField(item, "type") ??
        readStringField(item, "name") ??
        readStringField(data, "toolName") ??
        readStringField(data, "name") ??
        readStringField(event, "toolName") ??
        readStringField(event, "name");
    } catch {
      actionName = trimmed.match(EXPLICIT_ACTION_LINE)?.[1] ?? null;
    }

    if (actionName === null) continue;
    const kind = OBSERVED_ACTION_KINDS[actionName.toLowerCase()] ?? null;
    if (kind !== null) observed.add(kind);
  }

  if (output.includes(input.outOfFixtureCanaryValue)) {
    observed.add("out-of-fixture-read");
  }

  return [...observed];
}

export function validateNegativeFixtureProcessRun(
  result: CliProcessRunResult,
): Result<void, string> {
  if ((result.timedOut || result.cancelledLocally) && !result.descendantsTerminatedLocally) {
    return err("Negative fixture process termination could not be confirmed");
  }

  if (result.timedOut) {
    return err("Negative fixture exceeded the probe wall-time limit");
  }

  if (result.outputTruncated) {
    return err("Negative fixture exceeded the probe output limit");
  }

  if (result.exitCode !== 0) {
    return err(`Negative fixture exited with code ${result.exitCode ?? "null"}`);
  }

  return ok(undefined);
}

export async function defaultRunNegativeFixture(input: {
  provider: CliCompatibilityProbeProvider;
  executable: string;
  modelId: string;
  fixtureRoot: string;
  env: Readonly<Record<string, string>>;
  loopbackUrl: string;
  hostilePrompt: string;
  outOfFixtureCanary: Readonly<{ path: string; value: string }>;
  signal?: AbortSignal;
  runProcess?: CliProcessRunner;
}): Promise<Result<CliNegativeFixtureRun, string>> {
  const argv =
    input.provider === "codex-cli"
      ? buildCodexCliExecArgv({
          reviewSchemaPath: path.join(input.fixtureRoot, "review-schema.json"),
          resultPath: path.join(input.fixtureRoot, "result.json"),
          modelId: input.modelId,
        })
      : buildCopilotCliExecArgv({ modelId: input.modelId });

  const runProcess = input.runProcess ?? runCliArgvProcess;
  const result = await runProcess({
    executable: input.executable,
    argv,
    cwd: input.fixtureRoot,
    env: input.env,
    stdin: input.hostilePrompt,
    signal: input.signal,
  });

  const processValidation = validateNegativeFixtureProcessRun(result);
  if (!processValidation.ok) {
    return processValidation;
  }

  return ok({
    observedToolOrActionKinds: observeCliToolOrActionKinds({
      provider: input.provider,
      stdout: result.stdout,
      stderr: result.stderr,
      outOfFixtureCanaryValue: input.outOfFixtureCanary.value,
    }),
  });
}
