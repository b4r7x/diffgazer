import { REDACTED, redactSecrets, truncateUtf8 } from "../redaction.js";
import { sanitizeTerminalText } from "../review/sanitize-terminal.js";
import type { WizardData } from "./draft-equality.js";

const CLIENT_ERROR_MAX_BYTES = 512;

const PATH_BOUNDARY = String.raw`(^|[\s("'=<{[,:;])`;
const PATH_CHARACTER = "[^\\\\/\\s\"'`<>{},;)]|[ \\t](?=[^\\\\/\\s\"'`<>{},;)])";

const UNIX_PATH_PATTERN = new RegExp(
  `${PATH_BOUNDARY}((?:~|\\/(?:Users|home|private\\/var\\/folders|var\\/folders|tmp|usr|bin|srv|opt|etc))(?:\\/[^\\s"'\`<>{},;)]*)*)`,
  "gi",
);
const WINDOWS_PATH_PATTERN = new RegExp(
  `${PATH_BOUNDARY}([A-Za-z]:[\\\\/](?:${PATH_CHARACTER})+(?:[\\\\/](?:${PATH_CHARACTER})+)*)`,
  "gi",
);
const UNC_PATH_PATTERN = new RegExp(
  `${PATH_BOUNDARY}(\\\\\\\\(?:${PATH_CHARACTER})+[\\\\/](?:${PATH_CHARACTER})+(?:[\\\\/](?:${PATH_CHARACTER})+)*)`,
  "gi",
);
const RELATIVE_PATH_PATTERN =
  /(^|[\s("'=<{[])((?:\.{1,2}[\\/]|(?:[A-Za-z0-9._-]+[\\/])+)[A-Za-z0-9._-]+(?:[\\/][A-Za-z0-9._-]+)*)/g;
const UNTRUSTED_PROVIDER_ERROR_PATTERN =
  /\b(?:provider|upstream|model|endpoint|network|http|https|request|response|redirect|authorization|credential|token|secret|api[-_ ]?key|bearer|cookie|quota|rate[-_ ]?limit|timeout|timed? ?out|abort(?:ed)?|cancel(?:led)?|subprocess|command|exec(?:utable)?|stdout|stderr|parser|parse|json|schema|transport|dns|socket|econn|status\s*(?:code)?|cli)\b/i;

function redactPathMatch(_match: string, prefix: string, path: string): string {
  const trailingPunctuation = path.match(/[.!?]+$/)?.[0] ?? "";
  return `${prefix}${REDACTED}${trailingPunctuation}`;
}

function redactPaths(value: string): string {
  return value
    .replace(UNIX_PATH_PATTERN, redactPathMatch)
    .replace(WINDOWS_PATH_PATTERN, redactPathMatch)
    .replace(UNC_PATH_PATTERN, redactPathMatch)
    .replace(RELATIVE_PATH_PATTERN, redactPathMatch);
}

function redactClientError(value: string, sensitiveValues: readonly string[]): string {
  // The wizard renders these strings verbatim, so it redacts relative and UNC
  // paths on top of the shared battery's absolute/labeled path rules.
  const redacted = redactPaths(redactSecrets(value, sensitiveValues)).replace(/\n/g, " ");

  return sanitizeTerminalText(redacted)
    .replace(/[ \t\n]+/g, " ")
    .trim();
}

function getWizardSensitiveValues(data: WizardData | undefined): readonly string[] {
  if (!data || data.kind !== "runnable") return [];

  const values: string[] = [];
  const input = data.configurationInput;
  if (input.transportFamily === "hosted-api") {
    if (input.credential?.kind === "literal") values.push(input.credential.value);
    if (input.workspace) values.push(input.workspace);
  }
  if (input.transportFamily === "local-http" && input.bearerToken?.kind === "literal") {
    values.push(input.bearerToken.value);
  }
  return values;
}

export function getClientSafeError(cause: unknown, fallback: string, data?: WizardData): string {
  if (!(cause instanceof Error) || cause.message.trim().length === 0) return fallback;

  const rawMessage = cause.message;
  // Provider, CLI, subprocess, and transport errors are not an API for the
  // client. Their details are useful to server diagnostics, but never safe to
  // echo into the wizard, even after redaction. Keep the user-facing copy
  // actionable without exposing an unknown parser/adapter envelope.
  if (UNTRUSTED_PROVIDER_ERROR_PATTERN.test(rawMessage)) return fallback;

  const redacted = redactClientError(rawMessage, getWizardSensitiveValues(data));
  if (redacted.length === 0) return fallback;
  return truncateUtf8(redacted, CLIENT_ERROR_MAX_BYTES);
}
