import "./model-select-overlay.terminal-mock";
import { type BoundApi, createApi } from "@diffgazer/core/api";
import { cleanup, render } from "ink-testing-library";
import { afterEach, describe, expect, test, vi } from "vitest";
import type { SupportedConfigurationSummary } from "../testing/fixtures";
import { ModelSelectOverlay } from "./model-select-overlay";
import {
  CHECKED_AT,
  copyNotice,
  flushUntil,
  GEMINI_CONFIGURATION,
  geminiName,
  readyFor,
  testDiscoveryResponse,
  Wrapper,
} from "./model-select-overlay.test-support";

describe("ModelSelectOverlay discovery provenance", () => {
  afterEach(() => {
    cleanup();
  });

  test("shows tuple-bound model id, checkedAt, and remediation on skipped discovery", async () => {
    const testConfiguration = vi.fn<BoundApi["testConfiguration"]>().mockResolvedValue({
      action: "test",
      status: "succeeded",
      configuration: GEMINI_CONFIGURATION,
      readiness: {
        status: "skipped",
        ready: false,
        evidenceStatus: "skipped",
        checkedAt: CHECKED_AT,
        acknowledgement: { status: "not-applicable" },
        action: "test",
        explanation: "The live readiness check was intentionally skipped.",
        remediation: {
          code: "enable-live-probe",
          message: "Satisfy the live-check prerequisites, then test the configuration again.",
        },
      },
    });
    const api = {
      ...createApi({ baseUrl: "http://localhost" }),
      testConfiguration,
    } satisfies BoundApi;
    const { lastFrame } = render(
      <Wrapper api={api}>
        <ModelSelectOverlay open onOpenChange={() => {}} configuration={GEMINI_CONFIGURATION} />
      </Wrapper>,
    );

    await flushUntil(() => lastFrame()?.includes("Satisfy the live-check prerequisites") ?? false);
    const frame = lastFrame() ?? "";
    expect(frame).toContain("gemini");
    expect(frame).toContain("checked");
    expect(frame).toContain("Press r to retry");
    expect(frame).not.toContain("structured outputs");
  });

  test("retries discovery with r after a rejected query", async () => {
    const testConfiguration = vi
      .fn<BoundApi["testConfiguration"]>()
      .mockRejectedValueOnce(new Error("Model discovery failed. Test the configuration again."))
      .mockResolvedValueOnce(testDiscoveryResponse(GEMINI_CONFIGURATION));
    const api = {
      ...createApi({ baseUrl: "http://localhost" }),
      testConfiguration,
    } satisfies BoundApi;
    const { lastFrame, stdin } = render(
      <Wrapper api={api}>
        <ModelSelectOverlay open onOpenChange={() => {}} configuration={GEMINI_CONFIGURATION} />
      </Wrapper>,
    );

    await flushUntil(() => lastFrame()?.includes("Model discovery failed") ?? false);
    stdin.write("r");
    await flushUntil(() => lastFrame()?.includes(geminiName("gemini-2.5-flash")) ?? false);
    expect(testConfiguration).toHaveBeenCalledTimes(2);
  });

  test("renders the exact discovered model id without catalog-only enabling", async () => {
    const testConfiguration = vi
      .fn<BoundApi["testConfiguration"]>()
      .mockResolvedValue(testDiscoveryResponse(GEMINI_CONFIGURATION));
    const api = {
      ...createApi({ baseUrl: "http://localhost" }),
      testConfiguration,
    } satisfies BoundApi;
    const { lastFrame } = render(
      <Wrapper api={api}>
        <ModelSelectOverlay open onOpenChange={() => {}} configuration={GEMINI_CONFIGURATION} />
      </Wrapper>,
    );

    await flushUntil(() => lastFrame()?.includes(geminiName("gemini-2.5-flash")) ?? false);
    const frame = lastFrame() ?? "";
    expect(frame).toContain("gemini-2.5-flash");
    expect(frame).toContain("1 model");
    expect(frame).not.toContain("Using cached catalog data");
    expect(testConfiguration).toHaveBeenCalledWith("gemini-primary");
  });
});

describe("ModelSelectOverlay family-specific discovery", () => {
  afterEach(() => {
    cleanup();
  });

  test("shows local loopback evidence for local-http configurations", async () => {
    const localConfiguration = {
      configurationId: "ollama-loopback",
      revision: 2,
      status: "supported",
      transportFamily: "local-http",
      productId: "ollama",
      endpoint: "http://127.0.0.1:11434",
      authentication: "none",
      selectedModelId: "qwen2.5-coder:7b",
      notices: [copyNotice("ollama")],
      availableActions: ["inspect", "select", "test", "update", "delete"],
    } satisfies SupportedConfigurationSummary;
    const testConfiguration = vi
      .fn<BoundApi["testConfiguration"]>()
      .mockResolvedValue(testDiscoveryResponse(localConfiguration, readyFor("ollama")));
    const api = {
      ...createApi({ baseUrl: "http://localhost" }),
      testConfiguration,
    } satisfies BoundApi;
    const { lastFrame } = render(
      <Wrapper api={api}>
        <ModelSelectOverlay open onOpenChange={() => {}} configuration={localConfiguration} />
      </Wrapper>,
    );

    await flushUntil(() => lastFrame()?.includes("qwen2.5-coder:7b") ?? false);
    expect(lastFrame()).toContain("Exact loopbac");
  });
});
