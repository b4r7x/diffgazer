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

const stubFetchResponse = (response: () => Response): void => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => response()),
  );
};

const conformingProviderResponse = (): Response =>
  new Response(googleReviewBody, {
    status: 200,
    headers: { "content-type": "application/json" },
  });

const createSelectedGeminiConfiguration = async (
  store: Awaited<ReturnType<typeof loadStore>>,
): Promise<string> => {
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
  return configurationId;
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("createApp conformance probe wiring", () => {
  it("drives the test action to ready through the registered hosted probe", async () => {
    const { createApp } = await import("./app.js");
    createApp();

    stubFetchResponse(conformingProviderResponse);

    const store = await loadStore();
    const configurationId = await createSelectedGeminiConfiguration(store);

    // The unregistered default probe can only ever report skipped, so a ready
    // readiness proves createApp wired the real hosted probe.
    const tested = succeed(await store.runConfigurationAction({ action: "test", configurationId }));

    expect(tested.readiness).toMatchObject({ status: "ready", ready: true });
    expect(existsSync(join(diffgazerHome, "evidence", `evidence-${configurationId}.json`))).toBe(
      true,
    );
  });

  it("stops setup-blocking review start once only conformance is open, before and after a probe", async () => {
    const { createApp } = await import("./app.js");
    const app = createApp();
    const store = await loadStore();
    const configurationId = await createSelectedGeminiConfiguration(store);

    const startReview = () =>
      app.request("/api/review/reviews", {
        method: "POST",
        headers: { Host: "localhost", "content-type": "application/json" },
        body: JSON.stringify({}),
      });

    // A configuration whose only open item is conformance clears the setup
    // gate and is answered by the next guard (repo trust) instead.
    const unproven = await startReview();
    expect(unproven.status).toBe(403);
    expect(await unproven.json()).toMatchObject({ error: { code: "TRUST_REQUIRED" } });

    // The optional diagnostic still reports a rejected probe honestly, and it
    // still persists nothing, so review start stays open.
    stubFetchResponse(() => new Response("upstream error", { status: 500 }));
    const failed = succeed(await store.runConfigurationAction({ action: "test", configurationId }));
    expect(failed).toMatchObject({ action: "test", status: "failed" });
    expect(existsSync(join(diffgazerHome, "evidence", `evidence-${configurationId}.json`))).toBe(
      false,
    );

    const afterFailedProbe = await startReview();
    expect(afterFailedProbe.status).toBe(403);
    expect(await afterFailedProbe.json()).toMatchObject({ error: { code: "TRUST_REQUIRED" } });

    // A passed probe records admission evidence and readiness turns ready.
    stubFetchResponse(conformingProviderResponse);
    const passed = succeed(await store.runConfigurationAction({ action: "test", configurationId }));
    expect(passed).toMatchObject({ action: "test", status: "succeeded" });
    expect(passed.readiness).toMatchObject({ status: "ready", ready: true });

    const admitted = await startReview();
    expect(admitted.status).toBe(403);
    expect(await admitted.json()).toMatchObject({ error: { code: "TRUST_REQUIRED" } });
  });
});
