import { randomUUID } from "node:crypto";
import { sanitizeTerminalText } from "@diffgazer/core/review";

export const SAFE_MESSAGE_MAX_BYTES = 512;
export const REMEDIATION_MAX_BYTES = 512;
export const CODE_MAX_BYTES = 128;
export const DETAIL_MAX_BYTES = 1024;
export const AGGREGATE_DETAILS_MAX_BYTES = 4096;
export const CAPTURE_MAX_BYTES = 64 * 1024;

export const REDACTED = "[REDACTED]";

const ABSOLUTE_PATH_PATTERN =
  /(^|[\s("'=:\u00a0])((?:~|\/(?:Users|home|private\/var|var\/folders|tmp|opt|etc|usr|bin|sbin|srv|run|root)(?:\/|$)|[A-Za-z]:[\\/](?:Users|home|AppData|ProgramData|Program Files|Windows)(?:[\\/]|$))[^\s"'`<>{},;)]*)/gi;
const LABELED_PATH_PATTERN =
  /\b(?:auth(?:entication)?[-_ ]?path|executable(?:[-_ ]?path)?|path|file)\s*[:=]\s*["'`]?[^\n]*/gi;
const AUTH_HEADER_PATTERN =
  /\b(?:authorization|proxy-authorization|cookie|set-cookie)\s*[:=]\s*(?:(?:bearer|basic)\s+)?[^\s,;]+/gi;
const BEARER_PATTERN = /\b(?:bearer|basic)\s+[^\s,;]+/gi;
const SECRET_ASSIGNMENT_PATTERN =
  /\b(?:api(?:[-_ ]?key)|access[-_ ]?token|auth(?:orization)?|credential|password|passwd|secret|token|private[-_ ]?key|client[-_ ]?secret)\b\s*(?:[:=]|\bis\s*)\s*["'`]?[^\s"'`,;)}\]]+/gi;
const SECRET_FLAG_PATTERN =
  /--?(?:api(?:[-_ ]?key)|auth(?:orization)?|bearer|cookie|credential|password|secret|token)\s+(?:["'`][^"'`]+["'`]|[^\s]+)/gi;
const ENV_SECRET_PATTERN =
  /\b[A-Z][A-Z0-9]*(?:[_-](?:API[_-]?KEY|TOKEN|SECRET|PASSWORD|CREDENTIAL|AUTH(?:ORIZATION)?|COOKIE))\b\s*=\s*[^\s,;]+/g;
const TOKEN_PATTERN =
  /\b(?:sk|pk|rk|ghp|github_pat|AIza|ya29|xox[baprs]-)[A-Za-z0-9._~+\x2f-]{8,}=*/gi;
const PRIVATE_KEY_PATTERN =
  /-----BEGIN [A-Z ]+PRIVATE KEY-----[\s\S]*?-----END [A-Z ]+PRIVATE KEY-----/gi;
const ACCOUNT_ASSIGNMENT_PATTERN =
  /\b(?:account(?:[-_ ]?id)?|workspace(?:[-_ ]?id)?|organization(?:[-_ ]?id)?|org(?:[-_ ]?id)?|tenant(?:[-_ ]?id)?|project(?:[-_ ]?id)?|subscription(?:[-_ ]?id)?)\b\s*(?:[:=]|\bis\s*)\s*["'`]?[^\s"'`,;)}\]]+/gi;
const ACCOUNT_IDENTIFIER_PATTERN =
  /\b(?:acct|account|workspace|organization|org|tenant|project|subscription)[._-][A-Za-z0-9._-]{4,}\b/gi;
const CLI_ACCOUNT_ID_PATTERN = /\b(?:acct_[A-Za-z0-9_-]{6,}|account[-_][A-Za-z0-9_-]{6,})\b/gi;
const PROMPT_PATTERN =
  /\b(?:prompt|user[-_ ]?message|system[-_ ]?prompt)\s*[:=]\s*["'`]?[^\n"'`]{1,}/gi;
const ARGV_EXECUTABLE_PATTERN =
  /\b(?:codex|copilot|node|python(?:\d*)?|bash|sh)\s+(?:exec\s+)?(?:(?:--[^\s]+(?:\s+[^\s]+)*)|(?:-[a-zA-Z]\s+\S+))/gi;
const CLI_SHORT_FLAG_SECRET_PATTERN = /\b(?:codex|copilot)\s+(?:exec\s+)?-[a-zA-Z]\s+\S+/gi;
const REPO_DIFF_PATTERN = /\bdiff --git\b[^\n]*(?:\n[^\n]*){0,8}/gi;

export type BoundedDiagnostic = Readonly<{
  code: string;
  safeMessage: string;
  retryable: boolean;
  remediation: string;
  correlationId: string;
  truncatedDetails?: string;
}>;

export type DiagnosticSensitiveContext = Readonly<{
  literalSecrets?: readonly string[];
  workspaceAccountReferences?: readonly string[];
  accountIdentifiers?: readonly string[];
}>;

export type DiagnosticCaptureChannel = "stdout" | "stderr" | "response";

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

export function utf8ByteLength(value: string): number {
  return new TextEncoder().encode(value).byteLength;
}

export function truncateUtf8(value: string, maxBytes: number): string {
  if (utf8ByteLength(value) <= maxBytes) return value;

  let output = "";
  let bytes = 0;
  for (const character of value) {
    const characterBytes = utf8ByteLength(character);
    if (bytes + characterBytes > maxBytes) break;
    output += character;
    bytes += characterBytes;
  }
  return output;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function normalizeDiagnosticText(value: string): string {
  return sanitizeTerminalText(value)
    .replace(/[ \t\n\r]+/g, " ")
    .trim();
}

function replaceLiteralSecrets(value: string, sensitive?: DiagnosticSensitiveContext): string {
  const literals = [
    ...(sensitive?.literalSecrets ?? []),
    ...(sensitive?.workspaceAccountReferences ?? []),
    ...(sensitive?.accountIdentifiers ?? []),
  ]
    .filter((entry) => entry.length > 0)
    .sort((a, b) => b.length - a.length);

  let redacted = value;
  for (const literal of literals) {
    redacted = redacted.replace(new RegExp(escapeRegExp(literal), "g"), REDACTED);
  }
  return redacted;
}

/** Redacts configured literals and known secret/token/account/path/argv/prompt patterns. */
export function redactDiagnosticText(
  value: string,
  sensitive?: DiagnosticSensitiveContext,
): string {
  return replaceLiteralSecrets(value, sensitive)
    .replace(PRIVATE_KEY_PATTERN, REDACTED)
    .replace(AUTH_HEADER_PATTERN, REDACTED)
    .replace(BEARER_PATTERN, REDACTED)
    .replace(SECRET_ASSIGNMENT_PATTERN, REDACTED)
    .replace(SECRET_FLAG_PATTERN, REDACTED)
    .replace(ENV_SECRET_PATTERN, REDACTED)
    .replace(TOKEN_PATTERN, REDACTED)
    .replace(ACCOUNT_ASSIGNMENT_PATTERN, REDACTED)
    .replace(ACCOUNT_IDENTIFIER_PATTERN, REDACTED)
    .replace(CLI_ACCOUNT_ID_PATTERN, REDACTED)
    .replace(LABELED_PATH_PATTERN, REDACTED)
    .replace(PROMPT_PATTERN, REDACTED)
    .replace(ARGV_EXECUTABLE_PATTERN, REDACTED)
    .replace(CLI_SHORT_FLAG_SECRET_PATTERN, REDACTED)
    .replace(REPO_DIFF_PATTERN, REDACTED)
    .replace(ABSOLUTE_PATH_PATTERN, `$1${REDACTED}`);
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

export function boundCaptureText(value: string, sensitive?: DiagnosticSensitiveContext): string {
  return boundDiagnosticText(value, CAPTURE_MAX_BYTES, sensitive);
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
    const captureText = boundCaptureText(capture.text, sensitive);
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

export function serializeDebugDiagnostic(input: FailureDiagnosticInput): BoundedDiagnostic {
  return serializeBoundedDiagnostic({
    code: input.code,
    message: input.message,
    retryable: input.retryable ?? false,
    remediation: input.remediation ?? "Inspect server diagnostics.",
    correlationId: input.correlationId ?? createCorrelationId(),
    details: input.details,
    capture: input.capture,
    sensitive: input.sensitive,
    includeTruncatedDetails: true,
  });
}
