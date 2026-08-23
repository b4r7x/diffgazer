import { createHash } from "node:crypto";
import { readFile, realpath } from "node:fs/promises";
import { sha256CanonicalJsonSync } from "@diffgazer/core/json";
import { err, ok, type Result } from "@diffgazer/core/result";
import type { LocalCliProductId } from "@diffgazer/core/schemas/config";
import { Sha256HexSchema } from "@diffgazer/core/schemas/review";
import { z } from "zod";
import { redactDiagnosticText } from "../../diagnostics.js";

const CLI_COMPATIBILITY_SCHEMA_VERSION = 1 as const;

export const CLI_COMPATIBILITY_PROVIDERS = ["codex-cli", "copilot-cli"] as const;
const CliCompatibilityProviderSchema = z.enum(CLI_COMPATIBILITY_PROVIDERS);

const CLI_AUTH_STORE_EVIDENCE = [
  "vendor-managed-user-owned",
  "secure-store-reachable",
  "plaintext-fallback",
  "unavailable",
] as const;

const CLI_TERMINAL_SOURCES = ["codex-output-last-message", "copilot-jsonl"] as const;

/**
 * `codex exec -` forces Codex to read the whole prompt from stdin, so no diff or
 * project context ever reaches the child's command line. Copilot has no such
 * sentinel: it reads piped input whenever no `-p`/`--prompt` argument is given.
 */
export const CODEX_STDIN_PROMPT_SENTINEL = "-";

const CLI_WORKING_DIRECTORY_KINDS = ["neutral-disposable-fixture"] as const;

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
  "out-of-fixture-read",
  "repository-instruction",
] as const;

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

const CliCompatibilityRecordSchema = z
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

/** Stamped by the compatibility probe on both bundles so consumers can refuse foreign files. */
export const CLI_COMPATIBILITY_GENERATOR_MARKER = "cli-compatibility-probe" as const;
export const CLI_COMPATIBILITY_BUNDLE_SCHEMA_VERSION = 1 as const;

const CliCompatibilityBundleEnvelopeSchema = {
  generator: z.literal(CLI_COMPATIBILITY_GENERATOR_MARKER),
  schemaVersion: z.literal(CLI_COMPATIBILITY_BUNDLE_SCHEMA_VERSION),
};

/**
 * Records stay `unknown` here: the bundle envelope is the contract, and each
 * record is parsed individually so one drifted entry cannot discard the rest.
 */
export const CliCompatibilityRecordBundleSchema = z
  .strictObject({ ...CliCompatibilityBundleEnvelopeSchema, records: z.array(z.unknown()) })
  .readonly();

const CLI_COMPATIBILITY_UNSUPPORTED_STATUSES = ["skipped", "unsupported"] as const;

const CliUnsupportedCompatibilityRecordSchema = z
  .strictObject({
    provider: CliCompatibilityProviderSchema,
    modelId: z.string().min(1),
    platform: z
      .strictObject({
        nodePlatform: z.string().min(1),
        architecture: z.string().min(1),
      })
      .readonly(),
    status: z.enum(CLI_COMPATIBILITY_UNSUPPORTED_STATUSES),
    reason: z.string().min(1),
  })
  .readonly();

export type CliUnsupportedCompatibilityRecord = z.infer<
  typeof CliUnsupportedCompatibilityRecordSchema
>;

export const CliUnsupportedCompatibilityRecordBundleSchema = z
  .strictObject({
    ...CliCompatibilityBundleEnvelopeSchema,
    records: z.array(CliUnsupportedCompatibilityRecordSchema),
  })
  .readonly();

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

const CLI_COMPATIBILITY_MISMATCH_REASONS = [
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
  "evidence-invalid",
] as const;

type CliCompatibilityMismatchReason = (typeof CLI_COMPATIBILITY_MISMATCH_REASONS)[number];

export type CliCompatibilityMatchResult = Readonly<{
  matched: boolean;
  reason?: CliCompatibilityMismatchReason;
}>;

export class CliParserAllowlistError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CliParserAllowlistError";
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

/**
 * Authority checks the record schema cannot express. `credentialPassedByDiffgazer`,
 * `negativeFixture.passed`, `treeUnchanged`, and `localNetworkConnections` are
 * pinned to literals by `CliCompatibilityRecordSchema`, so a parsed record has
 * already satisfied them; only the free-form fields are re-examined here.
 */
export function validateCliCompatibilityEvidence(
  record: CliCompatibilityRecord,
): Result<CliCompatibilityRecord, { code: "evidence-invalid"; message: string }> {
  if (record.negativeFixture.observedToolOrActionKinds.length > 0) {
    return err({
      code: "evidence-invalid",
      message: "Negative fixture must not observe tool or action use",
    });
  }

  if (record.provider === "codex-cli") {
    const argvGrantsRead = record.profile.argv.some(
      (token, index) => token === "--sandbox" && record.profile.argv[index + 1] === "read-only",
    );
    const allowlistGrantsRead =
      record.profile.acceptedFlags.includes("--sandbox") &&
      record.profile.acceptedFlags.includes("read-only");
    if (argvGrantsRead || allowlistGrantsRead) {
      return err({
        code: "evidence-invalid",
        message: "Codex compatibility profile grants filesystem read authority",
      });
    }
  }

  if (
    record.provider === "copilot-cli" &&
    (record.profile.argv.includes("--available-tools=view,glob,grep") ||
      record.profile.acceptedFlags.includes("--available-tools=view,glob,grep"))
  ) {
    return err({
      code: "evidence-invalid",
      message: "Copilot compatibility profile grants filesystem read authority",
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

  return { matched: true };
}

export function assertParserFieldPathAllowlisted(
  record: CliCompatibilityRecord,
  fieldPath: string,
): void {
  if (!record.positiveFixture.terminal.acceptedFieldPaths.includes(fieldPath)) {
    throw new CliParserAllowlistError(`Unrecorded parser field path: ${fieldPath}`);
  }
}

export function assertParserEventKindAllowlisted(
  record: CliCompatibilityRecord,
  eventKind: string,
): void {
  if (!record.positiveFixture.terminal.acceptedEventKinds.includes(eventKind)) {
    throw new CliParserAllowlistError(`Unrecorded parser event kind: ${eventKind}`);
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

export async function digestExecutableRealPath(executablePath: string): Promise<string> {
  const resolved = await realpath(executablePath);
  return sha256CanonicalJsonSync({ realPath: resolved });
}

export async function hashExecutableFileSha256(executablePath: string): Promise<string> {
  const bytes = await readFile(executablePath);
  return createHash("sha256").update(bytes).digest("hex");
}
