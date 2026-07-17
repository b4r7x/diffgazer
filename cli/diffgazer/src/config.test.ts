import { afterEach, describe, expect, it, vi } from "vitest";

async function loadConfig(forceKillEnv?: string) {
  vi.resetModules();
  if (forceKillEnv === undefined) {
    delete process.env.DIFFGAZER_FORCE_KILL_DELAY_MS;
  } else {
    process.env.DIFFGAZER_FORCE_KILL_DELAY_MS = forceKillEnv;
  }
  return (await import("./config")).config;
}

describe("shutdown timing", () => {
  afterEach(() => {
    delete process.env.DIFFGAZER_FORCE_KILL_DELAY_MS;
  });

  it("keeps the parent grace strictly above the child force-kill delay by default", async () => {
    const config = await loadConfig();
    expect(config.shutdown.forceKillMs).toBe(2000);
    expect(config.shutdown.gracefulMs).toBeGreaterThan(config.shutdown.forceKillMs);
  });

  it("keeps the parent grace above a raised force-kill delay so the child is never orphaned", async () => {
    const config = await loadConfig("5000");
    expect(config.shutdown.forceKillMs).toBe(5000);
    expect(config.shutdown.gracefulMs).toBeGreaterThan(config.shutdown.forceKillMs);
  });

  it("accepts the largest delay whose parent grace fits a Node timer", async () => {
    const config = await loadConfig("2147482647");

    expect(config.shutdown.forceKillMs).toBe(2_147_482_647);
    expect(config.shutdown.gracefulMs).toBe(2_147_483_647);
  });

  it("falls back when the delay would overflow the parent Node timer", async () => {
    const config = await loadConfig("2147482648");

    expect(config.shutdown.forceKillMs).toBe(2000);
    expect(config.shutdown.gracefulMs).toBe(3000);
  });
});
