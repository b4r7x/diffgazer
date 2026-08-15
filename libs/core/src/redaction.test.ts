import { describe, expect, it } from "vitest";
import {
  escapeRegExp,
  REDACTED,
  redactSecrets,
  truncateUtf8,
  utf8ByteLength,
} from "./redaction.js";

describe("utf8ByteLength", () => {
  it.each([
    ["", 0],
    ["abc", 3],
    ["é", 2],
    ["日本語", 9],
    ["🙂", 4],
  ])("counts %j as %s bytes", (value, expected) => {
    expect(utf8ByteLength(value)).toBe(expected);
  });
});

describe("truncateUtf8", () => {
  it("returns the input untouched when it already fits the budget", () => {
    expect(truncateUtf8("日本語", 9)).toBe("日本語");
  });

  it("stops on a character boundary instead of splitting a multi-byte character", () => {
    const result = truncateUtf8("日本語", 4);

    expect(result).toBe("日");
    expect(utf8ByteLength(result)).toBeLessThanOrEqual(4);
    expect(result).not.toContain("�");
  });

  it("stops at the first character that does not fit", () => {
    expect(truncateUtf8("🙂ok", 3)).toBe("");
  });
});

describe("escapeRegExp", () => {
  it("makes a value match only itself when used as a pattern", () => {
    const escaped = escapeRegExp("sk-a.b+c");

    expect("token sk-a.b+c here".replace(new RegExp(escaped, "g"), REDACTED)).toBe(
      `token ${REDACTED} here`,
    );
    expect(new RegExp(escaped).test("sk-axbxc")).toBe(false);
  });
});

describe("redactSecrets", () => {
  it.each([
    ["comma-adjacent bearer token", "authorization failed for Bearer abc123, retry", "abc123"],
    ["short bearer token", "sent Bearer ab12 upstream", "ab12"],
    ["basic credential", "sent Basic dXNlcjpwYXNz upstream", "dXNlcjpwYXNz"],
    ["multi-cookie header", "Cookie: session=first-secret; csrf=second-secret", "second-secret"],
    [
      "multi-set-cookie header",
      "Set-Cookie: session=first-secret; Path=/; HttpOnly, csrf=second-secret",
      "second-secret",
    ],
    ["account identifier", "denied for acct_live_9a1b2c", "acct_live_9a1b2c"],
    ["account assignment", "request rejected: account_id=tenant-9a1b2c", "tenant-9a1b2c"],
    ["api key assignment", "config has api_key=live-9a1b2c", "live-9a1b2c"],
    ["environment secret", "read GEMINI_API_KEY=live-9a1b2c", "live-9a1b2c"],
    ["labeled path", "executable path: /opt/vendor/bin/tool", "/opt/vendor/bin/tool"],
    ["absolute path", "unable to open /Users/alice/.config/vendor", "/Users/alice/.config/vendor"],
  ])("redacts a %s", (_label, text, secret) => {
    const redacted = redactSecrets(text, []);

    expect(redacted).not.toContain(secret);
    expect(redacted).toContain(REDACTED);
  });

  it.each([
    ["hosted API key", "provider rejected sk-proj-A1b2C3d4E5f6", "sk-proj-A1b2C3d4E5f6"],
    ["GitHub token", "clone failed with ghp_A1b2C3d4E5f6G7h8", "ghp_A1b2C3d4E5f6G7h8"],
    ["Google API key", "denied AIzaSyA1b2C3d4E5f6", "AIzaSyA1b2C3d4E5f6"],
  ])("redacts a %s", (_label, text, secret) => {
    const redacted = redactSecrets(text, []);

    expect(redacted).not.toContain(secret);
    expect(redacted).toContain(REDACTED);
  });

  it.each([
    "Context build failed: pkg-config exited with code 1",
    "skipping-validation enabled for this run",
    "error in skywalker-theme.css",
  ])("keeps the diagnostic wording of %j", (text) => {
    expect(redactSecrets(text, [])).toBe(text);
  });

  it("redacts configured literal values that no pattern would recognize", () => {
    expect(redactSecrets("persisting opaque-value-9a1b", ["opaque-value-9a1b"])).toBe(
      `persisting ${REDACTED}`,
    );
  });

  it("redacts the longest configured value first so no fragment survives", () => {
    const redacted = redactSecrets("token abc-secret-tail", ["abc", "abc-secret-tail"]);

    expect(redacted).not.toContain("secret-tail");
    expect(redacted).toBe(`token ${REDACTED}`);
  });

  it("applies caller-owned rules on top of the shared battery", () => {
    const redacted = redactSecrets(
      "ran diff --git a/app.ts b/app.ts",
      [],
      [{ pattern: /\bdiff --git\b[^\n]*/gi }],
    );

    expect(redacted).toBe(`ran ${REDACTED}`);
  });

  it("leaves text without credentials, accounts, or paths untouched", () => {
    expect(redactSecrets("the review completed with 3 findings", [])).toBe(
      "the review completed with 3 findings",
    );
  });

  it("redacts every cookie pair in a diagnostic capture line", () => {
    const capture = "rate limit body Cookie: session=first-secret; csrf=second-secret";
    const redacted = redactSecrets(capture, []);

    expect(redacted).not.toContain("first-secret");
    expect(redacted).not.toContain("second-secret");
    expect(redacted).toContain(REDACTED);
  });

  it("redacts embedded private keys", () => {
    // Assembled at runtime, like the scanner's own token fixtures, so the PEM header
    // never appears literally in a tracked file and trips `pnpm run secret-scan`.
    const marker = "PRIVATE KEY";
    const secret = `-----BEGIN RSA ${marker}-----abc-secret-----END RSA ${marker}-----`;
    const redacted = redactSecrets(`provider stderr: ${secret}`, []);

    expect(redacted).not.toContain("abc-secret");
    expect(redacted).toContain(REDACTED);
  });
});
