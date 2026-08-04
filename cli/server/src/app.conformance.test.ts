import { existsSync } from "node:fs";
import { join } from "node:path";
import type { Result } from "@diffgazer/core/result";
import { afterEach, describe, expect, it, vi } from "vitest";
import { diffgazerHome, loadStore } from "./shared/lib/config/store.test-support.js";

const GEMINI_ENDPOINT = "https://generativelanguage.googleapis.com/v1beta";

const googleReviewBody = JSON.stringify({
  candidates: [
    { content: { parts: [{ text: JSON.stringify({ issues: [] }) }] }, finishReason: "STOP" },
  ],
  usageMetadata: { promptTokenCount: 12, candidatesTokenCount: 8, totalTokenCount: 20 },
});

const succeed = <T>(result: Result<T, unknown>): T => {
  if (!result.ok) throw new Error("expected a succeeded configuration action");
  return result.value;
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("createApp conformance probe wiring", () => {
  it("drives the test action to ready through the registered hosted probe", async () => {
    const { createApp } = await import("./app.js");
    createApp();

    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(googleReviewBody, {
            status: 200,
            headers: { "content-type": "application/json" },
          }),
      ),
    );

    const store = await loadStore();
    const created = succeed(
      await store.runConfigurationAction({
        action: "create",
        input: {
          transportFamily: "hosted-api",
          productId: "gemini",
          endpoint: GEMINI_ENDPOINT,
          credential: { kind: "literal", value: "test-key-not-real" },
        },
      }),
    );
    const configurationId = created.configuration?.configurationId;
    if (!configurationId) throw new Error("create response requires a configuration");

    succeed(
      await store.runConfigurationAction({
        action: "select",
        configurationId,
        modelId: "gemini-2.5-flash",
      }),
    );
    succeed(
      await store.runConfigurationAction({
        action: "update",
        configurationId,
        expectedRevision: 1,
        input: { transportFamily: "hosted-api", productId: "gemini", endpoint: GEMINI_ENDPOINT },
        acknowledgement: {
          status: "accepted",
          noticeId: "gemini-hosted-api",
          noticeVersion: 1,
          acceptedAt: "2026-01-02T00:00:00.000Z",
        },
      }),
    );

    // The unregistered default probe can only ever report skipped, so a ready
    // readiness proves createApp wired the real hosted probe.
    const tested = succeed(await store.runConfigurationAction({ action: "test", configurationId }));

    expect(tested.readiness).toMatchObject({ status: "ready", ready: true });
    expect(existsSync(join(diffgazerHome, "evidence", `evidence-${configurationId}.json`))).toBe(
      true,
    );
  });
});
