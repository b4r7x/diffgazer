import { describe, expect, it } from "vitest";
import type { TrustConfig } from "../schemas/config/settings.js";
import { deriveTrustStatus } from "./trust-status.js";

function makeTrust(overrides: Partial<TrustConfig> = {}): TrustConfig {
  return {
    projectId: "proj_1",
    repoRoot: "/repo",
    trustedAt: "2025-01-01T00:00:00.000Z",
    trustMode: "persistent",
    capabilities: { readFiles: true, runCommands: false },
    ...overrides,
  };
}

describe("deriveTrustStatus", () => {
  it("flags needsTrust when project is identified but trust has not been resolved", () => {
    const result = deriveTrustStatus({
      trust: null,
      projectId: "proj_1",
      repoRoot: "/repo",
    });
    expect(result).toEqual({ needsTrust: true, isTrusted: false });
  });

  it("reports trusted when read capability is granted", () => {
    const result = deriveTrustStatus({
      trust: makeTrust({ capabilities: { readFiles: true, runCommands: false } }),
      projectId: "proj_1",
      repoRoot: "/repo",
    });
    expect(result).toEqual({ needsTrust: false, isTrusted: true });
  });

  it("reports neither trusted nor needsTrust when read capability is denied", () => {
    const result = deriveTrustStatus({
      trust: makeTrust({ capabilities: { readFiles: false, runCommands: false } }),
      projectId: "proj_1",
      repoRoot: "/repo",
    });
    expect(result).toEqual({ needsTrust: false, isTrusted: false });
  });

  it("reports untrusted when read access belongs to a different repository root", () => {
    const result = deriveTrustStatus({
      trust: makeTrust({ repoRoot: "/old/repo" }),
      projectId: "proj_1",
      repoRoot: "/moved/repo",
    });

    expect(result).toEqual({ needsTrust: false, isTrusted: false });
  });

  it("does not flag needsTrust when project is not identified", () => {
    const result = deriveTrustStatus({ trust: null, projectId: null, repoRoot: null });
    expect(result).toEqual({ needsTrust: false, isTrusted: false });
  });

  it("does not flag needsTrust when repoRoot is missing", () => {
    const result = deriveTrustStatus({
      trust: null,
      projectId: "proj_1",
      repoRoot: null,
    });
    expect(result.needsTrust).toBe(false);
  });

  it("treats undefined inputs as absent", () => {
    const result = deriveTrustStatus({
      trust: undefined,
      projectId: undefined,
      repoRoot: undefined,
    });
    expect(result).toEqual({ needsTrust: false, isTrusted: false });
  });
});
