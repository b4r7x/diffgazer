import { HOSTED_API_PRODUCT_IDS } from "@diffgazer/core/schemas/config";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  canProduceReadyEvidence,
  HOSTED_LIVE_PROBE_DESCRIPTORS,
  HOSTED_LIVE_PROBE_OPT_IN_ENV,
  HOSTED_REQ_084_CASES,
  HOSTED_REQ_085_CASES,
  HOSTED_REQ_086_CASES,
  isHostedLiveProbeOptIn,
  reportHostedLiveSkipped,
  resolveHostedLiveSkipReason,
  runHostedLiveProbe,
  runHostedMockConformanceCase,
} from "./fixtures.js";

// Stubbed env is restored even when an expectation between the stubs fails, so a
// leaked live-probe opt-in or fake credential cannot cascade into later suites.
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("hosted mock conformance matrix", () => {
  it.each([
    ...HOSTED_REQ_084_CASES,
    ...HOSTED_REQ_085_CASES,
    ...HOSTED_REQ_086_CASES,
  ])("$id exercises the production path", async (testCase) => {
    const observation = await runHostedMockConformanceCase(testCase);

    expect(observation.outcome).toBe(testCase.expectedOutcome);
    // Only a completed case may carry findings, and only as many as it declares.
    const expectedFindingsCount =
      testCase.expectedOutcome === "completed" ? testCase.expectedFindingsCount : 0;
    if (expectedFindingsCount !== undefined) {
      expect(observation.findingsCount).toBe(expectedFindingsCount);
    }
    if (testCase.expectedAttemptCount !== undefined) {
      expect(observation.attemptCount).toBe(testCase.expectedAttemptCount);
    }
    if (testCase.expectedEndpoint !== undefined) {
      expect(observation.requestedEndpoint).toBe(new URL(testCase.expectedEndpoint).origin);
    }
    // A mock run never proves a live product works, whatever it observed.
    expect(canProduceReadyEvidence(observation)).toBe(false);
  });
});

describe("REQ-089 and REQ-091 hosted live truthfulness", () => {
  it("uses the canonical credential environment variable for every hosted product", () => {
    // Written out by hand from libs/core/src/providers/credential-env-vars.ts: an
    // expectation derived from the same constants the descriptors are built from
    // moves with them and can never go red.
    expect(
      HOSTED_LIVE_PROBE_DESCRIPTORS.map(({ productId, credentialEnv }) => [
        productId,
        credentialEnv,
      ]),
    ).toEqual([
      ["gemini", "GOOGLE_API_KEY"],
      ["zai", "ZAI_API_KEY"],
      ["openrouter", "OPENROUTER_API_KEY"],
      ["deepseek", "DEEPSEEK_API_KEY"],
      ["qwen", "QWEN_API_KEY"],
      ["moonshot", "MOONSHOT_API_KEY"],
      ["minimax", "MINIMAX_API_KEY"],
      ["ollama-cloud", "OLLAMA_API_KEY"],
      ["opencode-zen", "OPENCODE_API_KEY"],
    ]);
    expect(HOSTED_LIVE_PROBE_DESCRIPTORS).toHaveLength(HOSTED_API_PRODUCT_IDS.length);
  });

  it("reports skipped live probes without credential or opt-in", () => {
    const descriptor = HOSTED_LIVE_PROBE_DESCRIPTORS.find((entry) => entry.productId === "zai");
    expect(descriptor).toBeDefined();
    if (!descriptor) return;

    vi.stubEnv(HOSTED_LIVE_PROBE_OPT_IN_ENV, undefined);
    vi.stubEnv(descriptor.credentialEnv, undefined);

    const skipReason = resolveHostedLiveSkipReason(descriptor);
    expect(skipReason).toBe("live-probes-disabled");
    const observation = reportHostedLiveSkipped(descriptor, skipReason ?? "live-probes-disabled");
    expect(observation.status).toBe("skipped");
    expect(canProduceReadyEvidence(observation)).toBe(false);

    vi.stubEnv(HOSTED_LIVE_PROBE_OPT_IN_ENV, "1");
    expect(resolveHostedLiveSkipReason(descriptor)).toBe("credential-missing");

    vi.stubEnv(descriptor.credentialEnv, "test-key");
    expect(resolveHostedLiveSkipReason(descriptor)).toBeNull();
  });

  it("never counts skipped live probes as passed", async () => {
    const descriptor = HOSTED_LIVE_PROBE_DESCRIPTORS[0];
    expect(descriptor).toBeDefined();
    if (!descriptor) return;

    const observation = await runHostedLiveProbe(descriptor);
    if (isHostedLiveProbeOptIn() && process.env[descriptor.credentialEnv]) {
      expect(["passed", "failed"]).toContain(observation.status);
      if (observation.status === "skipped") {
        expect(canProduceReadyEvidence(observation)).toBe(false);
      }
      return;
    }

    expect(observation.status).toBe("skipped");
    expect(canProduceReadyEvidence(observation)).toBe(false);
  });

  it("pins no model for a product that suggests none", () => {
    const discovered = HOSTED_LIVE_PROBE_DESCRIPTORS.find(
      (entry) => entry.productId === "opencode-zen",
    );
    expect(discovered?.modelId).toBeNull();
  });

  it("skips rather than probing a model it could not resolve", async () => {
    const descriptor = HOSTED_LIVE_PROBE_DESCRIPTORS.find(
      (entry) => entry.productId === "opencode-zen",
    );
    expect(descriptor).toBeDefined();
    if (!descriptor) return;

    vi.stubEnv(HOSTED_LIVE_PROBE_OPT_IN_ENV, "1");
    vi.stubEnv(descriptor.credentialEnv, "test-key");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("unavailable", { status: 500 })),
    );

    const observation = await runHostedLiveProbe(descriptor);
    expect(observation.status).toBe("skipped");
    expect(observation.skipReason).toBe("model-unresolved");
    expect(canProduceReadyEvidence(observation)).toBe(false);
  });

  it("probes the model its own /models list names", async () => {
    const descriptor = HOSTED_LIVE_PROBE_DESCRIPTORS.find(
      (entry) => entry.productId === "opencode-zen",
    );
    expect(descriptor).toBeDefined();
    if (!descriptor) return;

    vi.stubEnv(HOSTED_LIVE_PROBE_OPT_IN_ENV, "1");
    vi.stubEnv(descriptor.credentialEnv, "test-key");

    const requested: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: unknown) => {
        const url = String(input);
        requested.push(url);
        if (url.endsWith("/models")) {
          return Response.json({ data: [{ id: "zen/stealth-1" }] });
        }
        return Response.json({
          choices: [
            { message: { content: JSON.stringify({ issues: [] }) }, finish_reason: "stop" },
          ],
          usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
        });
      }),
    );

    const observation = await runHostedLiveProbe(descriptor);
    expect(requested[0]).toMatch(/\/models$/);
    expect(observation.status).toBe("passed");
    expect(observation.outcome).toBe("completed");
  });

  it("does not treat mock HTTP/JSON validity alone as ready evidence", async () => {
    const httpOnly = HOSTED_REQ_084_CASES.find(
      (testCase) => testCase.id === "REQ-084:valid-http-json-without-review-schema",
    );
    expect(httpOnly).toBeDefined();
    if (!httpOnly) return;

    const observation = await runHostedMockConformanceCase(httpOnly);
    expect(observation.outcome).toBe("schema-failed");
    expect(canProduceReadyEvidence(observation)).toBe(false);
  });
});

describe.runIf(isHostedLiveProbeOptIn())("REQ-084 hosted live conformance (opt-in)", () => {
  for (const descriptor of HOSTED_LIVE_PROBE_DESCRIPTORS) {
    it.skipIf(!process.env[descriptor.credentialEnv])(
      `live ${descriptor.productId} uses credentialed production path`,
      async () => {
        const observation = await runHostedLiveProbe(descriptor);
        // A product that suggests no model must discover one from its own
        // `/models` list; an unreadable list is a missing prerequisite, so it
        // skips rather than reporting a verdict it never observed (REQ-089).
        if (observation.skipReason === "model-unresolved") {
          expect(descriptor.modelId).toBeNull();
          expect(canProduceReadyEvidence(observation)).toBe(false);
          return;
        }
        expect(observation.status).not.toBe("skipped");
        if (observation.status === "passed") {
          expect(canProduceReadyEvidence(observation)).toBe(true);
        }
      },
      120_000,
    );
  }
});
