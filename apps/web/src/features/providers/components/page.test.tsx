import type { BoundApi } from "@diffgazer/core/api";
import { ApiProvider } from "@diffgazer/core/api/hooks";
import { FooterProvider, useFooterData } from "@diffgazer/core/footer";
import {
  AVAILABLE_PROVIDERS,
  type InitResponse,
  type OpenRouterModelsResponse,
  type ProviderModelsResponse,
} from "@diffgazer/core/schemas/config";
import { createDeferred } from "@diffgazer/core/testing/deferred";
import { createTestQueryWrapper } from "@diffgazer/core/testing/query-wrapper";
import { KeyboardProvider } from "@diffgazer/keys";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { Footer } from "@/components/layout/footer";
import { ConfigProvider } from "@/hooks/use-config";
import { clearScopedRouteState } from "@/hooks/use-scoped-route-state";
import { ProvidersPage } from "./page";

vi.mock("@tanstack/react-router", () => ({
  useLocation: () => ({ pathname: "/providers-page-test" }),
  useNavigate: () => vi.fn(),
}));

const PROVIDERS: InitResponse["providers"] = [
  {
    provider: "gemini",
    hasApiKey: true,
    isActive: true,
    model: "gemini-2.5-flash",
  },
  { provider: "openrouter", hasApiKey: true, isActive: false },
];

const PROVIDER_MODELS: ProviderModelsResponse = {
  models: [
    {
      id: "gemini-2.5-flash",
      name: "Gemini 2.5 Flash",
      description: "Fast model",
      tier: "free",
    },
    {
      id: "gemini-2.5-pro",
      name: "Gemini 2.5 Pro",
      description: "Advanced model",
      tier: "paid",
    },
  ],
  fetchedAt: "2026-01-01T00:00:00.000Z",
  source: "snapshot",
  cached: false,
};

const OPENROUTER_MODELS: OpenRouterModelsResponse = {
  models: [
    {
      id: "openai/gpt-4o",
      name: "GPT-4o",
      contextLength: 128_000,
      supportedParameters: ["response_format"],
      pricing: { prompt: "0.001", completion: "0.002" },
      isFree: false,
    },
  ],
  fetchedAt: "2026-01-01T00:00:00.000Z",
  cached: false,
};

const INIT_RESPONSE: InitResponse = {
  configPath: "/tmp/diffgazer/config.json",
  config: { provider: "gemini", model: "gemini-2.5-flash" },
  configured: true,
  project: { projectId: "proj-1", path: "/repo", trust: null },
  providers: PROVIDERS,
  settings: {
    agentExecution: "parallel",
    defaultLenses: [],
    defaultProfile: null,
    secretsStorage: "file",
    severityThreshold: "low",
    theme: "terminal",
  },
  setup: {
    hasModel: true,
    hasProvider: true,
    hasSecretsStorage: true,
    hasTrust: false,
    isConfigured: true,
    isReady: true,
    missing: [],
  },
};

beforeAll(() => {
  if (typeof HTMLDialogElement === "undefined") return;
  HTMLDialogElement.prototype.showModal ??= function showModal() {
    this.setAttribute("open", "");
  };
  HTMLDialogElement.prototype.close ??= function close() {
    this.removeAttribute("open");
  };
});

beforeEach(() => {
  clearScopedRouteState("/providers-page-test", "providerId");
});

function FooterView() {
  const { shortcuts, rightShortcuts } = useFooterData();
  return <Footer shortcuts={shortcuts} rightShortcuts={rightShortcuts} />;
}

function renderProvidersPage(api: Partial<BoundApi>, ui: ReactNode = <ProvidersPage />) {
  const { Wrapper: ApiWrapper } = createTestQueryWrapper({
    ApiProvider,
    api: {
      getProviderStatus: vi.fn().mockResolvedValue(PROVIDERS),
      getProviderModels: vi.fn().mockResolvedValue(PROVIDER_MODELS),
      getOpenRouterModels: vi.fn().mockResolvedValue(OPENROUTER_MODELS),
      loadInit: vi.fn().mockResolvedValue(INIT_RESPONSE),
      ...api,
    },
  });

  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <ApiWrapper>
        <ConfigProvider>
          <FooterProvider>
            <KeyboardProvider>{children}</KeyboardProvider>
          </FooterProvider>
        </ConfigProvider>
      </ApiWrapper>
    );
  }

  return render(ui, { wrapper: Wrapper });
}

async function selectProvider(user: ReturnType<typeof userEvent.setup>, name: string) {
  const list = await screen.findByRole("listbox", { name: "Providers" });
  await user.click(within(list).getByRole("option", { name: new RegExp(name, "i") }));
  await screen.findByRole("heading", { name: new RegExp(`Provider Details: ${name}`, "i") });
}

async function openApiKeyDialog(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: /Configure API Key/i }));
  return screen.findByRole("dialog", { name: /API Key/i });
}

async function openModelDialog(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: /Select Model/i }));
  return screen.findByRole("dialog", { name: "Select Model" });
}

type ActivationSurface = "list-enter" | "details-primary" | "action-row";

async function activateFromSurface(
  user: ReturnType<typeof userEvent.setup>,
  surface: ActivationSurface,
  providerName: string,
) {
  await selectProvider(user, providerName);

  if (surface === "details-primary") {
    await user.click(screen.getByRole("button", { name: "Select Provider" }));
    return;
  }

  const list = screen.getByRole("listbox", { name: "Providers" });
  list.focus();
  await user.keyboard(surface === "list-enter" ? "{Enter}" : "{ArrowRight}{Enter}");
}

describe("ProvidersPage activation prerequisites", () => {
  const surfaces: ActivationSurface[] = ["list-enter", "details-primary", "action-row"];
  const readyCases = surfaces.flatMap((surface) => [
    {
      surface,
      modelSource: "selected model",
      provider: {
        provider: "gemini" as const,
        hasApiKey: true,
        isActive: false,
        model: "gemini-2.5-pro",
      },
      expectedModel: "gemini-2.5-pro",
    },
    {
      surface,
      modelSource: "default model",
      provider: { provider: "gemini" as const, hasApiKey: true, isActive: false },
      expectedModel: "gemini-2.5-flash",
    },
  ]);

  it.each(surfaces)("opens API-key setup from %s when credentials are missing", async (surface) => {
    const user = userEvent.setup();
    const providers: InitResponse["providers"] = [
      { provider: "gemini", hasApiKey: false, isActive: false },
    ];
    const activateProvider = vi.fn<BoundApi["activateProvider"]>();
    renderProvidersPage({
      activateProvider,
      getProviderStatus: vi.fn().mockResolvedValue(providers),
      loadInit: vi.fn().mockResolvedValue({ ...INIT_RESPONSE, providers }),
    });

    await activateFromSurface(user, surface, "Google Gemini");

    expect(await screen.findByRole("dialog", { name: /API Key/i })).toBeInTheDocument();
    expect(screen.queryByRole("dialog", { name: "Select Model" })).not.toBeInTheDocument();
    expect(activateProvider).not.toHaveBeenCalled();
  });

  it.each(
    surfaces,
  )("opens model selection from %s when the provider requires an explicit model", async (surface) => {
    const user = userEvent.setup();
    const providers: InitResponse["providers"] = [
      { provider: "openrouter", hasApiKey: true, isActive: false },
    ];
    const activateProvider = vi.fn<BoundApi["activateProvider"]>();
    renderProvidersPage({
      activateProvider,
      getProviderStatus: vi.fn().mockResolvedValue(providers),
      loadInit: vi.fn().mockResolvedValue({ ...INIT_RESPONSE, providers }),
    });

    await activateFromSurface(user, surface, "OpenRouter");

    expect(await screen.findByRole("dialog", { name: "Select Model" })).toBeInTheDocument();
    expect(screen.queryByRole("dialog", { name: /API Key/i })).not.toBeInTheDocument();
    expect(activateProvider).not.toHaveBeenCalled();
  });

  it.each(readyCases)("activates the $modelSource exactly once from $surface", async ({
    surface,
    provider,
    expectedModel,
  }) => {
    const user = userEvent.setup();
    const providers: InitResponse["providers"] = [provider];
    const activateProvider = vi
      .fn<BoundApi["activateProvider"]>()
      .mockResolvedValue({ provider: "gemini", model: expectedModel });
    renderProvidersPage({
      activateProvider,
      getProviderStatus: vi.fn().mockResolvedValue(providers),
      loadInit: vi.fn().mockResolvedValue({ ...INIT_RESPONSE, providers }),
    });

    await activateFromSurface(user, surface, "Google Gemini");

    await waitFor(() => expect(activateProvider).toHaveBeenCalledWith("gemini", expectedModel));
    expect(activateProvider).toHaveBeenCalledOnce();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});

describe("ProvidersPage footer integration", () => {
  it("clears page footer shortcuts while the API-key dialog is open and restores them after close", async () => {
    const user = userEvent.setup();
    renderProvidersPage(
      {},
      <>
        <ProvidersPage />
        <FooterView />
      </>,
    );

    await selectProvider(user, "Google Gemini");
    expect(screen.getByText("Navigate Providers")).toBeInTheDocument();
    expect(screen.getByText("Back")).toBeInTheDocument();

    const dialog = await openApiKeyDialog(user);
    expect(screen.queryByText("Navigate Providers")).not.toBeInTheDocument();
    expect(screen.queryByText("Back")).not.toBeInTheDocument();

    await user.click(within(dialog).getByRole("button", { name: "Cancel" }));
    const dialogElement = document.querySelector("dialog");
    // fireEvent retained: animationEnd has no userEvent equivalent, and the dialog stays
    // mounted until its close animation ends.
    if (dialogElement) fireEvent.animationEnd(dialogElement);

    const list = screen.getByRole("listbox", { name: "Providers" });
    await user.click(within(list).getByRole("option", { name: /Google Gemini/i }));

    await waitFor(() => {
      expect(screen.getByText("Navigate Providers")).toBeInTheDocument();
    });
    expect(screen.getByText("Back")).toBeInTheDocument();
  }, 15_000);
});

describe("ProvidersPage dialog ownership", () => {
  it("closes a saved OpenRouter dialog and hands off to model selection", async () => {
    const user = userEvent.setup();
    const saveConfig = vi.fn<BoundApi["saveConfig"]>().mockResolvedValue(undefined);
    renderProvidersPage({ saveConfig });

    await selectProvider(user, "OpenRouter");
    const dialog = await openApiKeyDialog(user);
    await user.type(within(dialog).getByLabelText(/OpenRouter API Key/i), "sk-test");
    await user.click(within(dialog).getByRole("button", { name: "Confirm" }));

    await waitFor(() => expect(dialog).not.toBeInTheDocument());
    expect(saveConfig).toHaveBeenCalledOnce();
    expect(await screen.findByRole("dialog", { name: "Select Model" })).toBeInTheDocument();
  });

  it("keeps the OpenRouter model handoff when saving removes it from the Needs Key filter", async () => {
    const user = userEvent.setup();
    const providersNeedingKey: InitResponse["providers"] = AVAILABLE_PROVIDERS.map(({ id }) => {
      const status = PROVIDERS.find((provider) => provider.provider === id);
      if (status) return { ...status, hasApiKey: id !== "openrouter" };
      return { provider: id, hasApiKey: true, isActive: false };
    });
    const providersAfterSave: InitResponse["providers"] = providersNeedingKey.map((provider) =>
      provider.provider === "openrouter" ? { ...provider, hasApiKey: true } : provider,
    );
    const getProviderStatus = vi
      .fn<BoundApi["getProviderStatus"]>()
      .mockResolvedValueOnce(providersNeedingKey)
      .mockResolvedValue(providersAfterSave);
    const saveConfig = vi.fn<BoundApi["saveConfig"]>().mockResolvedValue(undefined);
    const loadInit = vi
      .fn<BoundApi["loadInit"]>()
      .mockResolvedValue({ ...INIT_RESPONSE, providers: providersNeedingKey });
    renderProvidersPage({ getProviderStatus, loadInit, saveConfig });

    const filters = await screen.findByRole("radiogroup", { name: "Provider filter" });
    const needsKeyFilter = within(filters).getByRole("radio", { name: "Needs Key" });
    await user.click(needsKeyFilter);
    await selectProvider(user, "OpenRouter");
    expect(getProviderStatus).toHaveBeenCalledOnce();

    const apiKeyDialog = await openApiKeyDialog(user);
    await user.type(within(apiKeyDialog).getByLabelText(/OpenRouter API Key/i), "sk-test");
    await user.click(within(apiKeyDialog).getByRole("button", { name: "Confirm" }));

    await waitFor(() => expect(getProviderStatus).toHaveBeenCalledTimes(2));
    expect(await screen.findByText("No providers match your filters")).toBeInTheDocument();
    expect(needsKeyFilter).toBeChecked();
    expect(screen.queryByRole("option", { name: /OpenRouter/i })).not.toBeInTheDocument();
    expect(saveConfig).toHaveBeenCalledOnce();

    const modelDialog = await screen.findByRole("dialog", { name: "Select Model" });
    expect(within(modelDialog).getByRole("radio", { name: /GPT-4o/i })).toBeInTheDocument();
  });

  it("blocks peer dialog actions while an API-key save owns the pending mutation", async () => {
    const user = userEvent.setup();
    const save = createDeferred<void>();
    const saveConfig = vi.fn<BoundApi["saveConfig"]>().mockReturnValueOnce(save.promise);
    renderProvidersPage({ saveConfig });

    await selectProvider(user, "OpenRouter");
    const originalDialog = await openApiKeyDialog(user);
    await user.type(within(originalDialog).getByLabelText(/OpenRouter API Key/i), "sk-test");
    await user.click(within(originalDialog).getByRole("button", { name: "Confirm" }));
    await waitFor(() => expect(saveConfig).toHaveBeenCalledOnce());

    const cancel = within(originalDialog).getByRole("button", { name: "Cancel" });
    expect(cancel).toBeDisabled();
    await user.click(cancel);
    expect(originalDialog).toBeInTheDocument();
    await selectProvider(user, "Google Gemini");

    const setApiKey = screen.getByRole("button", { name: /Configure API Key/i });
    const selectModel = screen.getByRole("button", { name: /Select Model/i });
    expect(setApiKey).toBeDisabled();
    expect(selectModel).toBeDisabled();
    await user.click(setApiKey);
    await user.click(selectModel);
    expect(screen.getAllByRole("dialog")).toEqual([originalDialog]);

    await act(async () => {
      save.resolve(undefined);
      await save.promise;
    });

    await waitFor(() => expect(originalDialog).not.toBeInTheDocument());
    expect(await screen.findByRole("dialog", { name: "Select Model" })).toBeInTheDocument();
  });

  it("blocks every provider action while key removal is pending", async () => {
    const user = userEvent.setup();
    const removal = createDeferred<{ deleted: boolean; provider: "gemini" }>();
    const deleteProviderCredentials = vi
      .fn<BoundApi["deleteProviderCredentials"]>()
      .mockReturnValueOnce(removal.promise);
    renderProvidersPage({ deleteProviderCredentials });

    await selectProvider(user, "Google Gemini");
    await user.click(screen.getByRole("button", { name: /Remove Key/i }));
    await waitFor(() => expect(deleteProviderCredentials).toHaveBeenCalledOnce());
    await selectProvider(user, "OpenRouter");

    const actions = ["Select Provider", "Configure API Key", "Remove Key", "Select Model"];
    for (const name of actions) {
      expect(screen.getByRole("button", { name })).toBeDisabled();
    }
    await user.click(screen.getByRole("button", { name: "Configure API Key" }));
    await user.click(screen.getByRole("button", { name: "Select Model" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    await act(async () => {
      removal.resolve({ deleted: true, provider: "gemini" });
      await removal.promise;
    });

    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Configure API Key" })).toBeEnabled(),
    );
  });

  it("blocks peer actions while a model selection owns the pending mutation", async () => {
    const user = userEvent.setup();
    const activation = createDeferred<{ provider: "gemini"; model: string }>();
    const activateProvider = vi
      .fn<BoundApi["activateProvider"]>()
      .mockReturnValueOnce(activation.promise);
    renderProvidersPage({ activateProvider });

    await selectProvider(user, "Google Gemini");
    const originalDialog = await openModelDialog(user);
    await user.click(within(originalDialog).getByRole("radio", { name: /Gemini 2\.5 Pro/i }));
    await user.click(within(originalDialog).getByRole("button", { name: "Confirm" }));
    await waitFor(() => expect(activateProvider).toHaveBeenCalledOnce());

    await selectProvider(user, "OpenRouter");
    const setApiKey = screen.getByRole("button", { name: /Configure API Key/i });
    const selectModel = screen.getByRole("button", { name: /Select Model/i });
    expect(setApiKey).toBeDisabled();
    expect(selectModel).toBeDisabled();
    await user.click(setApiKey);
    await user.click(selectModel);
    expect(screen.getAllByRole("dialog")).toEqual([originalDialog]);

    await act(async () => {
      activation.resolve({ provider: "gemini", model: "gemini-2.5-pro" });
      await activation.promise;
    });

    await waitFor(() => expect(originalDialog).not.toBeInTheDocument());
  }, 15_000);

  it("closes the model dialog that successfully saves its selection", async () => {
    const user = userEvent.setup();
    const activateProvider = vi
      .fn<BoundApi["activateProvider"]>()
      .mockResolvedValue({ provider: "gemini", model: "gemini-2.5-pro" });
    renderProvidersPage({ activateProvider });

    await selectProvider(user, "Google Gemini");
    const dialog = await openModelDialog(user);
    await user.click(within(dialog).getByRole("radio", { name: /Gemini 2\.5 Pro/i }));
    await user.click(within(dialog).getByRole("button", { name: "Confirm" }));

    await waitFor(() => expect(dialog).not.toBeInTheDocument());
    expect(activateProvider).toHaveBeenCalledWith("gemini", "gemini-2.5-pro");
  });

  it("renders only the newest peer dialog", async () => {
    const user = userEvent.setup();
    renderProvidersPage({});

    await selectProvider(user, "Google Gemini");
    const modelDialog = await openModelDialog(user);
    await selectProvider(user, "OpenRouter");
    const apiKeyDialog = await openApiKeyDialog(user);

    expect(modelDialog).not.toBeInTheDocument();
    expect(apiKeyDialog).toBeInTheDocument();
    expect(screen.getAllByRole("dialog")).toHaveLength(1);
  });
});
