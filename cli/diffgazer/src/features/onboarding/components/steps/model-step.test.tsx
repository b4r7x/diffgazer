import { type BoundApi, createApi } from "@diffgazer/core/api";
import { ApiProvider } from "@diffgazer/core/api/hooks";
import { PRODUCT_REGISTRY } from "@diffgazer/core/providers";
import type {
  ClientConfigurationActionResponse,
  RunnableProductId,
} from "@diffgazer/core/schemas/config";
import { READINESS_PRESENTATION, ReadinessSchema } from "@diffgazer/core/schemas/config";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render } from "ink-testing-library";
import type { ReactNode } from "react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { CliThemeProvider } from "../../../../theme/provider";
import {
  READY_GEMINI_CONFIGURATION,
  type SupportedConfigurationSummary,
} from "../../../providers/testing/fixtures";
import { ModelStep } from "./model-step";

const terminalDimensions = vi.hoisted(() => ({ current: { columns: 80, rows: 24 } }));

vi.mock("../../../../hooks/use-terminal-dimensions", () => ({
  useTerminalDimensions: () => terminalDimensions.current,
}));

const DRAFT_CONFIGURATION: SupportedConfigurationSummary = {
  ...READY_GEMINI_CONFIGURATION,
  selectedModelId: null,
};

function acknowledgementRequired(productId: RunnableProductId) {
  const notice = PRODUCT_REGISTRY[productId].notice;
  return ReadinessSchema.parse({
    status: "acknowledgement-required",
    ready: false,
    evidenceStatus: "passed",
    checkedAt: "2026-07-31T12:00:00.000Z",
    acknowledgement: {
      status: "required",
      noticeId: notice.id,
      noticeVersion: notice.noticeVersion,
    },
    ...READINESS_PRESENTATION["acknowledgement-required"],
  });
}

function discoveryResponse(
  configuration: SupportedConfigurationSummary,
  selectedModelId: string,
): ClientConfigurationActionResponse {
  return {
    action: "test",
    status: "succeeded",
    configuration: { ...configuration, selectedModelId },
    readiness: acknowledgementRequired(configuration.productId),
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

function makeApi(testConfiguration: BoundApi["testConfiguration"]): BoundApi {
  return { ...createApi({ baseUrl: "http://localhost" }), testConfiguration } satisfies BoundApi;
}

describe("ModelStep (TUI catalog)", () => {
  afterEach(() => {
    cleanup();
    terminalDimensions.current = { columns: 80, rows: 24 };
  });

  test("discovers models against the persisted draft configuration id", async () => {
    const testConfiguration = vi
      .fn<BoundApi["testConfiguration"]>()
      .mockResolvedValue(
        discoveryResponse(DRAFT_CONFIGURATION, "gemini-2.5-flash") as Awaited<
          ReturnType<BoundApi["testConfiguration"]>
        >,
      );

    const { lastFrame } = render(
      <Wrapper api={makeApi(testConfiguration)}>
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
    expect(testConfiguration).toHaveBeenCalledWith(DRAFT_CONFIGURATION.configurationId);
  });

  test("keeps discovering while the step is not focused", async () => {
    const testConfiguration = vi
      .fn<BoundApi["testConfiguration"]>()
      .mockResolvedValue(
        discoveryResponse(DRAFT_CONFIGURATION, "gemini-2.5-flash") as Awaited<
          ReturnType<BoundApi["testConfiguration"]>
        >,
      );

    const { lastFrame } = render(
      <Wrapper api={makeApi(testConfiguration)}>
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
    expect(testConfiguration).toHaveBeenCalledTimes(1);
  });

  test("waits for the draft configuration instead of inventing one", () => {
    const testConfiguration = vi.fn<BoundApi["testConfiguration"]>();

    const { lastFrame } = render(
      <Wrapper api={makeApi(testConfiguration)}>
        <ModelStep configuration={null} isPreparing onRetry={() => {}} onChange={() => {}} />
      </Wrapper>,
    );

    expect(lastFrame() ?? "").toContain("Preparing configuration");
    expect(testConfiguration).not.toHaveBeenCalled();
  });

  test("retries draft preparation from the failed state", async () => {
    const onRetry = vi.fn();
    const { lastFrame, stdin } = render(
      <Wrapper api={makeApi(vi.fn<BoundApi["testConfiguration"]>())}>
        <ModelStep configuration={null} isPreparing={false} onRetry={onRetry} onChange={() => {}} />
      </Wrapper>,
    );

    await flushUntil(() => lastFrame()?.includes("Press r to retry") ?? false);
    stdin.write("r");
    await flushUntil(() => onRetry.mock.calls.length > 0);
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  test("offers retry without manual model entry when discovery fails", async () => {
    const testConfiguration = vi
      .fn<BoundApi["testConfiguration"]>()
      .mockRejectedValueOnce(new Error("catalog unavailable"))
      .mockResolvedValueOnce(
        discoveryResponse(DRAFT_CONFIGURATION, "gemini-2.5-flash") as Awaited<
          ReturnType<BoundApi["testConfiguration"]>
        >,
      );

    const { lastFrame, stdin } = render(
      <Wrapper api={makeApi(testConfiguration)}>
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
    expect(testConfiguration).toHaveBeenCalledTimes(2);
  });

  test("shows remediation when discovery is skipped", async () => {
    const testConfiguration = vi.fn<BoundApi["testConfiguration"]>().mockResolvedValue({
      action: "test",
      status: "succeeded",
      configuration: DRAFT_CONFIGURATION,
      readiness: ReadinessSchema.parse({
        status: "skipped",
        ready: false,
        evidenceStatus: "skipped",
        checkedAt: "2026-07-31T12:00:00.000Z",
        acknowledgement: { status: "not-applicable" },
        ...READINESS_PRESENTATION.skipped,
      }),
    });

    const { lastFrame } = render(
      <Wrapper api={makeApi(testConfiguration)}>
        <ModelStep
          configuration={DRAFT_CONFIGURATION}
          isPreparing={false}
          onRetry={() => {}}
          onChange={() => {}}
        />
      </Wrapper>,
    );

    await flushUntil(
      () => lastFrame()?.includes("live readiness check was intentionally skipped") ?? false,
    );
    expect(lastFrame()).not.toMatch(/api key/i);
  });
});
