/**
 * The single owner of secret redaction and UTF-8 byte bounds.
 *
 * Every surface that renders provider, server, or subprocess text — the API
 * client, the onboarding wizard, and the server diagnostics serializer —
 * redacts through this battery. Independent copies had already drifted (a
 * bearer token redacted by one surface leaked through another), so the
 * patterns live here once and each surface only appends the rules it owns.
 *
 * This is a leaf utility: it is generic and must not import schema, review, or
 * provider modules.
 */

export const REDACTED = "[REDACTED]";

export function utf8ByteLength(value: string): number {
  return new TextEncoder().encode(value).byteLength;
}

/** Trims to a byte budget without splitting a multi-byte character. */
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

export function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const PRIVATE_KEY_PATTERN =
  /-----BEGIN [A-Z ]+PRIVATE KEY-----[\s\S]*?-----END [A-Z ]+PRIVATE KEY-----/gi;
const AUTH_HEADER_PATTERN =
  /\b(?:authorization|proxy-authorization)\s*[:=]\s*(?:(?:bearer|basic)\s+)?[^\s,;]+/gi;
const COOKIE_HEADER_PATTERN = /\b(?:cookie|set-cookie)\s*[:=]\s*[^\n]*/gi;
const BEARER_PATTERN = /\b(?:bearer|basic)\s+[^\s,;]+/gi;
const SECRET_ASSIGNMENT_PATTERN =
  /\b(?:api(?:[-_ ]?key)|access[-_ ]?token|auth(?:orization)?|credential|password|passwd|secret|token|private[-_ ]?key|client[-_ ]?secret)\b\s*(?:[:=]|\bis\s*)\s*["'`]?[^\s"'`,;)}\]]+/gi;
const SECRET_FLAG_PATTERN =
  /--?(?:api(?:[-_ ]?key)|auth(?:orization)?|bearer|cookie|credential|password|secret|token)\s+(?:["'`][^"'`]+["'`]|[^\s]+)/gi;
const ENV_SECRET_PATTERN =
  /\b[A-Z][A-Z0-9]*(?:[_-](?:API[_-]?KEY|TOKEN|SECRET|PASSWORD|CREDENTIAL|AUTH(?:ORIZATION)?|COOKIE))\b\s*=\s*[^\s,;]+/g;
// The prefixed key families all carry their own separator (`sk-…`, `ghp_…`), so
// requiring it here keeps ordinary words like "pkg-config" or "skipping-checks"
// out of the match without losing a documented key shape.
const TOKEN_PATTERN =
  /\b(?:(?:sk|pk|rk)-|ghp_|github_pat_|AIza|ya29|xox[baprs]-)[A-Za-z0-9._~+\x2f-]{8,}=*/gi;
const ACCOUNT_ASSIGNMENT_PATTERN =
  /\b(?:account(?:[-_ ]?id)?|workspace(?:[-_ ]?id)?|organization(?:[-_ ]?id)?|org(?:[-_ ]?id)?|tenant(?:[-_ ]?id)?|project(?:[-_ ]?id)?|subscription(?:[-_ ]?id)?)\b\s*(?:[:=]|\bis\s*)\s*["'`]?[^\s"'`,;)}\]]+/gi;
const ACCOUNT_IDENTIFIER_PATTERN =
  /\b(?:acct|account|workspace|organization|org|tenant|project|subscription)[._-][A-Za-z0-9._-]{4,}\b/gi;

const CREDENTIAL_PATTERNS: readonly RegExp[] = [
  PRIVATE_KEY_PATTERN,
  COOKIE_HEADER_PATTERN,
  AUTH_HEADER_PATTERN,
  BEARER_PATTERN,
  SECRET_ASSIGNMENT_PATTERN,
  SECRET_FLAG_PATTERN,
  ENV_SECRET_PATTERN,
  TOKEN_PATTERN,
  ACCOUNT_ASSIGNMENT_PATTERN,
  ACCOUNT_IDENTIFIER_PATTERN,
];

// A labeled path takes the rest of the line: path values contain spaces, and
// the label already proves the remainder is filesystem detail.
const LABELED_PATH_PATTERN =
  /\b(?:auth(?:entication)?[-_ ]?path|executable(?:[-_ ]?path)?|path|file)\s*[:=]\s*["'`]?[^\n]*/gi;
const ABSOLUTE_PATH_PATTERN =
  /(^|[\s("'=:\u00a0])((?:~|\/(?:Users|home|private\/var|var\/folders|tmp|opt|etc|usr|bin|sbin|srv|run|root)(?:\/|$)|[A-Za-z]:[\\/](?:Users|home|AppData|ProgramData|Program Files|Windows)(?:[\\/]|$))[^\s"'`<>{},;)]*)/gi;

/** A surface-owned pattern appended to the shared battery. */
export type RedactionRule = Readonly<{
  pattern: RegExp;
  /** Defaults to the bare marker; set it to keep a capture group. */
  replacement?: string;
}>;

function replaceSensitiveValues(text: string, sensitiveValues: readonly string[]): string {
  // Longest first so a value containing another is redacted whole, and before
  // any pattern or byte bound can leave a partial credential behind.
  const literals = sensitiveValues
    .filter((value) => value.length > 0)
    .sort((a, b) => b.length - a.length);

  let redacted = text;
  for (const literal of literals) {
    redacted = redacted.replace(new RegExp(escapeRegExp(literal), "g"), REDACTED);
  }
  return redacted;
}

/**
 * Redacts configured literal values, then the shared credential/account
 * battery, then any surface-specific rules, and finally filesystem paths.
 */
export function redactSecrets(
  text: string,
  sensitiveValues: readonly string[],
  extraPatterns: readonly RedactionRule[] = [],
): string {
  let redacted = replaceSensitiveValues(text, sensitiveValues);
  for (const pattern of CREDENTIAL_PATTERNS) {
    redacted = redacted.replace(pattern, REDACTED);
  }
  for (const rule of extraPatterns) {
    redacted = redacted.replace(rule.pattern, rule.replacement ?? REDACTED);
  }
  return redacted
    .replace(LABELED_PATH_PATTERN, REDACTED)
    .replace(ABSOLUTE_PATH_PATTERN, `$1${REDACTED}`);
}
