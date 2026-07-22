import { describe, expect, it } from "vitest";
import { buildHomeContextInfo, buildHomeContextRows } from "./context-info.js";

describe("buildHomeContextInfo", () => {
  it("maps provider, model, and the most recent review summary", () => {
    const context = buildHomeContextInfo(
      { provider: "openrouter", model: "openrouter/test", trustedRepoRoot: "/repo" },
      { id: "rev-1", issueCount: 3 },
      true,
    );
    expect(context).toEqual({
      providerName: "openrouter",
      providerModel: "openrouter/test",
      lastRunId: "rev-1",
      lastRunIssueCount: 3,
      trustedDir: "/repo",
    });
  });

  it("omits the trusted directory when read access is not granted", () => {
    const context = buildHomeContextInfo(
      { provider: "openrouter", model: "openrouter/test", trustedRepoRoot: "/repo" },
      undefined,
      false,
    );
    expect(context.trustedDir).toBeUndefined();
  });

  it("normalizes null provider and model to undefined", () => {
    const context = buildHomeContextInfo(
      { provider: null, model: null, trustedRepoRoot: null },
      null,
      true,
    );
    expect(context).toEqual({
      providerName: undefined,
      providerModel: undefined,
      lastRunId: undefined,
      lastRunIssueCount: undefined,
      trustedDir: undefined,
    });
  });

  it("builds the three visible rows when context data is present", () => {
    expect(
      buildHomeContextRows({
        context: {
          trustedDir: "/repo",
          providerName: "openrouter",
          providerModel: "openrouter/test",
          lastRunId: "12345678-1234-4123-8123-123456789abc",
          lastRunIssueCount: 3,
        },
        isTrusted: true,
        projectPath: "/repo",
      }),
    ).toEqual({
      trust: { label: "Trusted", value: "/repo" },
      provider: { label: "Provider", value: "openrouter (openrouter/test)" },
      lastRun: { label: "Last Run", value: "#12345678", issueCount: "(3 issues)" },
    });
  });

  it("builds explicit values for all three rows when context data is absent", () => {
    expect(buildHomeContextRows({ context: {}, isTrusted: false })).toEqual({
      trust: { label: "Not trusted", value: "—" },
      provider: { label: "Provider", value: "Not configured" },
      lastRun: { label: "Last Run", value: "None", issueCount: undefined },
    });
  });
});
