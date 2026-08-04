import "../testing/terminal-mock";
import { type BoundApi, createApi } from "@diffgazer/core/api";
import type { SupportedConfigurationSummary } from "@diffgazer/core/testing/provider-fixtures";
import { cleanup, render } from "ink-testing-library";
import { afterEach, describe, expect, test, vi } from "vitest";
import {
  catalogModelsResponse,
  copyNotice,
  flushUntil,
  GEMINI_CONFIGURATION,
  geminiName,
  skippedCatalogModelsResponse,
  Wrapper,
} from "../testing/model-select-overlay";
import { ModelSelectOverlay } from "./model-select-overlay";

const CATALOG_SKIPPED_REASON =
  "Catalog observations are unavailable for this configuration product.";

describe("ModelSelectOverlay discovery provenance", () => {
  afterEach(() => {
    cleanup();
  });

  test("shows the skipped catalog reason, checkedAt, and retry hint", async () => {
    const getConfigurationModels = vi
      .fn<BoundApi["getConfigurationModels"]>()
      .mockResolvedValue(
        skippedCatalogModelsResponse(GEMINI_CONFIGURATION, CATALOG_SKIPPED_REASON),
      );
    const api = {
      ...createApi({ baseUrl: "http://localhost" }),
      getConfigurationModels,
    } satisfies BoundApi;
    const { lastFrame } = render(
      <Wrapper api={api}>
        <ModelSelectOverlay open onOpenChange={() => {}} configuration={GEMINI_CONFIGURATION} />
      </Wrapper>,
    );

    await flushUntil(() => lastFrame()?.includes("Catalog observations are unavailable") ?? false);
    const frame = lastFrame() ?? "";
    expect(frame).toContain("gemini");
    expect(frame).toContain("checked");
    expect(frame).toContain("Press r to retry");
    expect(frame).not.toContain("structured outputs");
  });

  test("retries discovery with r after a rejected query", async () => {
    const getConfigurationModels = vi
      .fn<BoundApi["getConfigurationModels"]>()
      .mockRejectedValueOnce(new Error("Model discovery failed. Test the configuration again."))
      .mockResolvedValueOnce(catalogModelsResponse(GEMINI_CONFIGURATION));
    const api = {
      ...createApi({ baseUrl: "http://localhost" }),
      getConfigurationModels,
    } satisfies BoundApi;
    const { lastFrame, stdin } = render(
      <Wrapper api={api}>
        <ModelSelectOverlay open onOpenChange={() => {}} configuration={GEMINI_CONFIGURATION} />
      </Wrapper>,
    );

    await flushUntil(() => lastFrame()?.includes("Model discovery failed") ?? false);
    stdin.write("r");
    await flushUntil(() => lastFrame()?.includes(geminiName("gemini-2.5-flash")) ?? false);
    expect(getConfigurationModels).toHaveBeenCalledTimes(2);
  });

  test("renders the catalog candidate models without admission claims", async () => {
    const getConfigurationModels = vi
      .fn<BoundApi["getConfigurationModels"]>()
      .mockResolvedValue(catalogModelsResponse(GEMINI_CONFIGURATION));
    const api = {
      ...createApi({ baseUrl: "http://localhost" }),
      getConfigurationModels,
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
    expect(getConfigurationModels).toHaveBeenCalledWith("gemini-primary");
  });
});

describe("ModelSelectOverlay family-specific discovery", () => {
  afterEach(() => {
    cleanup();
  });

  test("shows the honest catalog-unavailable reason for local transports", async () => {
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
    const getConfigurationModels = vi
      .fn<BoundApi["getConfigurationModels"]>()
      .mockResolvedValue(skippedCatalogModelsResponse(localConfiguration, CATALOG_SKIPPED_REASON));
    const api = {
      ...createApi({ baseUrl: "http://localhost" }),
      getConfigurationModels,
    } satisfies BoundApi;
    const { lastFrame } = render(
      <Wrapper api={api}>
        <ModelSelectOverlay open onOpenChange={() => {}} configuration={localConfiguration} />
      </Wrapper>,
    );

    await flushUntil(() => lastFrame()?.includes("Catalog observations are unavailable") ?? false);
    const frame = lastFrame() ?? "";
    expect(frame).toContain("ollama");
    expect(frame).toContain("Press r to retry");
    expect(frame).not.toContain("qwen2.5-coder:7b");
  });
});
