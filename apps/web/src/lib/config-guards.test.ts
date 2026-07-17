import { configQueries } from "@diffgazer/core/api/hooks";
import { isRedirect } from "@tanstack/react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockCheckConfig, mockLoadInit } = vi.hoisted(() => ({
  mockCheckConfig: vi.fn(),
  mockLoadInit: vi.fn(),
}));

// Boundary mock: @/lib/api is the apps/web HTTP-client singleton (createApi wraps fetch); tests provide canned checkConfig/loadInit responses to drive guard behavior.
vi.mock("@/lib/api", () => ({
  api: {
    checkConfig: (...args: unknown[]) => mockCheckConfig(...args),
    loadInit: (...args: unknown[]) => mockLoadInit(...args),
  },
}));

import { api } from "@/lib/api";
import { queryClient } from "@/lib/query-client";
import { resolveApiEndpoint } from "./api-endpoint";
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
    mockCheckConfig.mockResolvedValue({ configured: true });
    mockLoadInit.mockResolvedValue({ setup: { isConfigured: true } });

    await expect(requireConfigured()).resolves.toBeUndefined();
    expect(mockCheckConfig).not.toHaveBeenCalled();
  });

  it("redirects an unconfigured user to onboarding", async () => {
    mockCheckConfig.mockResolvedValue({ configured: false });
    mockLoadInit.mockResolvedValue({ setup: { isConfigured: false } });

    await expectRedirectTo(requireConfigured(), "/onboarding");
  });

  it("uses init setup status when the legacy check contradicts it", async () => {
    mockCheckConfig.mockResolvedValue({ configured: true });
    mockLoadInit.mockResolvedValue({ setup: { isConfigured: false } });

    await expectRedirectTo(requireConfigured(), "/onboarding");
    expect(mockCheckConfig).not.toHaveBeenCalled();
  });

  it("redirects completed users away from onboarding on direct URL access", async () => {
    mockCheckConfig.mockResolvedValue({ configured: false });
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

describe("resolveApiEndpoint", () => {
  const fallback = "http://127.0.0.1:3000";

  it("trims and accepts HTTP(S) overrides", () => {
    expect(resolveApiEndpoint("  https://api.example.test/v1  ", fallback)).toBe(
      "https://api.example.test/v1",
    );
  });

  it.each([undefined, "", "   "])("uses the same fallback for %s", (value) => {
    expect(resolveApiEndpoint(value, fallback)).toBe(fallback);
  });

  it("rejects malformed overrides", () => {
    expect(() => resolveApiEndpoint("not a URL", fallback)).toThrow(
      "VITE_API_URL must be a valid HTTP(S) URL.",
    );
  });

  it.each([
    "file:///tmp/api",
    "ftp://api.example.test",
  ])("rejects unsupported endpoint %s", (value) => {
    expect(() => resolveApiEndpoint(value, fallback)).toThrow(
      "VITE_API_URL must use HTTP or HTTPS.",
    );
  });
});
