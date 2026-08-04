import { writeFile } from "node:fs/promises";
import path from "node:path";
import { err, ok, type Result } from "@diffgazer/core/result";
import {
  type ExecutionResult,
  type ReviewResult,
  ReviewResultSchema,
} from "@diffgazer/core/schemas/review";
import type { Adapter, AdapterExecuteRequest } from "../types.js";
import {
  assertParserFieldPathAllowlisted,
  type CliCompatibilityRecord,
  type CliCompatibilityTuple,
} from "./cli-compatibility/compat.js";
import { buildReviewSchemaJson } from "./cli-compatibility/probe.js";
import {
  buildCliCompatibilityTuple,
  type CliReviewDependencies,
  type CliReviewProduct,
  type CliTerminalOutput,
  createCliReviewAdapter,
  executeCliReview,
} from "./cli-review-driver.js";

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

const REVIEW_SCHEMA_FILE = "review-schema.json";
const RESULT_FILE = "result.json";

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

/**
 * Codex writes its review to the last-message file; a transcript that carries
 * only lifecycle events is not evidence that the file was produced by this run.
 */
function isEventOnlyStdout(stdout: string): boolean {
  const lines = stdout
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines.length === 0) {
    return false;
  }
  return lines.every((line) => {
    try {
      const event = JSON.parse(line) as Record<string, unknown>;
      return typeof event.type === "string" && !("issues" in event);
    } catch {
      return false;
    }
  });
}

function parseCodexTerminalOutput(
  output: CliTerminalOutput,
  record: CliCompatibilityRecord,
): Result<ReviewResult, { code: "malformed-json" | "schema-failed" | "parser-allowlist" }> {
  const parsed = parseCodexOutputLastMessage(output.resultFile, record);
  if (!parsed.ok) {
    return parsed;
  }
  if (isEventOnlyStdout(output.stdout)) {
    return err({ code: "schema-failed" });
  }
  return parsed;
}

export async function buildCodexCliCompatibilityTuple(
  request: AdapterExecuteRequest,
  executablePath: string,
  version: string,
): Promise<CliCompatibilityTuple> {
  return buildCliCompatibilityTuple("codex-cli", request, executablePath, version);
}

const CODEX_CLI_PRODUCT: CliReviewProduct = {
  productId: "codex-cli",
  tmpPrefix: "codex-cli-fixture-",
  rejectedAuthEvidence: ["unavailable"],
  resultFileName: RESULT_FILE,
  prepareFixture: async (fixtureRoot) => {
    await writeFile(
      path.join(fixtureRoot, REVIEW_SCHEMA_FILE),
      JSON.stringify(buildReviewSchemaJson()),
      "utf8",
    );
  },
  buildArgv: ({ fixtureRoot, modelId, prompt }) =>
    buildCodexCliExecArgv({
      reviewSchemaPath: path.join(fixtureRoot, REVIEW_SCHEMA_FILE),
      resultPath: path.join(fixtureRoot, RESULT_FILE),
      modelId,
      prompt,
    }),
  assertArgvAllowed: assertCodexArgvFlagsAllowlisted,
  parseTerminalOutput: parseCodexTerminalOutput,
};

export function executeCodexCliReview(
  request: AdapterExecuteRequest,
  dependencies: CliReviewDependencies = {},
): Promise<ExecutionResult> {
  return executeCliReview(request, CODEX_CLI_PRODUCT, dependencies);
}

export function createCodexCliAdapter(dependencies?: CliReviewDependencies): Adapter {
  return createCliReviewAdapter(CODEX_CLI_PRODUCT, dependencies);
}

export const codexCliAdapter = createCodexCliAdapter();
