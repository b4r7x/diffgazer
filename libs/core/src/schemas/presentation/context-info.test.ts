import { describe, expect, it } from "vitest";
import { buildHomeContextInfo } from "./context-info.js";

describe("buildHomeContextInfo", () => {
  it("maps provider, model, and the most recent review summary", () => {
    const context = buildHomeContextInfo(
      { provider: "openrouter", model: "openrouter/test", trustedRepoRoot: "/repo" },
      { id: "rev-1", issueCount: 3 },
      true,
    );
    expect(context).toEqual({
      providerName: "openrouter",
      providerMode: "openrouter/test",
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
      providerMode: undefined,
      lastRunId: undefined,
      lastRunIssueCount: undefined,
      trustedDir: undefined,
    });
  });
});
