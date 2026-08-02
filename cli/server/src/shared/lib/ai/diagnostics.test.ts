import { describe, expect, it } from "vitest";
import {
  AGGREGATE_DETAILS_MAX_BYTES,
  boundCaptureText,
  CAPTURE_MAX_BYTES,
  CODE_MAX_BYTES,
  createCorrelationId,
  DETAIL_MAX_BYTES,
  REDACTED,
  REMEDIATION_MAX_BYTES,
  SAFE_MESSAGE_MAX_BYTES,
  serializeCancelDiagnostic,
  serializeDebugDiagnostic,
  serializeFailureDiagnostic,
  serializeSuccessDiagnostic,
  truncateUtf8,
  utf8ByteLength,
} from "./diagnostics.js";

function repeatToBytes(unit: string, targetBytes: number): string {
  let value = "";
  while (utf8ByteLength(value) < targetBytes) value += unit;
  return truncateUtf8(value, targetBytes);
}

function expectNoSensitiveLeak(
  diagnostic: { safeMessage: string; truncatedDetails?: string },
  secret: string,
) {
  expect(diagnostic.safeMessage).not.toContain(secret);
  if (diagnostic.truncatedDetails !== undefined) {
    expect(diagnostic.truncatedDetails).not.toContain(secret);
  }
}

describe("byte-bound: code truncates at exactly 128 UTF-8 bytes", () => {
  it("caps code at exactly 128 bytes including multibyte characters", () => {
    const padding = repeatToBytes("é", CODE_MAX_BYTES - 1);
    const diagnostic = serializeFailureDiagnostic({
      code: `${padding}overflow`,
      message: "failure",
    });
    expect(utf8ByteLength(diagnostic.code)).toBe(CODE_MAX_BYTES);
  });
});

describe("byte-bound: safeMessage truncates at exactly 512 UTF-8 bytes", () => {
  it("caps safeMessage at exactly 512 bytes including multibyte characters", () => {
    const padding = repeatToBytes("é", SAFE_MESSAGE_MAX_BYTES - 1);
    const diagnostic = serializeFailureDiagnostic({
      code: "transport-failed",
      message: `${padding}overflow`,
    });
    expect(utf8ByteLength(diagnostic.safeMessage)).toBe(SAFE_MESSAGE_MAX_BYTES);
  });
});

describe("byte-bound: remediation truncates at exactly 512 UTF-8 bytes", () => {
  it("caps remediation at exactly 512 bytes including multibyte characters", () => {
    const padding = repeatToBytes("é", REMEDIATION_MAX_BYTES - 1);
    const diagnostic = serializeFailureDiagnostic({
      code: "transport-failed",
      message: "failure",
      remediation: `${padding}overflow`,
    });
    expect(utf8ByteLength(diagnostic.remediation)).toBe(REMEDIATION_MAX_BYTES);
  });
});

describe("byte-bound: each detail truncates at exactly 1024 UTF-8 bytes", () => {
  it("caps each truncatedDetails line at exactly 1024 bytes", () => {
    const padding = repeatToBytes("é", DETAIL_MAX_BYTES - 1);
    const diagnostic = serializeFailureDiagnostic({
      code: "schema-failed",
      message: "parser failure",
      details: [{ label: "parser", text: `${padding}overflow` }],
    });
    const line = diagnostic.truncatedDetails ?? "";
    expect(utf8ByteLength(line)).toBe(DETAIL_MAX_BYTES);
  });
});

describe("byte-bound: truncatedDetails aggregates at exactly 4096 UTF-8 bytes", () => {
  it("caps truncatedDetails aggregate at exactly 4096 bytes across multiple lines", () => {
    const line = repeatToBytes("a", DETAIL_MAX_BYTES);
    const diagnostic = serializeFailureDiagnostic({
      code: "transport-failed",
      message: "overflow aggregate",
      details: Array.from({ length: 8 }, (_, index) => ({
        label: `line-${index}`,
        text: line,
      })),
    });
    expect(utf8ByteLength(diagnostic.truncatedDetails ?? "")).toBe(AGGREGATE_DETAILS_MAX_BYTES);
  });
});

describe("byte-bound: capture truncates at exactly 64 KiB UTF-8 bytes before parsing", () => {
  it("caps stdout/stderr/response capture at exactly 64 KiB", () => {
    const capture = repeatToBytes("x", CAPTURE_MAX_BYTES + 128);
    expect(utf8ByteLength(boundCaptureText(capture))).toBe(CAPTURE_MAX_BYTES);
  });
});

describe("redaction-before-truncation", () => {
  it("redacts secrets before truncation so partial credential bytes cannot survive the byte cap", () => {
    const secret = "sk-tail-redaction-secret-value-9a";
    const prefix = repeatToBytes("a", SAFE_MESSAGE_MAX_BYTES - 12);
    const diagnostic = serializeFailureDiagnostic({
      code: "transport-failed",
      message: `${prefix}${secret}`,
      sensitive: { literalSecrets: [secret] },
    });
    expectNoSensitiveLeak(diagnostic, secret);
    expect(diagnostic.safeMessage).not.toContain("sk-tail-redac");
    expect(diagnostic.safeMessage).toContain(REDACTED);
  });
});

describe("correlationId", () => {
  it("assigns a stable diag- prefix and preserves explicit correlation IDs", () => {
    const explicit = createCorrelationId();
    expect(explicit).toMatch(/^diag-[0-9a-f-]{36}$/);
    const diagnostic = serializeSuccessDiagnostic({ correlationId: explicit });
    expect(diagnostic.correlationId).toBe(explicit);
  });
});

describe("serializeSuccessDiagnostic", () => {
  it("returns a bounded terminal shape without truncatedDetails", () => {
    const diagnostic = serializeSuccessDiagnostic();
    expect(diagnostic).toMatchObject({
      code: "completed",
      retryable: false,
      remediation: "none",
    });
    expect(diagnostic.truncatedDetails).toBeUndefined();
    expect(diagnostic.correlationId).toMatch(/^diag-/);
  });
});

describe("serializeCancelDiagnostic", () => {
  it("returns a bounded cancelled shape with optional capture details", () => {
    const diagnostic = serializeCancelDiagnostic({
      capture: { channel: "stderr", text: "abort signalled" },
    });
    expect(diagnostic.code).toBe("cancelled");
    expect(diagnostic.retryable).toBe(false);
    expect(diagnostic.truncatedDetails).toContain("stderr:");
  });
});

describe("serializeDebugDiagnostic", () => {
  it("includes truncatedDetails for server-only inspection", () => {
    const diagnostic = serializeDebugDiagnostic({
      code: "debug",
      message: "adapter trace",
      details: [{ label: "attempt", text: "retry scheduled" }],
    });
    expect(diagnostic.truncatedDetails).toContain("attempt:");
  });
});

const REDACTION_CASES = [
  {
    category: "secret",
    secret: "configured-secret-9a",
    stdout: "api_key=configured-secret-9a",
    stderr: "secret is configured-secret-9a",
    network: "credential: configured-secret-9a",
    parser: "client_secret=configured-secret-9a",
    sensitive: { literalSecrets: ["configured-secret-9a"] },
  },
  {
    category: "token",
    secret: "sk-live-token-redaction-9a",
    stdout: "authorization: Bearer sk-live-token-redaction-9a",
    stderr: "token sk-live-token-redaction-9a rejected",
    network: "Bearer sk-live-token-redaction-9a",
    parser: "access_token=sk-live-token-redaction-9a",
    sensitive: { literalSecrets: ["sk-live-token-redaction-9a"] },
  },
  {
    category: "account",
    secret: "acct_cli_account_redact_9a",
    stdout: "account_id=acct_cli_account_redact_9a",
    stderr: "acct_cli_account_redact_9a denied",
    network: "account: acct_cli_account_redact_9a",
    parser: "organization_id acct_cli_account_redact_9a",
    sensitive: { accountIdentifiers: ["acct_cli_account_redact_9a"] },
  },
  {
    category: "workspace",
    secret: "workspace-ref-redact-9a",
    stdout: "workspace_id=workspace-ref-redact-9a",
    stderr: "workspace.workspace-ref-redact-9a missing",
    network: "workspace: workspace-ref-redact-9a",
    parser: "tenant_id workspace-ref-redact-9a",
    sensitive: { workspaceAccountReferences: ["workspace-ref-redact-9a"] },
  },
  {
    category: "home",
    secret: "/Users/alice/private/diffgazer/auth.json",
    stdout: `auth path=/Users/alice/private/diffgazer/auth.json`,
    stderr: `unable to open /home/alice/.config/vendor/state`,
    network: `file=/Users/alice/private/diffgazer/auth.json`,
    parser: `path: ~/Library/Application Support/vendor/auth`,
    sensitive: undefined,
  },
  {
    category: "argv",
    secret: "argv-flag-secret-9a",
    stdout: "codex exec --api-key argv-flag-secret-9a --model gpt-5",
    stderr: "copilot -p argv-flag-secret-9a --output-format=json",
    network: "--token argv-flag-secret-9a",
    parser: "--secret argv-flag-secret-9a",
    sensitive: undefined,
  },
  {
    category: "prompt",
    secret: "review prompt body must never leak",
    stdout: "prompt: review prompt body must never leak",
    stderr: "user_message=review prompt body must never leak",
    network: "system prompt: review prompt body must never leak",
    parser: "prompt=review prompt body must never leak",
    sensitive: { literalSecrets: ["review prompt body must never leak"] },
  },
] as const;

for (const redactionCase of REDACTION_CASES) {
  describe(`redaction: ${redactionCase.category} pattern`, () => {
    it("redacts stdout capture without leaking configured values", () => {
      const diagnostic = serializeFailureDiagnostic({
        code: "transport-failed",
        message: "stdout failure",
        capture: { channel: "stdout", text: redactionCase.stdout },
        sensitive: redactionCase.sensitive,
      });
      expectNoSensitiveLeak(diagnostic, redactionCase.secret);
      expect(diagnostic.truncatedDetails ?? "").toContain(REDACTED);
    });

    it("redacts stderr capture without leaking configured values", () => {
      const diagnostic = serializeFailureDiagnostic({
        code: "transport-failed",
        message: "stderr failure",
        capture: { channel: "stderr", text: redactionCase.stderr },
        sensitive: redactionCase.sensitive,
      });
      expectNoSensitiveLeak(diagnostic, redactionCase.secret);
      expect(diagnostic.truncatedDetails ?? "").toContain(REDACTED);
    });

    it("redacts network errors without leaking configured values", () => {
      const diagnostic = serializeFailureDiagnostic({
        code: "transport-failed",
        message: redactionCase.network,
        details: [{ label: "network", text: redactionCase.network }],
        sensitive: redactionCase.sensitive,
      });
      expectNoSensitiveLeak(diagnostic, redactionCase.secret);
      expect(diagnostic.truncatedDetails ?? "").toContain(REDACTED);
    });

    it("redacts parser errors without leaking configured values", () => {
      const diagnostic = serializeFailureDiagnostic({
        code: "schema-failed",
        message: "parser failure",
        details: [{ label: "parser", text: redactionCase.parser }],
        sensitive: redactionCase.sensitive,
      });
      expectNoSensitiveLeak(diagnostic, redactionCase.secret);
      expect(diagnostic.truncatedDetails ?? "").toContain(REDACTED);
    });
  });
}

describe("redaction: home path parser", () => {
  it("fully redacts labeled home paths with spaces through end of line", () => {
    const secret = "~/Library/Application Support/vendor/auth";
    const diagnostic = serializeFailureDiagnostic({
      code: "schema-failed",
      message: "parser failure",
      details: [{ label: "parser", text: `path: ${secret}` }],
    });
    expectNoSensitiveLeak(diagnostic, secret);
    expect(diagnostic.truncatedDetails ?? "").not.toContain("Support/vendor/auth");
    expect(diagnostic.truncatedDetails ?? "").toContain(REDACTED);
  });
});

describe("serializeFailureDiagnostic", () => {
  it("never returns raw provider output labels without redaction", () => {
    const secret = "ghp_provider_output_secret_9a";
    const diagnostic = serializeFailureDiagnostic({
      code: "transport-failed",
      message: "provider stdout contained ghp_provider_output_secret_9a",
      capture: {
        channel: "response",
        text: `provider stderr: bearer ${secret} diff --git a/secret.txt b/secret.txt`,
      },
      sensitive: { literalSecrets: [secret] },
    });
    expectNoSensitiveLeak(diagnostic, secret);
    expect(diagnostic.truncatedDetails ?? "").not.toContain("diff --git");
  });
});
