import { configQueries } from "@diffgazer/core/api/hooks";
import { makeReadyInitResponse } from "@diffgazer/core/testing/provider-fixtures";
import { isRedirect } from "@tanstack/react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { makeShellInitResponse, SHELL_TRUSTED_PROJECT } from "@/testing/shell-fixtures";

const { mockLoadConfigurationInit } = vi.hoisted(() => ({
  mockLoadConfigurationInit: vi.fn(),
}));

// Boundary mock: @/lib/api is the apps/web HTTP-client singleton (createApi wraps fetch); tests provide canned init responses to drive guard behavior.
vi.mock("@/lib/api", () => ({
  api: {
    loadConfigurationInit: (...args: unknown[]) => mockLoadConfigurationInit(...args),
  },
}));

import { api } from "@/lib/api";
import { queryClient } from "@/lib/query-client";
import { requireConfigured, requireNotConfigured } from "./config-guards";

async function expectRedirectTo(promise: Promise<unknown>, to: string) {
  try {
    await promise;
    throw new Error("Expected redirect");
  } catch (error) {
    expect(isRedirect(error)).toBe(true);
    const target =
      (error as { to?: string; options?: { to?: string } }).to ??
      (error as { options?: { to?: string } }).options?.to;
    expect(target).toBe(to);
  }
}

describe("config guards", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    queryClient.clear();
    // The guards share the app's singleton QueryClient (whose default policy
    // retries non-4xx failures); disable retries so transient-failure paths
    // settle immediately instead of waiting on backoff.
    queryClient.setDefaultOptions({ queries: { retry: false } });
  });

  it("passes a configured user through requireConfigured", async () => {
    mockLoadConfigurationInit.mockResolvedValue(makeReadyInitResponse());

    await expect(requireConfigured()).resolves.toBeUndefined();
  });

  it("redirects an unconfigured user to onboarding", async () => {
    mockLoadConfigurationInit.mockResolvedValue(
      makeShellInitResponse({
        configurations: [],
        selectedConfigurationId: null,
        project: SHELL_TRUSTED_PROJECT,
      }),
    );

    await expectRedirectTo(requireConfigured(), "/onboarding");
  });

  it("keeps onboarding reachable when the selected id has no listed configuration", async () => {
    // The server drops records it cannot project but still echoes the stored
    // selection, so a dangling id must not read as "configured".
    mockLoadConfigurationInit.mockResolvedValue(
      makeShellInitResponse({
        configurations: [],
        selectedConfigurationId: "dropped-configuration",
        project: SHELL_TRUSTED_PROJECT,
      }),
    );

    await expectRedirectTo(requireConfigured(), "/onboarding");
    await expect(requireNotConfigured()).resolves.toBeUndefined();
  });

  it("redirects completed users away from onboarding on direct URL access", async () => {
    mockLoadConfigurationInit.mockResolvedValue(makeReadyInitResponse());

    await expectRedirectTo(requireNotConfigured(), "/");
  });

  it("does not redirect when init fails transiently", async () => {
    mockLoadConfigurationInit.mockRejectedValue(new Error("network down"));

    await expect(requireConfigured()).resolves.toBeUndefined();
    await expect(requireNotConfigured()).resolves.toBeUndefined();
  });

  it("dedupes the init request shared with a concurrent ConfigProvider fetch", async () => {
    let resolveInit: (value: ReturnType<typeof makeReadyInitResponse>) => void = () => {};
    mockLoadConfigurationInit.mockReturnValue(
      new Promise<ReturnType<typeof makeReadyInitResponse>>((resolve) => {
        resolveInit = resolve;
      }),
    );

    const guardPromise = requireConfigured();
    const providerPromise = queryClient.ensureQueryData(configQueries.init(api));

    resolveInit(makeReadyInitResponse());
    await Promise.all([guardPromise, providerPromise]);

    expect(mockLoadConfigurationInit).toHaveBeenCalledTimes(1);
  });
});
