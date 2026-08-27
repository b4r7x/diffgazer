import { describe, expect, it } from "vitest";
import {
  buildCliChildEnvironment,
  CLI_CHILD_ENV_ALLOWLIST,
  CLI_CREDENTIAL_ENV_KEYS,
  FORBIDDEN_ENV_KEY_PATTERN,
} from "./child-environment.js";

describe("CLI child environment allowlist", () => {
  it("names no credential env key", () => {
    const credentialKeys = new Set<string>(CLI_CREDENTIAL_ENV_KEYS);
    const offenders = CLI_CHILD_ENV_ALLOWLIST.filter((key) =>
      credentialKeys.has(key.toUpperCase()),
    );

    expect(offenders).toEqual([]);
  });

  it("names no key matching the forbidden secret-bearing pattern", () => {
    const offenders = CLI_CHILD_ENV_ALLOWLIST.filter((key) =>
      FORBIDDEN_ENV_KEY_PATTERN.test(key.toUpperCase()),
    );

    expect(offenders).toEqual([]);
  });
});

describe("buildCliChildEnvironment", () => {
  it("keeps only allowlisted ambient values and forces the ambient home", () => {
    const childEnv = buildCliChildEnvironment(
      {
        PATH: "/usr/bin",
        HOME: "/tmp/sandbox-home",
        GITHUB_TOKEN: "ghp-secret",
        DIFFGAZER_SHUTDOWN_TOKEN: "shutdown-secret",
      },
      { ambientHome: "/home/reviewer" },
    );

    expect(childEnv).toEqual({ PATH: "/usr/bin", HOME: "/home/reviewer" });
  });
});
