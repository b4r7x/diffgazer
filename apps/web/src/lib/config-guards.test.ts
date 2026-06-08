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

let setConfiguredGuardCache: typeof import("./config-guard-cache").setConfiguredGuardCache;
let requireConfigured: typeof import("./config-guards").requireConfigured;
let requireNotConfigured: typeof import("./config-guards").requireNotConfigured;

async function expectRedirectTo(promise: Promise<unknown>, to: string) {
  try {
    await promise;
    throw new Error("Expected redirect");
  } catch (error) {
    const target =
      (error as { to?: string; options?: { to?: string } }).to ??
      (error as { options?: { to?: string } }).options?.to;
    expect(target).toBe(to);
  }
}

describe("config guards", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();
    ({ setConfiguredGuardCache } = await import("./config-guard-cache"));
    ({ requireConfigured, requireNotConfigured } = await import("./config-guards"));
  });

  it("redirects completed users away from onboarding on direct URL access", async () => {
    mockCheckConfig.mockResolvedValue({ configured: false });
    mockLoadInit.mockResolvedValue({ setup: { isConfigured: true } });

    await expectRedirectTo(requireNotConfigured(), "/");
  });

  it("keeps redirecting completed users away from onboarding during back/forward navigation", async () => {
    setConfiguredGuardCache(true);

    await expectRedirectTo(requireNotConfigured(), "/");
    await expectRedirectTo(requireNotConfigured(), "/");
    expect(mockCheckConfig).not.toHaveBeenCalled();
    expect(mockLoadInit).not.toHaveBeenCalled();
  });

  it("treats init setup status as source of truth for configured routes", async () => {
    mockCheckConfig.mockResolvedValue({ configured: false });
    mockLoadInit.mockResolvedValue({ setup: { isConfigured: true } });

    await expect(requireConfigured()).resolves.toBeUndefined();
  });

  it("does not poison the guard cache when configuration checks fail transiently", async () => {
    mockCheckConfig.mockRejectedValue(new Error("network down"));
    mockLoadInit.mockRejectedValue(new Error("network down"));

    await expect(requireConfigured()).resolves.toBeUndefined();

    const { getConfiguredGuardCache } = await import("./config-guard-cache");
    expect(getConfiguredGuardCache(30_000)).toBeNull();
  });
});
