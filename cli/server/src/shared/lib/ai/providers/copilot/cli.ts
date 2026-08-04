import { err, ok, type Result } from "@diffgazer/core/result";
import {
  type ExecutionResult,
  type ReviewResult,
  ReviewResultSchema,
} from "@diffgazer/core/schemas/review";
import type { Adapter, AdapterExecuteRequest } from "../../types.js";
import {
  assertParserEventKindAllowlisted,
  assertParserFieldPathAllowlisted,
  type CliCompatibilityRecord,
  type CliCompatibilityTuple,
} from "../cli-compatibility/compat.js";
import {
  buildCliCompatibilityTuple,
  type CliReviewDependencies,
  type CliReviewProduct,
  type CliTerminalOutput,
  createCliReviewAdapter,
  executeCliReview,
} from "../cli-review-driver.js";
import { type CopilotJsonlFailureCode, parseCopilotJsonlStream } from "./jsonl.js";

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
  return buildCliCompatibilityTuple("copilot-cli", request, executablePath, version);
}

const COPILOT_CLI_PRODUCT: CliReviewProduct = {
  productId: "copilot-cli",
  tmpPrefix: "copilot-cli-fixture-",
  rejectedAuthEvidence: ["unavailable", "plaintext-fallback"],
  buildArgv: ({ modelId, prompt }) => buildCopilotCliExecArgv({ modelId, prompt }),
  assertArgvAllowed: (record, argv) => {
    assertCopilotArgvFlagsAllowlisted(record, argv);
    assertCopilotToolsAllowlisted(argv);
  },
  parseTerminalOutput: (output: CliTerminalOutput, record) =>
    parseCopilotJsonlTerminal(output.stdout, record),
};

export function executeCopilotCliReview(
  request: AdapterExecuteRequest,
  dependencies: CliReviewDependencies = {},
): Promise<ExecutionResult> {
  return executeCliReview(request, COPILOT_CLI_PRODUCT, dependencies);
}

export function createCopilotCliAdapter(dependencies?: CliReviewDependencies): Adapter {
  return createCliReviewAdapter(COPILOT_CLI_PRODUCT, dependencies);
}

export const copilotCliAdapter = createCopilotCliAdapter();
