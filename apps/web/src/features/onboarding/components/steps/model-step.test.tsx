import { type BoundApi, createApi } from "@diffgazer/core/api";
import { ApiProvider } from "@diffgazer/core/api/hooks";
import { FooterProvider } from "@diffgazer/core/footer";
import type {
  ClientConfigurationSummary,
  ConfigurationModelsResponse,
} from "@diffgazer/core/schemas/config";
import { READY_GEMINI_CONFIGURATION } from "@diffgazer/core/testing/provider-fixtures";
import { KeyboardProvider } from "@diffgazer/keys";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { ModelStep } from "./model-step";

type SupportedConfigurationSummary = Extract<ClientConfigurationSummary, { status: "supported" }>;

const GEMINI_CONFIGURATION = READY_GEMINI_CONFIGURATION as SupportedConfigurationSummary;

function geminiModelsResponse(): ConfigurationModelsResponse {
  return {
    status: "passed",
    configurationId: GEMINI_CONFIGURATION.configurationId,
    productId: GEMINI_CONFIGURATION.productId,
    transportFamily: GEMINI_CONFIGURATION.transportFamily,
    models: [
      { id: "gemini-2.5-flash", name: "gemini-2.5-flash", description: "1M context", tier: "paid" },
    ],
    checkedAt: "2026-08-02T12:00:00.000Z",
    source: "snapshot",
    cached: false,
  };
}

function makeWrapper(api: BoundApi) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <ApiProvider value={api}>
        <FooterProvider>
          <KeyboardProvider>{children}</KeyboardProvider>
        </FooterProvider>
      </ApiProvider>
    </QueryClientProvider>
  );
}

function apiWithModels(getConfigurationModels: BoundApi["getConfigurationModels"]): BoundApi {
  return {
    ...createApi({ baseUrl: "http://localhost" }),
    getConfigurationModels,
  } satisfies BoundApi;
}

describe("ModelStep", () => {
  it("lists the models discovered for the prepared configuration", async () => {
    const api = apiWithModels(
      vi.fn<BoundApi["getConfigurationModels"]>().mockResolvedValue(geminiModelsResponse()),
    );

    render(
      <ModelStep
        configuration={GEMINI_CONFIGURATION}
        isPreparing={false}
        onRetry={vi.fn()}
        value={null}
        onChange={vi.fn()}
        onCommit={vi.fn()}
      />,
      { wrapper: makeWrapper(api) },
    );

    expect(await screen.findByRole("radio", { name: /gemini-2\.5-flash/i })).toBeInTheDocument();
    expect(screen.queryByRole("textbox", { name: /model id/i })).not.toBeInTheDocument();
  });

  it("waits for the wizard to prepare a configuration before discovering models", () => {
    const getConfigurationModels = vi.fn<BoundApi["getConfigurationModels"]>();
    const onRetry = vi.fn();

    const { rerender } = render(
      <ModelStep
        configuration={null}
        isPreparing
        onRetry={onRetry}
        value={null}
        onChange={vi.fn()}
      />,
      { wrapper: makeWrapper(apiWithModels(getConfigurationModels)) },
    );

    expect(screen.getByRole("status")).toHaveTextContent(/preparing this configuration/i);

    rerender(
      <ModelStep
        configuration={null}
        isPreparing={false}
        onRetry={onRetry}
        value={null}
        onChange={vi.fn()}
      />,
    );

    expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument();
    expect(getConfigurationModels).not.toHaveBeenCalled();
  });

  it("announces discovery failures, focuses retry, and retries without manual entry", async () => {
    const user = userEvent.setup();
    const getConfigurationModels = vi
      .fn<BoundApi["getConfigurationModels"]>()
      .mockRejectedValueOnce(new Error("catalog unavailable"))
      .mockResolvedValue(geminiModelsResponse());

    render(
      <ModelStep
        configuration={GEMINI_CONFIGURATION}
        isPreparing={false}
        onRetry={vi.fn()}
        value={null}
        onChange={vi.fn()}
        onCommit={vi.fn()}
      />,
      { wrapper: makeWrapper(apiWithModels(getConfigurationModels)) },
    );

    expect(await screen.findByRole("alert")).toHaveTextContent(/Model discovery failed/i);
    expect(screen.queryByRole("textbox", { name: "Model ID" })).not.toBeInTheDocument();
    const retry = screen.getByRole("button", { name: "Retry" });
    await waitFor(() => expect(retry).toHaveFocus());

    await user.click(retry);
    expect(await screen.findByRole("radio", { name: /gemini-2\.5-flash/i })).toBeInTheDocument();
  });

  it("commits the selected exact model when Enter is pressed", async () => {
    const user = userEvent.setup();
    const onCommit = vi.fn();
    const api = apiWithModels(
      vi.fn<BoundApi["getConfigurationModels"]>().mockResolvedValue(geminiModelsResponse()),
    );

    render(
      <ModelStep
        configuration={GEMINI_CONFIGURATION}
        isPreparing={false}
        onRetry={vi.fn()}
        value="gemini-2.5-flash"
        onChange={vi.fn()}
        onCommit={onCommit}
      />,
      { wrapper: makeWrapper(api) },
    );

    const modelGroup = await screen.findByRole("radiogroup", { name: /available models/i });
    const selectedRadio = within(modelGroup).getByRole("radio", { name: /gemini-2\.5-flash/i });
    selectedRadio.focus();
    await user.keyboard("{Enter}");
    expect(onCommit).toHaveBeenCalledWith("gemini-2.5-flash");
  });

  it("shows the skipped catalog reason without exposing fabricated models", async () => {
    const api = apiWithModels(
      vi.fn<BoundApi["getConfigurationModels"]>().mockResolvedValue({
        status: "skipped",
        configurationId: GEMINI_CONFIGURATION.configurationId,
        productId: GEMINI_CONFIGURATION.productId,
        transportFamily: GEMINI_CONFIGURATION.transportFamily,
        models: [],
        checkedAt: "2026-08-02T12:00:00.000Z",
        reason: "No catalog models are available for this configuration product.",
      }),
    );

    render(
      <ModelStep
        configuration={GEMINI_CONFIGURATION}
        isPreparing={false}
        onRetry={vi.fn()}
        value={null}
        onChange={vi.fn()}
        onCommit={vi.fn()}
      />,
      { wrapper: makeWrapper(api) },
    );

    expect(
      await screen.findByText("No catalog models are available for this configuration product."),
    ).toBeInTheDocument();
    expect(screen.queryByRole("radio")).not.toBeInTheDocument();
  });
});
