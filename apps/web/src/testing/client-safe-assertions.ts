import { LEGACY_V1_HAS_API_KEY_PROPERTY } from "@diffgazer/core/schemas/config";

const FORBIDDEN_KEY_PATTERN =
  /^(?:apikey|accesstoken|auth|authtoken|authorization|bearer|bearertoken|clientsecret|credential|credentials|hasapikey|password|passwd|privatekey|secret|secretkey|token|literalsecret|environmentname|environmentvalue|localbearertoken|accountsecretid|workspacesecretid|authpath|executablepath|argv|rawevidence|accountid|workspaceid|organizationid|tenantid|subscriptionid)$/i;

const FORBIDDEN_VALUE_PATTERN =
  /\b(?:sk|pk|rk|ghp|github_pat|AIza|ya29|xox[baprs]-)[A-Za-z0-9._~+/-]{8,}\b|-----BEGIN [A-Z ]+PRIVATE KEY-----/i;

const FORBIDDEN_SERIALIZED_PATTERN = new RegExp(
  `\\b${LEGACY_V1_HAS_API_KEY_PROPERTY}\\b|\\bproviderStatus\\b|"secret"\\s*:|provider-status`,
  "i",
);

function normalizeKey(key: string): string {
  return key.replace(/[^a-z0-9]/gi, "").toLowerCase();
}

function collectViolations(value: unknown, path: string, violations: string[]): void {
  if (violations.length > 0) return;

  if (value === null || typeof value !== "object") {
    if (typeof value === "string" && FORBIDDEN_VALUE_PATTERN.test(value)) {
      violations.push(`${path}: forbidden secret-like value`);
    }
    return;
  }

  if (Array.isArray(value)) {
    for (const [index, entry] of value.entries()) {
      collectViolations(entry, `${path}[${index}]`, violations);
    }
    return;
  }

  for (const [key, entry] of Object.entries(value)) {
    const nextPath = path ? `${path}.${key}` : key;
    if (FORBIDDEN_KEY_PATTERN.test(normalizeKey(key))) {
      violations.push(`${nextPath}: forbidden key`);
      continue;
    }
    collectViolations(entry, nextPath, violations);
  }
}

export function assertClientSafePayload(payload: unknown, label = "payload"): void {
  const serialized = JSON.stringify(payload);
  if (FORBIDDEN_SERIALIZED_PATTERN.test(serialized)) {
    throw new Error(`${label} serialized forbidden provider-transport field`);
  }

  const violations: string[] = [];
  collectViolations(payload, label, violations);
  if (violations.length > 0) {
    throw new Error(violations.join("; "));
  }
}

export function assertClientSafeDom(html: string, label = "dom"): void {
  if (FORBIDDEN_SERIALIZED_PATTERN.test(html)) {
    throw new Error(`${label} contains forbidden provider-transport field`);
  }
  if (FORBIDDEN_VALUE_PATTERN.test(html)) {
    throw new Error(`${label} contains secret-like value`);
  }
  if (/\bapi\s*key\b/i.test(html) && /<input/i.test(html)) {
    throw new Error(`${label} exposes a credential input`);
  }
}
