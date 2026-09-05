import { type BoundApi, createApi } from "@diffgazer/core/api";
import { ApiProvider } from "@diffgazer/core/api/hooks";
import type {
  ClientConfigurationSummary,
  ConfigurationModelsResponse,
  ModelInfo,
} from "@diffgazer/core/schemas/config";
import {
  GEMINI_CONFIGURATION,
  OPENCODE_ZEN_CONFIGURATION,
} from "@diffgazer/core/testing/provider-fixtures";
import { QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render } from "ink-testing-library";
import type { ReactNode } from "react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { createTestQueryClient } from "../../../../testing/query-client";
import { waitUntil } from "../../../../testing/wait-until";
import { CliThemeProvider } from "../../../../theme/provider";
import { ModelStep } from "./model-step";

const terminalDimensions = vi.hoisted(() => ({ current: { columns: 80, rows: 24 } }));

vi.mock("../../../../hooks/use-terminal-dimensions", () => ({
  useTerminalDimensions: () => terminalDimensions.current,
}));

const DRAFT_CONFIGURATION: ClientConfigurationSummary = {
  ...GEMINI_CONFIGURATION,
  selectedModelId: null,
};

function catalogModelsResponse(
  configuration: ClientConfigurationSummary,
  models: ModelInfo[],
): ConfigurationModelsResponse {
  return {
    status: "passed",
    configurationId: configuration.configurationId,
    productId: configuration.productId,
    transportFamily: configuration.transportFamily,
    models,
    checkedAt: "2026-07-31T12:00:00.000Z",
    source: "snapshot",
    cached: false,
  };
}

function catalogModel(modelId: string, overrides: Partial<ModelInfo> = {}): ModelInfo {
  return { id: modelId, name: modelId, description: "1M context", tier: "paid", ...overrides };
}

function Wrapper({ children, api }: { children: ReactNode; api: BoundApi }) {
  const queryClient = createTestQueryClient();
  return (
    <QueryClientProvider client={queryClient}>
      <ApiProvider value={api}>
        <CliThemeProvider initialTheme="dark">{children}</CliThemeProvider>
      </ApiProvider>
    </QueryClientProvider>
  );
}

function makeApi(getConfigurationModels: BoundApi["getConfigurationModels"]): BoundApi {
  return {
    ...createApi({ baseUrl: "http://localhost" }),
    getConfigurationModels,
  } satisfies BoundApi;
}

describe("ModelStep (TUI catalog)", () => {
  afterEach(() => {
    cleanup();
    terminalDimensions.current = { columns: 80, rows: 24 };
  });

  test("discovers models against the persisted draft configuration id", async () => {
    const getConfigurationModels = vi
      .fn<BoundApi["getConfigurationModels"]>()
      .mockResolvedValue(
        catalogModelsResponse(DRAFT_CONFIGURATION, [catalogModel("gemini-2.5-flash")]),
      );

    const { lastFrame } = render(
      <Wrapper api={makeApi(getConfigurationModels)}>
        <ModelStep
          configuration={DRAFT_CONFIGURATION}
          isPreparing={false}
          onRetry={() => {}}
          value="gemini-2.5-flash"
          onChange={() => {}}
        />
      </Wrapper>,
    );

    await waitUntil(() => lastFrame()?.includes("gemini-2.5-flash") ?? false, { intervalMs: 0 });
    expect(lastFrame() ?? "").toContain("gemini-2.5-flash");
    expect(getConfigurationModels).toHaveBeenCalledWith(
      DRAFT_CONFIGURATION.configurationId,
      expect.any(AbortSignal),
    );
  });

  test("keeps discovering while the step is not focused", async () => {
    const getConfigurationModels = vi
      .fn<BoundApi["getConfigurationModels"]>()
      .mockResolvedValue(
        catalogModelsResponse(DRAFT_CONFIGURATION, [catalogModel("gemini-2.5-flash")]),
      );

    const { lastFrame } = render(
      <Wrapper api={makeApi(getConfigurationModels)}>
        <ModelStep
          configuration={DRAFT_CONFIGURATION}
          isPreparing={false}
          onRetry={() => {}}
          onChange={() => {}}
          isActive={false}
        />
      </Wrapper>,
    );

    await waitUntil(() => lastFrame()?.includes("gemini-2.5-flash") ?? false, { intervalMs: 0 });
    expect(lastFrame() ?? "").toContain("gemini-2.5-flash");
    expect(getConfigurationModels).toHaveBeenCalledTimes(1);
  });

  test("waits for the draft configuration instead of inventing one", () => {
    const getConfigurationModels = vi.fn<BoundApi["getConfigurationModels"]>();

    const { lastFrame } = render(
      <Wrapper api={makeApi(getConfigurationModels)}>
        <ModelStep configuration={null} isPreparing onRetry={() => {}} onChange={() => {}} />
      </Wrapper>,
    );

    expect(lastFrame() ?? "").toContain("Preparing configuration");
    expect(getConfigurationModels).not.toHaveBeenCalled();
  });

  test("retries draft preparation from the failed state", async () => {
    const onRetry = vi.fn();
    const { lastFrame, stdin } = render(
      <Wrapper api={makeApi(vi.fn<BoundApi["getConfigurationModels"]>())}>
        <ModelStep configuration={null} isPreparing={false} onRetry={onRetry} onChange={() => {}} />
      </Wrapper>,
    );

    await waitUntil(() => lastFrame()?.includes("Press r to retry") ?? false, { intervalMs: 0 });
    stdin.write("r");
    await waitUntil(() => onRetry.mock.calls.length > 0, { intervalMs: 0 });
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  test("offers retry as a chain control that Enter runs and ArrowDown leaves", async () => {
    const onRetry = vi.fn();
    const onDownBoundary = vi.fn();
    const { lastFrame, stdin } = render(
      <Wrapper api={makeApi(vi.fn<BoundApi["getConfigurationModels"]>())}>
        <ModelStep
          configuration={null}
          isPreparing={false}
          onRetry={onRetry}
          onChange={() => {}}
          onDownBoundary={onDownBoundary}
        />
      </Wrapper>,
    );

    await waitUntil(() => lastFrame()?.includes("Retry") ?? false, { intervalMs: 0 });
    stdin.write("\r");
    await waitUntil(() => onRetry.mock.calls.length > 0, { intervalMs: 0 });
    expect(onRetry).toHaveBeenCalledTimes(1);

    stdin.write("\u001b[B");
    await waitUntil(() => onDownBoundary.mock.calls.length > 0, { intervalMs: 0 });
    expect(onDownBoundary).toHaveBeenCalledTimes(1);
  });

  test("offers retry without manual model entry when discovery fails", async () => {
    const getConfigurationModels = vi
      .fn<BoundApi["getConfigurationModels"]>()
      .mockRejectedValueOnce(new Error("catalog unavailable"))
      .mockResolvedValueOnce(
        catalogModelsResponse(DRAFT_CONFIGURATION, [catalogModel("gemini-2.5-flash")]),
      );

    const { lastFrame, stdin } = render(
      <Wrapper api={makeApi(getConfigurationModels)}>
        <ModelStep
          configuration={DRAFT_CONFIGURATION}
          isPreparing={false}
          onRetry={() => {}}
          onChange={() => {}}
        />
      </Wrapper>,
    );

    await waitUntil(() => lastFrame()?.includes("Model discovery failed") ?? false, {
      intervalMs: 0,
    });
    expect(lastFrame()).toContain("Press r to retry");
    stdin.write("r");
    await waitUntil(() => lastFrame()?.includes("gemini-2.5-flash") ?? false, { intervalMs: 0 });
    expect(getConfigurationModels).toHaveBeenCalledTimes(2);
  });

  test("shows the skipped catalog reason without inventing models", async () => {
    const getConfigurationModels = vi.fn<BoundApi["getConfigurationModels"]>().mockResolvedValue({
      status: "skipped",
      configurationId: DRAFT_CONFIGURATION.configurationId,
      productId: DRAFT_CONFIGURATION.productId,
      transportFamily: DRAFT_CONFIGURATION.transportFamily,
      models: [],
      checkedAt: "2026-07-31T12:00:00.000Z",
      reason:
        "The catalog lists no model this product's model policy admits. Configure a different provider to run reviews.",
    });

    const { lastFrame } = render(
      <Wrapper api={makeApi(getConfigurationModels)}>
        <ModelStep
          configuration={DRAFT_CONFIGURATION}
          isPreparing={false}
          onRetry={() => {}}
          onChange={() => {}}
        />
      </Wrapper>,
    );

    await waitUntil(() => lastFrame()?.includes("no model this product") ?? false, {
      intervalMs: 0,
    });
    expect(lastFrame()).not.toMatch(/api key/i);
  });

  // The catalog publishes several routes under one display name, so a picker
  // that shows names alone cannot say which id the wizard is about to save.
  test("keeps both exact ids visible when two models share a display name", async () => {
    const getConfigurationModels = vi
      .fn<BoundApi["getConfigurationModels"]>()
      .mockResolvedValue(
        catalogModelsResponse(DRAFT_CONFIGURATION, [
          catalogModel("google/gemini-3-pro-image", { name: "Nano Banana Pro" }),
          catalogModel("google/gemini-3-pro-image-preview", { name: "Nano Banana Pro" }),
        ]),
      );

    const { lastFrame } = render(
      <Wrapper api={makeApi(getConfigurationModels)}>
        <ModelStep
          configuration={DRAFT_CONFIGURATION}
          isPreparing={false}
          onRetry={() => {}}
          onChange={() => {}}
        />
      </Wrapper>,
    );

    await waitUntil(() => lastFrame()?.includes("Nano Banana Pro") ?? false, { intervalMs: 0 });
    const frame = lastFrame() ?? "";
    expect(frame).toContain("google/gemini-3-pro-image · 1M context");
    expect(frame).toContain("google/gemini-3-pro-image-preview · 1M context");
  });

  // Products that publish neither a distinct id nor a description render one
  // line per row, so the picker must offer every row the terminal has space for.
  test("fills the viewport when the catalog publishes no per-row detail", async () => {
    terminalDimensions.current = { columns: 80, rows: 30 };
    const models = Array.from({ length: 18 }, (_, index) =>
      catalogModel(`bare-model-${index}`, { description: "" }),
    );
    const getConfigurationModels = vi
      .fn<BoundApi["getConfigurationModels"]>()
      .mockResolvedValue(catalogModelsResponse(DRAFT_CONFIGURATION, models));

    const { lastFrame } = render(
      <Wrapper api={makeApi(getConfigurationModels)}>
        <ModelStep
          configuration={DRAFT_CONFIGURATION}
          isPreparing={false}
          onRetry={() => {}}
          onChange={() => {}}
        />
      </Wrapper>,
    );

    await waitUntil(() => lastFrame()?.includes("bare-model-0") ?? false, { intervalMs: 0 });
    expect(lastFrame() ?? "").toContain("bare-model-17");
  });

  test("badges each row from that model's own catalog price", async () => {
    const getConfigurationModels = vi
      .fn<BoundApi["getConfigurationModels"]>()
      .mockResolvedValue(
        catalogModelsResponse(DRAFT_CONFIGURATION, [
          catalogModel("priced-model", { tier: "paid" }),
          catalogModel("zero-priced-model", { tier: "free" }),
          catalogModel("unpriced-model", { tier: "unknown" }),
        ]),
      );

    const { lastFrame } = render(
      <Wrapper api={makeApi(getConfigurationModels)}>
        <ModelStep
          configuration={DRAFT_CONFIGURATION}
          isPreparing={false}
          onRetry={() => {}}
          onChange={() => {}}
        />
      </Wrapper>,
    );

    await waitUntil(() => lastFrame()?.includes("unpriced-model") ?? false, { intervalMs: 0 });
    const frame = lastFrame() ?? "";
    expect(frame).toContain("[PAID]");
    expect(frame).toContain("[FREE]");
    // The unpriced row wears no badge at all rather than guessing either one.
    expect(frame.match(/\[(PAID|FREE)]/g)).toHaveLength(2);
  });

  // The wizard binds the pool a step earlier, in the create dialog's endpoint
  // choice, so this step only names the pool each row will bill.
  test("names the pool each wizard row will bill", async () => {
    const getConfigurationModels = vi
      .fn<BoundApi["getConfigurationModels"]>()
      .mockResolvedValue(
        catalogModelsResponse(OPENCODE_ZEN_CONFIGURATION, [
          catalogModel("deepseek-v4-flash", { endpointProfileIds: ["zen", "go"] }),
          catalogModel("go-only-model", { endpointProfileIds: ["go"] }),
        ]),
      );

    const { lastFrame } = render(
      <Wrapper api={makeApi(getConfigurationModels)}>
        <ModelStep
          configuration={OPENCODE_ZEN_CONFIGURATION}
          isPreparing={false}
          onRetry={() => {}}
          onChange={() => {}}
        />
      </Wrapper>,
    );

    await waitUntil(() => lastFrame()?.includes("go-only-model") ?? false, { intervalMs: 0 });
    const frame = lastFrame() ?? "";
    // The shared row bills the bound pool; the Go-only row bills its own. The
    // step offers no pool control: the endpoint was chosen before it.
    expect(frame).toContain("[Zen]");
    expect(frame).toContain("[Go]");
    // Badges only: the settings overlay's armed-pool row (" · Zen" / " · Go")
    // and its [p] accelerator must not appear here, or the wallet would be
    // choosable twice in one wizard.
    expect(frame).not.toContain("· Zen");
    expect(frame).not.toContain("· Go");
    expect(frame).not.toContain("Pool");
  });

  test("tags no row for a single-endpoint product", async () => {
    const getConfigurationModels = vi
      .fn<BoundApi["getConfigurationModels"]>()
      .mockResolvedValue(
        catalogModelsResponse(DRAFT_CONFIGURATION, [catalogModel("gemini-2.5-flash")]),
      );

    const { lastFrame } = render(
      <Wrapper api={makeApi(getConfigurationModels)}>
        <ModelStep
          configuration={DRAFT_CONFIGURATION}
          isPreparing={false}
          onRetry={() => {}}
          onChange={() => {}}
        />
      </Wrapper>,
    );

    await waitUntil(() => lastFrame()?.includes("gemini-2.5-flash") ?? false, { intervalMs: 0 });
    expect(lastFrame() ?? "").not.toContain("[Zen]");
    expect(lastFrame() ?? "").not.toContain("[Go]");
  });
});
