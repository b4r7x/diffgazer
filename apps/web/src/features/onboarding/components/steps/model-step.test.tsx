import { type BoundApi, createApi } from "@diffgazer/core/api";
import { ApiProvider } from "@diffgazer/core/api/hooks";
import { FooterProvider } from "@diffgazer/core/footer";
import { CATALOG_EMPTY_MODELS_REASON } from "@diffgazer/core/providers";
import type {
  ClientConfigurationSummary,
  ConfigurationModelsResponse,
} from "@diffgazer/core/schemas/config";
import {
  GEMINI_CONFIGURATION,
  OPENCODE_ZEN_CONFIGURATION,
} from "@diffgazer/core/testing/provider-fixtures";
import { KeyboardProvider } from "@diffgazer/keys";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { ModelStep } from "./model-step";

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

  it("focuses Retry when no configuration is available for discovery", () => {
    render(
      <ModelStep
        configuration={null}
        isPreparing={false}
        onRetry={vi.fn()}
        value={null}
        onChange={vi.fn()}
      />,
      { wrapper: makeWrapper(apiWithModels(vi.fn<BoundApi["getConfigurationModels"]>())) },
    );

    expect(screen.getByRole("button", { name: "Retry" })).toHaveFocus();
  });

  it("leaves footer focus alone when preparation resolves without a configuration", () => {
    const wrapper = makeWrapper(apiWithModels(vi.fn<BoundApi["getConfigurationModels"]>()));
    const preparingStep = (isPreparing: boolean) => (
      <>
        <button type="button">Next</button>
        <ModelStep
          configuration={null}
          isPreparing={isPreparing}
          onRetry={vi.fn()}
          value={null}
          onChange={vi.fn()}
          enabled={false}
        />
      </>
    );

    const { rerender } = render(preparingStep(true), { wrapper });

    const footerAction = screen.getByRole("button", { name: "Next" });
    footerAction.focus();

    rerender(preparingStep(false));

    expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument();
    expect(footerAction).toHaveFocus();
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

  it("refocuses Retry when the step re-enables after a footer round-trip", async () => {
    const api = apiWithModels(
      vi
        .fn<BoundApi["getConfigurationModels"]>()
        .mockRejectedValue(new Error("catalog unavailable")),
    );
    const step = (enabled: boolean) => (
      <ModelStep
        configuration={GEMINI_CONFIGURATION}
        isPreparing={false}
        onRetry={vi.fn()}
        value={null}
        onChange={vi.fn()}
        onCommit={vi.fn()}
        enabled={enabled}
      />
    );

    const { rerender } = render(step(true), { wrapper: makeWrapper(api) });

    const retry = await screen.findByRole("button", { name: "Retry" });
    await waitFor(() => expect(retry).toHaveFocus());

    rerender(step(false));
    retry.blur();
    expect(retry).not.toHaveFocus();

    rerender(step(true));
    expect(retry).toHaveFocus();
  });

  it("retries discovery with the r shortcut while a recovery branch is mounted", async () => {
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

    await screen.findByRole("button", { name: "Retry" });
    // The chip is the contract: an advertised uppercase R would need Shift to
    // match the binding, so the hint has to name the key this press sends.
    const hint = screen.getByText(/retry discovery/i);
    expect(within(hint).getByText("r")).toBeInTheDocument();

    await user.keyboard("r");

    expect(await screen.findByRole("radio", { name: /gemini-2\.5-flash/i })).toBeInTheDocument();
    expect(screen.queryByText(/retry discovery/i)).not.toBeInTheDocument();
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
    // Gemini has one endpoint, so the row carries no pool to move to.
    expect(onCommit).toHaveBeenCalledWith("gemini-2.5-flash", null);
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
        reason: CATALOG_EMPTY_MODELS_REASON,
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

    expect(await screen.findByText(CATALOG_EMPTY_MODELS_REASON)).toBeInTheDocument();
    expect(screen.queryByRole("radio")).not.toBeInTheDocument();
  });
});

describe("ModelStep endpoint pool badges", () => {
  function poolModelsResponse(): ConfigurationModelsResponse {
    return {
      status: "passed",
      configurationId: OPENCODE_ZEN_CONFIGURATION.configurationId,
      productId: OPENCODE_ZEN_CONFIGURATION.productId,
      transportFamily: OPENCODE_ZEN_CONFIGURATION.transportFamily,
      models: [
        {
          id: "deepseek-v4-flash",
          name: "deepseek-v4-flash",
          description: "Served by both pools",
          tier: "paid",
          endpointProfileIds: ["zen", "go"],
        },
        {
          id: "claude-opus-5",
          name: "claude-opus-5",
          description: "Zen only",
          tier: "paid",
          endpointProfileIds: ["zen"],
        },
        {
          id: "glm-5.3",
          name: "glm-5.3",
          description: "Go only",
          tier: "paid",
          endpointProfileIds: ["go"],
        },
      ],
      checkedAt: "2026-08-02T12:00:00.000Z",
      source: "snapshot",
      cached: false,
    };
  }

  function renderStep(
    configuration: ClientConfigurationSummary,
    response: ConfigurationModelsResponse,
    onChange: (model: string, poolEndpoint: string | null) => void = vi.fn(),
  ) {
    const api = apiWithModels(
      vi.fn<BoundApi["getConfigurationModels"]>().mockResolvedValue(response),
    );
    render(
      <ModelStep
        configuration={configuration}
        isPreparing={false}
        onRetry={vi.fn()}
        value={null}
        onChange={onChange}
        onCommit={vi.fn()}
      />,
      { wrapper: makeWrapper(api) },
    );
  }

  it("badges every row with the pool that will bill it, sibling-only rows included", async () => {
    renderStep(OPENCODE_ZEN_CONFIGURATION, poolModelsResponse());

    // No pool selector here, so a shared row bills the bound pool and a row only
    // the sibling serves still names its own.
    expect(await screen.findByRole("radio", { name: /deepseek-v4-flash/ })).toHaveTextContent(
      "Zen",
    );
    expect(screen.getByRole("radio", { name: /claude-opus-5/ })).toHaveTextContent("Zen");
    expect(screen.getByRole("radio", { name: /glm-5\.3/ })).toHaveTextContent("Go");
    expect(screen.queryByRole("radiogroup", { name: "Billing pool" })).not.toBeInTheDocument();
  });

  it("reports the badged pool so a sibling-only row is saved against the pool that serves it", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    renderStep(OPENCODE_ZEN_CONFIGURATION, poolModelsResponse(), onChange);

    await user.click(await screen.findByRole("radio", { name: /glm-5\.3/ }));
    expect(onChange).toHaveBeenCalledWith("glm-5.3", "https://opencode.ai/zen/go/v1");

    // A row the bound pool already serves moves nothing.
    await user.click(screen.getByRole("radio", { name: /deepseek-v4-flash/ }));
    expect(onChange).toHaveBeenLastCalledWith("deepseek-v4-flash", null);
  });

  it("shows no pool badge for a product whose endpoints are not billing pools", async () => {
    renderStep(GEMINI_CONFIGURATION, geminiModelsResponse());

    await screen.findByRole("radio", { name: /gemini-2\.5-flash/ });
    expect(screen.queryByText(/^(Zen|Go)$/)).not.toBeInTheDocument();
  });
});
