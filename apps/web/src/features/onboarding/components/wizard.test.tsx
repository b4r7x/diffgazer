import { type BoundApi, createApi } from "@diffgazer/core/api";
import type { InitResponse, ProviderModelsResponse } from "@diffgazer/core/schemas/config";
import { AVAILABLE_PROVIDERS } from "@diffgazer/core/schemas/config";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, type Mock, vi } from "vitest";
import { escapeRegExp } from "@/testing/escape-regexp";

const mockNavigate = vi.fn();

// Boundary mock: Router is the routing library; tests provide a stub Router context so navigation assertions can be made without a real route tree.
vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => mockNavigate,
}));

// Reset config-guard-cache module state between tests via vi.resetModules() + re-import.
// Every @diffgazer/@-aliased participant in the rendered tree is re-imported together so the
// providers, the wizard, and the cache reader share one fresh module graph — vi.resetModules()
// re-evaluates the transformed app graph, so a statically-held context object would mismatch.
let getConfiguredGuardCache: typeof import("@/lib/config-guard-cache").getConfiguredGuardCache;
let OnboardingWizard: typeof import("./wizard").OnboardingWizard;
let ConfigProvider: typeof import("@/app/providers/config").ConfigProvider;
let KeyboardProvider: typeof import("@diffgazer/keys").KeyboardProvider;
let ApiProvider: typeof import("@diffgazer/core/api/hooks").ApiProvider;
let FooterProvider: typeof import("@diffgazer/core/footer").FooterProvider;

const GEMINI_CATALOG: ProviderModelsResponse = {
  models: [
    {
      id: "gemini-2.5-flash",
      name: "Gemini 2.5 Flash",
      description: "1M context",
      tier: "free",
      recommended: true,
    },
    { id: "gemini-2.5-pro", name: "Gemini 2.5 Pro", description: "1M context", tier: "free" },
    {
      id: "gemini-3-pro-preview",
      name: "Gemini 3 Pro Preview",
      description: "1M context",
      tier: "paid",
    },
  ],
  fetchedAt: new Date().toISOString(),
  source: "live",
  cached: false,
};

function geminiModel(id: string) {
  const model = GEMINI_CATALOG.models.find((m) => m.id === id);
  if (!model) throw new Error(`Gemini catalog fixture is missing model "${id}"`);
  return model;
}

function makeInitResponse(overrides: Partial<InitResponse> = {}): InitResponse {
  return {
    config: { provider: "gemini", model: "gemini-2.5-flash" },
    providers: [{ provider: "gemini", hasApiKey: true, isActive: true }],
    settings: {
      theme: "terminal",
      defaultLenses: [],
      defaultProfile: null,
      severityThreshold: "low",
      secretsStorage: null,
      agentExecution: "parallel",
    },
    configured: false,
    project: { projectId: "proj-1", path: "/tmp/repo", trust: null },
    setup: {
      hasSecretsStorage: false,
      hasProvider: false,
      hasModel: false,
      hasTrust: false,
      isConfigured: false,
      isReady: false,
      missing: [],
    },
    ...overrides,
  };
}

let mockLoadInit: Mock<BoundApi["loadInit"]>;
let mockGetProviderStatus: Mock<BoundApi["getProviderStatus"]>;
let mockSaveSettings: Mock<BoundApi["saveSettings"]>;
let mockSaveConfig: Mock<BoundApi["saveConfig"]>;
let mockGetProviderModels: Mock<BoundApi["getProviderModels"]>;

function createTestApi(): BoundApi {
  return {
    ...createApi({ baseUrl: "http://localhost" }),
    loadInit: mockLoadInit,
    getProviderStatus: mockGetProviderStatus,
    saveSettings: mockSaveSettings,
    saveConfig: mockSaveConfig,
    getProviderModels: mockGetProviderModels,
  } satisfies BoundApi;
}

function renderWizard() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const api = createTestApi();

  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <ApiProvider value={api}>
          <ConfigProvider>
            <FooterProvider>
              <KeyboardProvider>{children}</KeyboardProvider>
            </FooterProvider>
          </ConfigProvider>
        </ApiProvider>
      </QueryClientProvider>
    );
  }

  return render(<OnboardingWizard />, { wrapper: Wrapper });
}

function getRadio(name: RegExp | string) {
  return screen.getByRole("radio", { name });
}

async function expectStep(title: RegExp) {
  await waitFor(() =>
    expect(screen.getByRole("heading", { level: 1, name: title })).toBeInTheDocument(),
  );
}

async function clickNext(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: /^next$/i }));
}

async function walkToFinalStepWithDefaults(user: ReturnType<typeof userEvent.setup>) {
  await expectStep(/secrets storage/i);
  await user.click(getRadio(/file storage/i));
  await clickNext(user);

  await expectStep(/ai provider/i);
  await clickNext(user);

  // Switch to env method so canProceed is true without entering a real key.
  await expectStep(/api key/i);
  await user.click(getRadio(/import from env/i));
  await waitFor(() => expect(getRadio(/import from env/i)).toHaveAttribute("aria-checked", "true"));
  await clickNext(user);

  await expectStep(/model selection/i);
  await clickNext(user);

  await expectStep(/analysis configuration/i);
  await clickNext(user);

  await expectStep(/agent execution/i);
}

describe("OnboardingWizard", () => {
  beforeEach(async () => {
    vi.resetModules();
    ({ getConfiguredGuardCache } = await import("@/lib/config-guard-cache"));
    ({ ApiProvider } = await import("@diffgazer/core/api/hooks"));
    ({ FooterProvider } = await import("@diffgazer/core/footer"));
    ({ ConfigProvider } = await import("@/app/providers/config"));
    ({ KeyboardProvider } = await import("@diffgazer/keys"));
    ({ OnboardingWizard } = await import("./wizard"));
    mockNavigate.mockReset();
    mockLoadInit = vi.fn<BoundApi["loadInit"]>().mockResolvedValue(makeInitResponse());
    mockGetProviderStatus = vi
      .fn<BoundApi["getProviderStatus"]>()
      .mockResolvedValue([{ provider: "gemini", hasApiKey: false, isActive: false }]);
    mockSaveSettings = vi.fn<BoundApi["saveSettings"]>().mockResolvedValue(undefined);
    mockSaveConfig = vi.fn<BoundApi["saveConfig"]>().mockResolvedValue(undefined);
    mockGetProviderModels = vi
      .fn<BoundApi["getProviderModels"]>()
      .mockResolvedValue(GEMINI_CATALOG);
  });

  it("disables the Next action on the api-key step until canProceed is satisfied", async () => {
    const user = userEvent.setup();
    renderWizard();

    await expectStep(/secrets storage/i);
    await user.click(getRadio(/file storage/i));
    await clickNext(user);

    await expectStep(/ai provider/i);
    await clickNext(user);

    await expectStep(/api key/i);
    expect(screen.getByRole("button", { name: /^next$/i })).toBeDisabled();

    await user.click(getRadio(/import from env/i));

    await waitFor(() =>
      expect(screen.getByRole("button", { name: /^next$/i })).toBeEnabled(),
    );
  });

  it("preselects the first provider and its default model in the visible steps", async () => {
    const user = userEvent.setup();
    renderWizard();

    await expectStep(/secrets storage/i);
    await user.click(getRadio(/file storage/i));
    expect(getRadio(/file storage/i)).toHaveAttribute("aria-checked", "true");
    await clickNext(user);

    const firstProvider = AVAILABLE_PROVIDERS[0];
    if (!firstProvider) throw new Error("AVAILABLE_PROVIDERS is empty");
    await expectStep(/ai provider/i);
    expect(getRadio(new RegExp(firstProvider.name, "i"))).toHaveAttribute("aria-checked", "true");
    await clickNext(user);

    await expectStep(/api key/i);
    await user.click(getRadio(/import from env/i));
    await clickNext(user);

    await expectStep(/model selection/i);
    const defaultModelName = geminiModel(firstProvider.defaultModel).name;
    await waitFor(() =>
      expect(getRadio(new RegExp(escapeRegExp(defaultModelName), "i"))).toHaveAttribute(
        "aria-checked",
        "true",
      ),
    );
  });

  it("marks the app as configured after a successful completion", async () => {
    const user = userEvent.setup();
    renderWizard();

    await walkToFinalStepWithDefaults(user);
    await user.click(screen.getByRole("button", { name: /complete setup/i }));

    const firstProvider = AVAILABLE_PROVIDERS[0];
    if (!firstProvider) throw new Error("AVAILABLE_PROVIDERS is empty");
    await waitFor(() => {
      expect(mockSaveSettings).toHaveBeenCalledWith(
        expect.objectContaining({ secretsStorage: "file" }),
      );
      expect(mockSaveConfig).toHaveBeenCalledWith(
        expect.objectContaining({ provider: firstProvider.id }),
      );
      expect(getConfiguredGuardCache(60_000)).toBe(true);
      expect(mockNavigate).toHaveBeenCalledWith({ to: "/" });
    });
  });

  it("submits the wizard payload derived from user selections", async () => {
    const user = userEvent.setup();
    renderWizard();

    await expectStep(/secrets storage/i);
    await user.click(getRadio(/system keyring/i));
    await clickNext(user);

    await expectStep(/ai provider/i);
    await clickNext(user);

    // Switch to env so the saved payload uses the "env" sentinel.
    await expectStep(/api key/i);
    await user.click(getRadio(/import from env/i));
    await clickNext(user);

    await expectStep(/model selection/i);
    const proModelName = geminiModel("gemini-2.5-pro").name;
    await waitFor(() =>
      expect(getRadio(new RegExp(escapeRegExp(proModelName), "i"))).toBeInTheDocument(),
    );
    await user.click(getRadio(new RegExp(escapeRegExp(proModelName), "i")));
    await clickNext(user);

    await expectStep(/analysis configuration/i);
    await clickNext(user);

    await expectStep(/agent execution/i);
    await user.click(getRadio(/parallel/i));

    await user.click(screen.getByRole("button", { name: /complete setup/i }));

    await waitFor(() => {
      expect(mockSaveSettings).toHaveBeenCalledWith({
        secretsStorage: "keyring",
        defaultLenses: expect.arrayContaining(["security", "performance", "simplicity", "tests"]),
        agentExecution: "parallel",
      });
      expect(mockSaveConfig).toHaveBeenCalledWith({
        provider: "gemini",
        apiKey: { kind: "env", varName: "GOOGLE_API_KEY" },
        model: "gemini-2.5-pro",
      });
    });
  });

  it("shows a saving label and disables the complete action while completion is pending", async () => {
    const user = userEvent.setup();
    let resolveConfig: (() => void) | undefined;
    mockSaveConfig.mockReturnValue(
      new Promise<void>((resolve) => {
        resolveConfig = resolve;
      }),
    );

    renderWizard();
    await walkToFinalStepWithDefaults(user);
    await user.click(screen.getByRole("button", { name: /complete setup/i }));

    const saving = await screen.findByRole("button", { name: /saving/i });
    expect(saving).toBeDisabled();
    expect(mockNavigate).not.toHaveBeenCalled();

    resolveConfig?.();

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith({ to: "/" });
    });
  });

  it("shows an inline error when completion fails and keeps the user on the wizard", async () => {
    const user = userEvent.setup();
    mockSaveConfig.mockRejectedValue(new Error("Save failed"));

    renderWizard();
    await walkToFinalStepWithDefaults(user);
    await user.click(screen.getByRole("button", { name: /complete setup/i }));

    expect(await screen.findByText("Save failed")).toBeVisible();
    expect(mockNavigate).not.toHaveBeenCalled();
    expect(getConfiguredGuardCache(60_000)).toBeNull();
    // Complete Setup remains available so the user can retry.
    expect(screen.getByRole("button", { name: /complete setup/i })).toBeEnabled();
  });
});
