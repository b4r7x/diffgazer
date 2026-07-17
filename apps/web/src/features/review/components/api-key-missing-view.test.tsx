import { FooterProvider } from "@diffgazer/core/footer";
import type { InitResponse, ProviderStatus } from "@diffgazer/core/schemas/config";
import { KeyboardProvider } from "@diffgazer/keys";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ConfigProvider } from "@/hooks/use-config";
import { requireConfigured } from "@/lib/config-guards";
import { queryClient as routeQueryClient } from "@/lib/query-client";
import {
  ApiKeyMissingView,
  type ApiKeyMissingViewProps,
  ConfigurationErrorView,
} from "./api-key-missing-view";
import { ReviewContainer } from "./container";

type QueryState<T> = { data: T | undefined; error: Error | null; isLoading: boolean };

const configQueriesState = vi.hoisted(() => {
  const state: {
    init: QueryState<InitResponse>;
    providers: QueryState<ProviderStatus[]>;
  } = {
    init: { data: undefined, error: new Error("init unavailable"), isLoading: false },
    providers: { data: undefined, error: new Error("providers unavailable"), isLoading: false },
  };
  return state;
});

vi.mock("@diffgazer/core/api/hooks", async (importOriginal) => {
  const original = await importOriginal<typeof import("@diffgazer/core/api/hooks")>();
  return {
    ...original,
    useActivateProvider: () => ({ mutateAsync: vi.fn() }),
    useDeleteProviderCredentials: () => ({ mutateAsync: vi.fn() }),
    useInit: () => configQueriesState.init,
    useProviderStatus: () => configQueriesState.providers,
    useSaveConfig: () => ({ mutateAsync: vi.fn() }),
  };
});

vi.mock("../hooks/use-lifecycle", () => ({
  extractOrchestratorStats: () => ({}),
  useReviewLifecycle: () => ({
    state: {
      steps: [],
      agents: [],
      events: [],
      issues: [],
      notices: [],
      fileProgress: { total: 0, completed: [] },
      startedAt: null,
      isStreaming: false,
      error: null,
    },
    gate: "unconfigured",
    contextSnapshot: null,
    loadingMessage: null,
    provider: undefined,
    isTransitionPending: false,
    handleCancel: vi.fn(),
    handleBack: vi.fn(),
    handleViewResults: vi.fn(),
    handleSetupProvider: vi.fn(),
    handleSwitchMode: vi.fn(),
  }),
}));

const PROVIDER_MISSING = ["provider"] as const;

type RenderViewProps = Pick<ApiKeyMissingViewProps, "missing"> &
  Partial<Omit<ApiKeyMissingViewProps, "missing">>;

function renderView(props: RenderViewProps) {
  const onBack = props.onBack ?? vi.fn();
  const onNavigateSettings = props.onNavigateSettings ?? vi.fn();

  const view = render(
    <KeyboardProvider>
      <FooterProvider>
        <ApiKeyMissingView
          activeProvider={props.activeProvider}
          onBack={onBack}
          onNavigateSettings={onNavigateSettings}
          missing={props.missing}
          primaryDisabled={props.primaryDisabled}
        />
      </FooterProvider>
    </KeyboardProvider>,
  );

  return { ...view, onBack, onNavigateSettings };
}

describe("ApiKeyMissingView", () => {
  it("focuses the Configure Provider action by default", async () => {
    renderView({ missing: PROVIDER_MISSING });

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Configure Provider" })).toHaveFocus();
    });
  });

  it("moves focus between actions with ArrowRight/ArrowLeft", async () => {
    const user = userEvent.setup();
    renderView({ missing: PROVIDER_MISSING });

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Configure Provider" })).toHaveFocus();
    });

    await user.keyboard("{ArrowRight}");
    expect(screen.getByRole("button", { name: "Back to Home" })).toHaveFocus();

    await user.keyboard("{ArrowLeft}");
    expect(screen.getByRole("button", { name: "Configure Provider" })).toHaveFocus();
  });

  it("clamps at both action boundaries without wrapping", async () => {
    const user = userEvent.setup();
    renderView({ missing: PROVIDER_MISSING });

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Configure Provider" })).toHaveFocus();
    });

    await user.keyboard("{ArrowLeft}");
    expect(screen.getByRole("button", { name: "Configure Provider" })).toHaveFocus();

    await user.keyboard("{ArrowRight}{ArrowRight}");
    expect(screen.getByRole("button", { name: "Back to Home" })).toHaveFocus();
  });

  it("Enter on the focused Back action calls only onBack (regression: no double-fire)", async () => {
    const user = userEvent.setup();
    const onBack = vi.fn();
    const onNavigateSettings = vi.fn();
    renderView({ missing: PROVIDER_MISSING, onBack, onNavigateSettings });

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Configure Provider" })).toHaveFocus();
    });

    await user.keyboard("{ArrowRight}");
    expect(screen.getByRole("button", { name: "Back to Home" })).toHaveFocus();

    await user.keyboard("{Enter}");
    // call-count IS the contract: this test guards a regression where Enter double-fires (count must be exactly 1, not 2)
    expect(onBack).toHaveBeenCalledTimes(1);
    expect(onNavigateSettings).not.toHaveBeenCalled();
  });

  it("Enter on the focused Configure Provider action calls only onNavigateSettings", async () => {
    const user = userEvent.setup();
    const onBack = vi.fn();
    const onNavigateSettings = vi.fn();
    renderView({ missing: PROVIDER_MISSING, onBack, onNavigateSettings });

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Configure Provider" })).toHaveFocus();
    });

    await user.keyboard("{Enter}");
    // call-count IS the contract: Enter on focused action must fire exactly once (no double-fire regression)
    expect(onNavigateSettings).toHaveBeenCalledTimes(1);
    expect(onBack).not.toHaveBeenCalled();
  });

  it("Escape always calls onBack regardless of focused action", async () => {
    const user = userEvent.setup();
    const onBack = vi.fn();
    const onNavigateSettings = vi.fn();
    renderView({ missing: PROVIDER_MISSING, onBack, onNavigateSettings });

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Configure Provider" })).toHaveFocus();
    });

    await user.keyboard("{Escape}");
    // call-count IS the contract: Escape must fire onBack exactly once (no double-fire regardless of focused action)
    expect(onBack).toHaveBeenCalledTimes(1);
    expect(onNavigateSettings).not.toHaveBeenCalled();
  });

  it("disables pending provider navigation while keeping Back active", async () => {
    const user = userEvent.setup();
    const onBack = vi.fn();
    const onNavigateSettings = vi.fn();
    renderView({
      missing: PROVIDER_MISSING,
      onBack,
      onNavigateSettings,
      primaryDisabled: true,
    });

    const configure = screen.getByRole("button", { name: "Configure Provider" });
    const back = screen.getByRole("button", { name: "Back to Home" });
    expect(configure).toBeDisabled();
    expect(back).toBeEnabled();
    await waitFor(() => expect(back).toHaveFocus());

    await user.click(configure);
    await user.keyboard("{Escape}");

    expect(onNavigateSettings).not.toHaveBeenCalled();
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it("renders API Key Required when the loaded setup status lacks a provider", () => {
    renderView({ missing: PROVIDER_MISSING });
    expect(screen.getByText("API Key Required")).toBeInTheDocument();
  });

  it("renders Model Required when the loaded setup status only lacks a model", () => {
    renderView({ missing: ["model"] });
    expect(screen.getByText("Model Required")).toBeInTheDocument();
  });

  it("renders the storage requirement from the loaded setup status", () => {
    renderView({ missing: ["secretsStorage"] });
    expect(screen.getByText("Secrets Storage Required")).toBeInTheDocument();
  });
});

describe("ConfigurationErrorView", () => {
  beforeEach(() => {
    configQueriesState.init = {
      data: undefined,
      error: new Error("init unavailable"),
      isLoading: false,
    };
    configQueriesState.providers = {
      data: undefined,
      error: new Error("providers unavailable"),
      isLoading: false,
    };
  });

  it("announces the load failure and lets the user retry", async () => {
    const user = userEvent.setup();
    const onRetry = vi.fn();

    render(
      <KeyboardProvider>
        <FooterProvider>
          <ConfigurationErrorView onRetry={onRetry} onBack={() => {}} />
        </FooterProvider>
      </KeyboardProvider>,
    );

    expect(screen.getByRole("alert")).toHaveTextContent("Configuration Unavailable");
    await user.click(screen.getByRole("button", { name: "Retry" }));
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it("shows the retryable error gate after the route guard falls through failed queries", async () => {
    const ensureQueryData = vi
      .spyOn(routeQueryClient, "ensureQueryData")
      .mockRejectedValue(new Error("route config unavailable"));

    await expect(requireConfigured()).resolves.toBeUndefined();
    ensureQueryData.mockRestore();

    const configQueryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    render(
      <QueryClientProvider client={configQueryClient}>
        <ConfigProvider>
          <KeyboardProvider>
            <FooterProvider>
              <ReviewContainer mode="staged" />
            </FooterProvider>
          </KeyboardProvider>
        </ConfigProvider>
      </QueryClientProvider>,
    );

    expect(screen.getByRole("alert")).toHaveTextContent("Configuration Unavailable");
    expect(screen.queryByText("Model Required")).not.toBeInTheDocument();
  });

  it("uses valid init setup data when only provider status fails", () => {
    configQueriesState.init = {
      data: {
        config: { provider: "openrouter" },
        providers: [{ provider: "openrouter", hasApiKey: true, isActive: true }],
        settings: {
          theme: "terminal",
          defaultLenses: [],
          defaultProfile: null,
          severityThreshold: "low",
          secretsStorage: "file",
          agentExecution: "parallel",
        },
        configured: false,
        project: { projectId: "project-1", path: "/repo", trust: null },
        setup: {
          hasSecretsStorage: true,
          hasProvider: true,
          hasModel: false,
          hasTrust: false,
          isConfigured: false,
          isReady: false,
          missing: ["model"],
        },
      },
      error: null,
      isLoading: false,
    };

    const configQueryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    render(
      <QueryClientProvider client={configQueryClient}>
        <ConfigProvider>
          <KeyboardProvider>
            <FooterProvider>
              <ReviewContainer mode="staged" />
            </FooterProvider>
          </KeyboardProvider>
        </ConfigProvider>
      </QueryClientProvider>,
    );

    expect(screen.getByText("Model Required")).toBeInTheDocument();
    expect(screen.queryByText("Configuration Unavailable")).not.toBeInTheDocument();
  });
});
