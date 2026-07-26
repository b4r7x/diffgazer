import { configQueries } from "@diffgazer/core/api/hooks";
import { isRedirect } from "@tanstack/react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockLoadInit } = vi.hoisted(() => ({
  mockLoadInit: vi.fn(),
}));

// Boundary mock: @/lib/api is the apps/web HTTP-client singleton (createApi wraps fetch); tests provide canned loadInit responses to drive guard behavior.
vi.mock("@/lib/api", () => ({
  api: {
    loadInit: (...args: unknown[]) => mockLoadInit(...args),
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
    mockLoadInit.mockResolvedValue({ setup: { isConfigured: true } });

    await expect(requireConfigured()).resolves.toBeUndefined();
  });

  it("redirects an unconfigured user to onboarding", async () => {
    mockLoadInit.mockResolvedValue({ setup: { isConfigured: false } });

    await expectRedirectTo(requireConfigured(), "/onboarding");
  });

  it("redirects completed users away from onboarding on direct URL access", async () => {
    mockLoadInit.mockResolvedValue({ setup: { isConfigured: true } });

    await expectRedirectTo(requireNotConfigured(), "/");
  });

  it("does not redirect when init fails transiently", async () => {
    mockLoadInit.mockRejectedValue(new Error("network down"));

    await expect(requireConfigured()).resolves.toBeUndefined();
    await expect(requireNotConfigured()).resolves.toBeUndefined();
  });

  it("dedupes the init request shared with a concurrent ConfigProvider fetch", async () => {
    let resolveInit: (value: { setup: { isConfigured: boolean } }) => void = () => {};
    mockLoadInit.mockReturnValue(
      new Promise<{ setup: { isConfigured: boolean } }>((resolve) => {
        resolveInit = resolve;
      }),
    );

    const guardPromise = requireConfigured();
    const providerPromise = queryClient.ensureQueryData(configQueries.init(api));

    resolveInit({ setup: { isConfigured: true } });
    await Promise.all([guardPromise, providerPromise]);

    expect(mockLoadInit).toHaveBeenCalledTimes(1);
  });
});
