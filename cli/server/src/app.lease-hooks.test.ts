import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { diffgazerHome, loadStore } from "./shared/lib/config/store.test-support.js";

const GEMINI_ENDPOINT = "https://generativelanguage.googleapis.com/v1beta";

const literalSecretPath = (configurationId: string, revision: number): string =>
  join(diffgazerHome, "credentials", `${configurationId}-${revision}.key`);

async function seedConfiguration(): Promise<{ configurationId: string; secretPath: string }> {
  const store = await loadStore();
  const created = await store.runConfigurationAction({
    action: "create",
    input: {
      transportFamily: "hosted-api",
      productId: "gemini",
      endpoint: GEMINI_ENDPOINT,
      credential: { kind: "literal", value: "test-key-not-real" },
    },
  });
  if (!created.ok) throw new Error(created.error.message);
  const configurationId = created.value.configuration?.configurationId;
  if (!configurationId) throw new Error("create response requires a configuration");
  return { configurationId, secretPath: literalSecretPath(configurationId, 1) };
}

describe("createApp configuration lease hooks", () => {
  it("cancels and drains admitted work before deletion removes secret material", async () => {
    const { createApp } = await import("./app.js");
    createApp();

    const { configurationId, secretPath } = await seedConfiguration();
    expect(existsSync(secretPath)).toBe(true);

    const { getConfigurationLeaseAuthority, registerSession } = await import(
      "./shared/lib/session-registry.js"
    );
    const authority = getConfigurationLeaseAuthority();
    const acquired = authority.tryAcquire({
      configurationId,
      configurationRevision: 1,
      executionFingerprint: "f".repeat(64),
      limits: {
        maxInputTokens: 100,
        maxResponseBytes: 100,
        wallTimeMs: 1000,
        maxRetries: 0,
        maxConcurrency: 1,
        maxCostUsd: 1,
      },
    });
    if (!acquired.ok) throw new Error(`lease acquisition failed: ${acquired.error.code}`);
    const lease = acquired.value;

    const events: string[] = [];
    registerSession("review-1", {
      projectKey: "/project",
      configurationId,
      configurationRevision: 1,
      admittedExecutionFingerprint: lease.executionFingerprint,
      leaseId: lease.leaseId,
      cancel: () => {
        events.push("cancel");
      },
    });

    const store = await loadStore();
    const deletion = store.runConfigurationAction({
      action: "delete",
      configurationId,
      expectedRevision: 1,
    });

    // The lease is still held, so the delete is parked in drain and the
    // credential must still be on disk.
    await vi.waitFor(() => expect(events).toContain("cancel"));
    expect(existsSync(secretPath)).toBe(true);

    // The drain waits for a review, not for the documents: reads must not queue
    // behind it for the whole admitted wall time.
    const settingsDuringDrain = await store.readSettings();
    expect(settingsDuringDrain.ok).toBe(true);

    events.push("release");
    lease.release();

    const result = await deletion;
    expect(result.ok).toBe(true);
    expect(events).toEqual(["cancel", "release"]);
    expect(existsSync(secretPath)).toBe(false);
    expect(authority.activeLeaseCount(configurationId)).toBe(0);
  });
});
