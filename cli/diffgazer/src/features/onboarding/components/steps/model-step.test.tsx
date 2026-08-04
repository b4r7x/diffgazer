import { type BoundApi, createApi } from "@diffgazer/core/api";
import { ApiProvider } from "@diffgazer/core/api/hooks";
import type { ConfigurationModelsResponse } from "@diffgazer/core/schemas/config";
import {
  READY_GEMINI_CONFIGURATION,
  type SupportedConfigurationSummary,
} from "@diffgazer/core/testing/provider-fixtures";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render } from "ink-testing-library";
import type { ReactNode } from "react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { CliThemeProvider } from "../../../../theme/provider";
import { ModelStep } from "./model-step";

const terminalDimensions = vi.hoisted(() => ({ current: { columns: 80, rows: 24 } }));

vi.mock("../../../../hooks/use-terminal-dimensions", () => ({
  useTerminalDimensions: () => terminalDimensions.current,
}));

const DRAFT_CONFIGURATION: SupportedConfigurationSummary = {
  ...READY_GEMINI_CONFIGURATION,
  selectedModelId: null,
};

function catalogModelsResponse(
  configuration: SupportedConfigurationSummary,
  modelId: string,
): ConfigurationModelsResponse {
  return {
    status: "passed",
    configurationId: configuration.configurationId,
    productId: configuration.productId,
    transportFamily: configuration.transportFamily,
    models: [{ id: modelId, name: modelId, description: "1M context", tier: "paid" }],
    checkedAt: "2026-07-31T12:00:00.000Z",
    source: "snapshot",
    cached: false,
  };
}

async function flushUntil(predicate: () => boolean, attempts = 200): Promise<void> {
  for (let i = 0; i < attempts; i += 1) {
    if (predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
}

function makeQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, networkMode: "always" },
      mutations: { retry: false, networkMode: "always" },
    },
  });
}

function Wrapper({ children, api }: { children: ReactNode; api: BoundApi }) {
  const queryClient = makeQueryClient();
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
      .mockResolvedValue(catalogModelsResponse(DRAFT_CONFIGURATION, "gemini-2.5-flash"));

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

    await flushUntil(() => lastFrame()?.includes("gemini-2.5-flash") ?? false);
    expect(lastFrame() ?? "").toContain("gemini-2.5-flash");
    expect(getConfigurationModels).toHaveBeenCalledWith(DRAFT_CONFIGURATION.configurationId);
  });

  test("keeps discovering while the step is not focused", async () => {
    const getConfigurationModels = vi
      .fn<BoundApi["getConfigurationModels"]>()
      .mockResolvedValue(catalogModelsResponse(DRAFT_CONFIGURATION, "gemini-2.5-flash"));

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

    await flushUntil(() => lastFrame()?.includes("gemini-2.5-flash") ?? false);
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

    await flushUntil(() => lastFrame()?.includes("Press r to retry") ?? false);
    stdin.write("r");
    await flushUntil(() => onRetry.mock.calls.length > 0);
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  test("offers retry without manual model entry when discovery fails", async () => {
    const getConfigurationModels = vi
      .fn<BoundApi["getConfigurationModels"]>()
      .mockRejectedValueOnce(new Error("catalog unavailable"))
      .mockResolvedValueOnce(catalogModelsResponse(DRAFT_CONFIGURATION, "gemini-2.5-flash"));

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

    await flushUntil(() => lastFrame()?.includes("Model discovery failed") ?? false);
    expect(lastFrame()).toContain("Press r to retry");
    stdin.write("r");
    await flushUntil(() => lastFrame()?.includes("gemini-2.5-flash") ?? false);
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
      reason: "Catalog observations are unavailable for this configuration product.",
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

    await flushUntil(() => lastFrame()?.includes("Catalog observations are unavailable") ?? false);
    expect(lastFrame()).not.toMatch(/api key/i);
  });
});
