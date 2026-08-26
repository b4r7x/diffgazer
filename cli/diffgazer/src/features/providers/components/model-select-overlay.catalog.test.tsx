import "../testing/terminal-mock";
import { type BoundApi, createApi } from "@diffgazer/core/api";
import { GEMINI_CONFIGURATION } from "@diffgazer/core/testing/provider-fixtures";
import { cleanup, render } from "ink-testing-library";
import { afterEach, describe, expect, test, vi } from "vitest";
import {
  catalogModelsResponse,
  flushUntil,
  geminiName,
  skippedCatalogModelsResponse,
  Wrapper,
} from "../testing/model-select-overlay";
import { ModelSelectOverlay } from "./model-select-overlay";

const CATALOG_EMPTY_MODELS_REASON =
  "The catalog lists no model this product's model policy admits. Configure a different provider to run reviews.";

describe("ModelSelectOverlay discovery provenance", () => {
  afterEach(() => {
    cleanup();
  });

  test("shows the skipped catalog reason, checkedAt, and retry hint", async () => {
    const getConfigurationModels = vi
      .fn<BoundApi["getConfigurationModels"]>()
      .mockResolvedValue(
        skippedCatalogModelsResponse(GEMINI_CONFIGURATION, CATALOG_EMPTY_MODELS_REASON),
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

    await flushUntil(() => lastFrame()?.includes("no model this product") ?? false);
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
    expect(getConfigurationModels).toHaveBeenCalledWith("gemini-primary", expect.any(AbortSignal));
  });

  // The snapshot tier's fetchedAt is stamped at read time, so a checked date
  // over bundled data would be fabricated; the label names the data instead.
  test("labels the bundled snapshot tier instead of claiming a checked date", async () => {
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
    expect(frame).toContain("bundled catalog");
    expect(frame).not.toContain("checked");
  });

  test("keeps the checked date for a live provider list", async () => {
    const getConfigurationModels = vi
      .fn<BoundApi["getConfigurationModels"]>()
      .mockResolvedValue(catalogModelsResponse(GEMINI_CONFIGURATION, undefined, "provider-live"));
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
    expect(frame).toContain("checked");
    expect(frame).not.toContain("bundled catalog");
  });
});

describe("ModelSelectOverlay retained selection", () => {
  afterEach(() => {
    cleanup();
  });

  // A configuration saved before the capability filter existed keeps working;
  // the overlay says so instead of leaving the missing row unexplained.
  test("explains a saved model the review-capable list no longer offers", async () => {
    const getConfigurationModels = vi
      .fn<BoundApi["getConfigurationModels"]>()
      .mockResolvedValue(catalogModelsResponse(GEMINI_CONFIGURATION));
    const api = {
      ...createApi({ baseUrl: "http://localhost" }),
      getConfigurationModels,
    } satisfies BoundApi;
    const { lastFrame } = render(
      <Wrapper api={api}>
        <ModelSelectOverlay
          open
          onOpenChange={() => {}}
          configuration={GEMINI_CONFIGURATION}
          selectedId="retired-model-id"
        />
      </Wrapper>,
    );

    await flushUntil(() => lastFrame()?.includes("stays configured") ?? false);
    expect(lastFrame() ?? "").toContain("retired-model-id");
  });

  test("says nothing about the saved model while it is still offered", async () => {
    const getConfigurationModels = vi
      .fn<BoundApi["getConfigurationModels"]>()
      .mockResolvedValue(catalogModelsResponse(GEMINI_CONFIGURATION));
    const api = {
      ...createApi({ baseUrl: "http://localhost" }),
      getConfigurationModels,
    } satisfies BoundApi;
    const { lastFrame } = render(
      <Wrapper api={api}>
        <ModelSelectOverlay
          open
          onOpenChange={() => {}}
          configuration={GEMINI_CONFIGURATION}
          selectedId="gemini-2.5-flash"
        />
      </Wrapper>,
    );

    await flushUntil(() => lastFrame()?.includes(geminiName("gemini-2.5-flash")) ?? false);
    expect(lastFrame() ?? "").not.toContain("stays configured");
  });
});
