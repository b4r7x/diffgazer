import { describe, expect, it } from "vitest";
import type { TrustConfig } from "../schemas/config/settings.js";
import { makeTrustConfig } from "../testing/factories.js";
import { deriveTrustStatus } from "./trust-status.js";

const makeTrust = (overrides: Partial<TrustConfig> = {}) =>
  makeTrustConfig({ projectId: "proj_1", repoRoot: "/repo", ...overrides });

describe("deriveTrustStatus", () => {
  it("flags needsTrust when trust has not been resolved for a known repository", () => {
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

  it("flags needsTrust on first run when project file is absent (projectId null)", () => {
    const result = deriveTrustStatus({ trust: null, projectId: null, repoRoot: "/repo" });
    expect(result).toEqual({ needsTrust: true, isTrusted: false });
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
