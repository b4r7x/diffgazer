import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ApiProvider } from "@diffgazer/core/api/hooks";
import { createApi, type BoundApi } from "@diffgazer/core/api";
import { KeyboardProvider } from "@diffgazer/keys";
import { AVAILABLE_PROVIDERS, GEMINI_MODEL_INFO } from "@diffgazer/core/schemas/config";
import { FooterProvider } from "@/components/layout";
import { ConfigProvider } from "@/app/providers/config-provider";
import {
  getConfiguredGuardCache,
  invalidateConfigGuardCache,
} from "@/lib/config-guard-cache";
import { escapeRegExp } from "@/testing";
import type { ReactNode } from "react";

const mockNavigate = vi.fn();

vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => mockNavigate,
}));

import { OnboardingWizard } from "../components/onboarding-wizard";

function makeInitResponse(overrides: Record<string, unknown> = {}) {
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
      missing: [] as string[],
    },
    ...overrides,
  };
}

let mockLoadInit: ReturnType<typeof vi.fn>;
let mockGetProviderStatus: ReturnType<typeof vi.fn>;
let mockSaveSettings: ReturnType<typeof vi.fn>;
let mockSaveConfig: ReturnType<typeof vi.fn>;

function createTestApi(): BoundApi {
  return {
    ...createApi({ baseUrl: "http://localhost" }),
    loadInit: mockLoadInit,
    getProviderStatus: mockGetProviderStatus,
    saveSettings: mockSaveSettings,
    saveConfig: mockSaveConfig,
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
  // storage step — default file storage already selected.
  await expectStep(/secrets storage/i);
  await clickNext(user);

  // provider step — Gemini is preselected.
  await expectStep(/ai provider/i);
  await clickNext(user);

  // api-key step — switch to env method so canProceed is true.
  await expectStep(/api key/i);
  await user.click(getRadio(/import from env/i));
  await waitFor(() => expect(getRadio(/import from env/i)).toHaveAttribute("aria-checked", "true"));
  await clickNext(user);

  // model step — default model is gemini-2.5-flash.
  await expectStep(/model selection/i);
  await clickNext(user);

  // analysis step — defaults select all lenses, just continue.
  await expectStep(/analysis configuration/i);
  await clickNext(user);

  // execution step — defaults to sequential.
  await expectStep(/agent execution/i);
}

describe("OnboardingWizard", () => {
  beforeEach(() => {
    invalidateConfigGuardCache();
    mockNavigate.mockReset();
    mockLoadInit = vi.fn().mockResolvedValue(makeInitResponse());
    mockGetProviderStatus = vi
      .fn()
      .mockResolvedValue([{ provider: "gemini", hasApiKey: false, isActive: false }]);
    mockSaveSettings = vi.fn().mockResolvedValue(undefined);
    mockSaveConfig = vi.fn().mockResolvedValue(undefined);
  });

  it("disables the Next action on the api-key step until canProceed is satisfied", async () => {
    const user = userEvent.setup();
    renderWizard();

    await expectStep(/secrets storage/i);
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

    // Storage step — first option is "File Storage", auto-selected.
    await expectStep(/secrets storage/i);
    expect(getRadio(/file storage/i)).toHaveAttribute("aria-checked", "true");
    await clickNext(user);

    // Provider step — first provider is checked (defaults from AVAILABLE_PROVIDERS[0] = gemini).
    const firstProvider = AVAILABLE_PROVIDERS[0]!;
    await expectStep(/ai provider/i);
    expect(getRadio(new RegExp(firstProvider.name, "i"))).toHaveAttribute("aria-checked", "true");
    await clickNext(user);

    // api-key step — switch to env to unblock and advance.
    await expectStep(/api key/i);
    await user.click(getRadio(/import from env/i));
    await clickNext(user);

    // Model step — default model is gemini-2.5-flash for the first provider.
    await expectStep(/model selection/i);
    const defaultModelName = GEMINI_MODEL_INFO[firstProvider.defaultModel as keyof typeof GEMINI_MODEL_INFO]?.name;
    expect(defaultModelName).toBeTruthy();
    expect(getRadio(new RegExp(escapeRegExp(defaultModelName!), "i"))).toHaveAttribute("aria-checked", "true");
  });

  it("marks the app as configured after a successful completion", async () => {
    const user = userEvent.setup();
    renderWizard();

    await walkToFinalStepWithDefaults(user);
    await user.click(screen.getByRole("button", { name: /complete setup/i }));

    await waitFor(() => {
      expect(mockSaveSettings).toHaveBeenCalledWith(
        expect.objectContaining({ secretsStorage: "file" }),
      );
      expect(mockSaveConfig).toHaveBeenCalledWith(
        expect.objectContaining({ provider: AVAILABLE_PROVIDERS[0]!.id }),
      );
      expect(getConfiguredGuardCache(60_000)).toBe(true);
      expect(mockNavigate).toHaveBeenCalledWith({ to: "/" });
    });
  });

  it("submits the wizard payload derived from user selections", async () => {
    const user = userEvent.setup();
    renderWizard();

    // Storage: switch to keyring.
    await expectStep(/secrets storage/i);
    await user.click(getRadio(/system keyring/i));
    await clickNext(user);

    // Provider: keep gemini (default).
    await expectStep(/ai provider/i);
    await clickNext(user);

    // api-key step: switch to env so payload uses "env" sentinel.
    await expectStep(/api key/i);
    await user.click(getRadio(/import from env/i));
    await clickNext(user);

    // Model: select gemini-2.5-pro instead of default.
    await expectStep(/model selection/i);
    const proModelName = GEMINI_MODEL_INFO["gemini-2.5-pro"].name;
    await user.click(getRadio(new RegExp(escapeRegExp(proModelName), "i")));
    await clickNext(user);

    // Analysis: keep all lenses.
    await expectStep(/analysis configuration/i);
    await clickNext(user);

    // Execution: select parallel.
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
        apiKey: "env",
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
