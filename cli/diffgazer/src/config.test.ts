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
});
