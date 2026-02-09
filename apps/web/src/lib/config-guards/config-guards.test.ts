import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  invalidateConfigGuardCache,
  setConfiguredGuardCache,
} from "./config-guard-cache";

const { mockCheckConfig, mockLoadInit } = vi.hoisted(() => ({
  mockCheckConfig: vi.fn(),
  mockLoadInit: vi.fn(),
}));

vi.mock("@/lib/api", () => ({
  api: {
    checkConfig: (...args: unknown[]) => mockCheckConfig(...args),
    loadInit: (...args: unknown[]) => mockLoadInit(...args),
  },
}));

import { requireConfigured, requireNotConfigured } from "./config-guards";

async function expectRedirectTo(promise: Promise<unknown>, to: string) {
  try {
    await promise;
    throw new Error("Expected redirect");
  } catch (error) {
    const target = (error as { to?: string; options?: { to?: string } }).to
      ?? (error as { options?: { to?: string } }).options?.to;
    expect(target).toBe(to);
  }
}

describe("config guards", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    invalidateConfigGuardCache();
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
});
