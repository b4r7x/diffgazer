import { randomUUID } from "node:crypto";
import {
  REDACTED,
  type RedactionRule,
  redactSecrets,
  truncateUtf8,
  utf8ByteLength,
} from "@diffgazer/core/redaction";
import { sanitizeTerminalText } from "@diffgazer/core/sanitize-terminal";

export { REDACTED, truncateUtf8, utf8ByteLength };

export const SAFE_MESSAGE_MAX_BYTES = 512;
export const REMEDIATION_MAX_BYTES = 512;
export const CODE_MAX_BYTES = 128;
export const DETAIL_MAX_BYTES = 1024;
export const AGGREGATE_DETAILS_MAX_BYTES = 4096;
export const CAPTURE_MAX_BYTES = 64 * 1024;

/**
 * Diagnostic code for a provider that refused the request outright — a
 * rejected credential, exhausted billing, an unknown model, or a rate limit.
 * The review reports it as `PROVIDER_REJECTED` so the surfaces can send the
 * user to the providers screen instead of a generic transport failure.
 */
export const PROVIDER_REJECTED_DIAGNOSTIC_CODE = "provider-rejected";

/**
 * Diagnostic code for malformed review content that survived the corrective
 * retry — the re-ask replayed the failed answer, named what was wrong, and the
 * model still could not conform. That is the only class that proves tuple
 * incapacity, so it is the only one that arms the fail-fast memo. Malformed
 * content the corrective retry never faced keeps the plain
 * `malformed-review-output` code.
 */
export const MALFORMED_AFTER_CORRECTION_DIAGNOSTIC_CODE =
  "malformed-review-output-after-correction";

/**
 * Diagnostic code for a partial salvage: the answer was incomplete, but the
 * findings that parsed were kept. The dispatch still completes — the code
 * qualifies it instead of failing it.
 */
export const OUTPUT_SALVAGED_DIAGNOSTIC_CODE = "output-salvaged";

const CLI_ACCOUNT_ID_PATTERN = /\b(?:acct_[A-Za-z0-9_-]{6,}|account[-_][A-Za-z0-9_-]{6,})\b/gi;
const PROMPT_PATTERN =
  /\b(?:prompt|user[-_ ]?message|system[-_ ]?prompt)\s*[:=]\s*["'`]?[^\n"'`]{1,}/gi;
const ARGV_EXECUTABLE_PATTERN =
  /\b(?:node|python(?:\d*)?|bash|sh)\s+(?:exec\s+)?(?:(?:--[^\s]+(?:\s+[^\s]+)*)|(?:-[a-zA-Z]\s+\S+))/gi;
const REPO_DIFF_PATTERN = /\bdiff --git\b[^\n]*(?:\n[^\n]*){0,8}/gi;

/**
 * Subprocess-only shapes layered on the shared `@diffgazer/core/redaction`
 * battery: the CLI adapters are the only surface that sees argv, prompts, and
 * repository diffs.
 */
const CLI_DIAGNOSTIC_RULES: readonly RedactionRule[] = [
  { pattern: CLI_ACCOUNT_ID_PATTERN },
  { pattern: PROMPT_PATTERN },
  { pattern: ARGV_EXECUTABLE_PATTERN },
  { pattern: REPO_DIFF_PATTERN },
];

export type BoundedDiagnostic = Readonly<{
  code: string;
  safeMessage: string;
  retryable: boolean;
  remediation: string;
  correlationId: string;
  truncatedDetails?: string;
  /**
   * Carried only by code "output-salvaged": what survived vs. what was dropped.
   * Both counts travel together so a salvage can never be reported half-counted.
   */
  salvage?: Readonly<{ keptFindingCount: number; droppedCandidateCount: number }>;
}>;

export type DiagnosticSensitiveContext = Readonly<{
  literalSecrets?: readonly string[];
  accountIdentifiers?: readonly string[];
}>;

type DiagnosticCaptureChannel = "stdout" | "stderr" | "response";

export type DiagnosticCapture = Readonly<{
  channel: DiagnosticCaptureChannel;
  text: string;
}>;

export type DiagnosticDetail = Readonly<{
  label: string;
  text: string;
}>;

export type FailureDiagnosticInput = Readonly<{
  code: string;
  message: string;
  retryable?: boolean;
  remediation?: string;
  correlationId?: string;
  details?: readonly DiagnosticDetail[];
  capture?: DiagnosticCapture;
  sensitive?: DiagnosticSensitiveContext;
}>;

function normalizeDiagnosticText(value: string): string {
  return sanitizeTerminalText(value)
    .replace(/[ \t\n\r]+/g, " ")
    .trim();
}

/** Redacts configured literals and known secret/token/account/path/argv/prompt patterns. */
function redactDiagnosticText(value: string, sensitive?: DiagnosticSensitiveContext): string {
  const literals = [...(sensitive?.literalSecrets ?? []), ...(sensitive?.accountIdentifiers ?? [])];
  return redactSecrets(value, literals, CLI_DIAGNOSTIC_RULES);
}

export function boundDiagnosticText(
  value: string,
  maxBytes: number,
  sensitive?: DiagnosticSensitiveContext,
): string {
  const normalized = normalizeDiagnosticText(redactDiagnosticText(value, sensitive));
  if (normalized.length === 0) return "";
  return truncateUtf8(normalized, maxBytes);
}

export function createCorrelationId(): string {
  return `diag-${randomUUID()}`;
}

function assembleTruncatedDetails(
  details: readonly DiagnosticDetail[] | undefined,
  capture: DiagnosticCapture | undefined,
  sensitive?: DiagnosticSensitiveContext,
): string | undefined {
  const lines: string[] = [];

  if (capture) {
    const captureText = boundDiagnosticText(capture.text, CAPTURE_MAX_BYTES, sensitive);
    if (captureText.length > 0) {
      lines.push(
        boundDiagnosticText(`${capture.channel}: ${captureText}`, DETAIL_MAX_BYTES, sensitive),
      );
    }
  }

  for (const detail of details ?? []) {
    const label = boundDiagnosticText(detail.label, CODE_MAX_BYTES, sensitive);
    const text = boundDiagnosticText(detail.text, DETAIL_MAX_BYTES, sensitive);
    if (label.length === 0 && text.length === 0) continue;
    lines.push(boundDiagnosticText(`${label}: ${text}`, DETAIL_MAX_BYTES, sensitive));
  }

  if (lines.length === 0) return undefined;

  let aggregate = "";
  for (const line of lines) {
    const separator = aggregate.length === 0 ? "" : " | ";
    const candidate = aggregate.length === 0 ? line : `${aggregate}${separator}${line}`;
    if (utf8ByteLength(candidate) <= AGGREGATE_DETAILS_MAX_BYTES) {
      aggregate = candidate;
      continue;
    }
    const remaining = AGGREGATE_DETAILS_MAX_BYTES - utf8ByteLength(aggregate);
    if (remaining <= utf8ByteLength(separator)) break;
    const partial = truncateUtf8(line, remaining - utf8ByteLength(separator));
    aggregate = aggregate.length === 0 ? partial : `${aggregate}${separator}${partial}`;
    break;
  }

  return aggregate.length === 0 ? undefined : aggregate;
}

function serializeBoundedDiagnostic(input: {
  code: string;
  message: string;
  retryable: boolean;
  remediation: string;
  correlationId: string;
  details?: readonly DiagnosticDetail[];
  capture?: DiagnosticCapture;
  sensitive?: DiagnosticSensitiveContext;
  includeTruncatedDetails: boolean;
}): BoundedDiagnostic {
  const code = boundDiagnosticText(input.code, CODE_MAX_BYTES, input.sensitive);
  const safeMessage = boundDiagnosticText(input.message, SAFE_MESSAGE_MAX_BYTES, input.sensitive);
  const remediation = boundDiagnosticText(
    input.remediation,
    REMEDIATION_MAX_BYTES,
    input.sensitive,
  );
  const truncatedDetails = input.includeTruncatedDetails
    ? assembleTruncatedDetails(input.details, input.capture, input.sensitive)
    : undefined;

  return {
    code,
    safeMessage,
    retryable: input.retryable,
    remediation,
    correlationId: input.correlationId,
    ...(truncatedDetails === undefined ? {} : { truncatedDetails }),
  };
}

export function serializeSuccessDiagnostic(
  input: Readonly<{
    code?: string;
    message?: string;
    correlationId?: string;
    sensitive?: DiagnosticSensitiveContext;
  }> = {},
): BoundedDiagnostic {
  return serializeBoundedDiagnostic({
    code: input.code ?? "completed",
    message: input.message ?? "Execution completed successfully.",
    retryable: false,
    remediation: "none",
    correlationId: input.correlationId ?? createCorrelationId(),
    sensitive: input.sensitive,
    includeTruncatedDetails: false,
  });
}

export function serializeFailureDiagnostic(input: FailureDiagnosticInput): BoundedDiagnostic {
  return serializeBoundedDiagnostic({
    code: input.code,
    message: input.message,
    retryable: input.retryable ?? false,
    remediation: input.remediation ?? "Review the error and try again.",
    correlationId: input.correlationId ?? createCorrelationId(),
    details: input.details,
    capture: input.capture,
    sensitive: input.sensitive,
    includeTruncatedDetails: true,
  });
}

export function serializeCancelDiagnostic(
  input: Readonly<{
    message?: string;
    correlationId?: string;
    sensitive?: DiagnosticSensitiveContext;
    details?: readonly DiagnosticDetail[];
    capture?: DiagnosticCapture;
  }> = {},
): BoundedDiagnostic {
  return serializeBoundedDiagnostic({
    code: "cancelled",
    message: input.message ?? "Execution was cancelled.",
    retryable: false,
    remediation: "Retry the review if cancellation was accidental.",
    correlationId: input.correlationId ?? createCorrelationId(),
    details: input.details,
    capture: input.capture,
    sensitive: input.sensitive,
    includeTruncatedDetails: input.details !== undefined || input.capture !== undefined,
  });
}
