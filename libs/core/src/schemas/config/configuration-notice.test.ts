import { describe, expect, it } from "vitest";
import { PRODUCT_REGISTRY } from "../../providers/product-registry.js";
import { ClientConfigurationNoticeSchema } from "./configuration-notice.js";

const notice = {
  ...PRODUCT_REGISTRY.zai.notice,
  billing: [...PRODUCT_REGISTRY.zai.notice.billing],
  privacy: [...PRODUCT_REGISTRY.zai.notice.privacy],
};

describe("client configuration notices", () => {
  it("preserves every canonical registry notice through the safe notice schema", () => {
    for (const product of Object.values(PRODUCT_REGISTRY)) {
      if (product.kind !== "runnable") continue;
      expect(ClientConfigurationNoticeSchema.safeParse(product.notice).success).toBe(true);
    }
  });

  it("rejects C0/C1, DEL, and Unicode line controls in safe summaries and notices", () => {
    const controlCharacters = [
      "\u0000",
      "\u0007",
      "\u0009",
      "\u000a",
      "\u000d",
      "\u001b",
      "\u001f",
      "\u007f",
      "\u0080",
      "\u0085",
      "\u009b",
      "\u009f",
      "\u2028",
      "\u2029",
    ];

    for (const controlCharacter of controlCharacters) {
      expect(
        ClientConfigurationNoticeSchema.safeParse({
          ...notice,
          id: `notice${controlCharacter}id`,
        }).success,
      ).toBe(false);

      for (const field of ["billing", "privacy"] as const) {
        expect(
          ClientConfigurationNoticeSchema.safeParse({
            ...notice,
            [field]: [`safe${controlCharacter}notice`],
          }).success,
        ).toBe(false);
      }
    }
  });

  it.each([
    "/usr/local/bin/codex",
    "/srv/bin/tool",
    "/bin/sh",
    "C:\\Program Files\\Codex\\codex.exe",
    "C:/Program Files/Codex/codex.exe",
    "\\\\server\\share\\codex.exe",
    "~/Library/Application Support/Codex/auth.json",
    "./bin/codex",
    "..\\bin\\codex",
    "Executable path: /usr/local/bin/codex",
    "Auth file: C:\\Program Files\\Codex\\auth.json",
  ])("rejects executable and auth paths from client-safe notices: %s", (path) => {
    for (const field of ["billing", "privacy"] as const) {
      expect(
        ClientConfigurationNoticeSchema.safeParse({ ...notice, [field]: [path] }).success,
      ).toBe(false);
    }
  });

  it.each([
    ",",
    ";",
    ":",
    "!",
    "?",
    "(",
    ")",
    "[",
    "]",
    "{",
    "}",
  ])("rejects a Unix path introduced by punctuation: %s", (separator) => {
    const path = `safe${separator}/usr/local/bin/codex`;
    expect(ClientConfigurationNoticeSchema.safeParse({ ...notice, billing: [path] }).success).toBe(
      false,
    );
  });

  it.each([
    "safe,~/",
    "safe,~/Library/Application Support/Codex/auth.json",
    "safe,C:/",
    "safe;C:\\Program Files\\Codex\\codex.exe",
    "safe:C:/Program Files/Codex/codex.exe",
    "safe,\\\\build-host\\Program Files\\Codex\\codex.exe",
    "safe;./",
    "safe;./bin/codex",
    "safe:../",
    "safe:../bin/codex",
    "safe,/",
  ])("rejects path roots after punctuation: %s", (path) => {
    expect(ClientConfigurationNoticeSchema.safeParse({ ...notice, privacy: [path] }).success).toBe(
      false,
    );
  });

  it.each([
    "Use / for alternatives",
    "Models support a/b notation",
    "Fetch from https://example.test",
    "A ratio such as 5/10 is ordinary prose",
    "The slash / is punctuation",
  ])("preserves legitimate slash prose: %s", (line) => {
    expect(ClientConfigurationNoticeSchema.safeParse({ ...notice, billing: [line] }).success).toBe(
      true,
    );
  });

  it.each([
    ["environment secret name", "DIFFGAZER_API_KEY"],
    ["command-line api key", "--api-key secret"],
    ["token identifier", "token identifier: account-token-123"],
    ["secret identifier", "secret id secret-123"],
    ["account secret identifier", "account-secret-id account-123"],
    ["workspace secret identifier", "workspace secret id workspace-123"],
  ])("rejects %s in client-safe billing and privacy text", (_name, line) => {
    for (const field of ["billing", "privacy"] as const) {
      const result = ClientConfigurationNoticeSchema.safeParse({
        ...notice,
        [field]: [line],
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues.some((issue) => issue.path[0] === field)).toBe(true);
      }
    }
  });

  it.each([
    "account-secret-id",
    "workspace_secret_id",
    "DIFFGAZER_API_KEY",
    "api-key-secret",
  ])("rejects secret-bearing notice id %s", (id) => {
    const result = ClientConfigurationNoticeSchema.safeParse({ ...notice, id });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((issue) => issue.path[0] === "id")).toBe(true);
    }
  });
});
