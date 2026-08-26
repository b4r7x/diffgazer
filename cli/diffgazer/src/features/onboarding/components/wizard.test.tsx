/**
 * @vitest-environment jsdom
 */
import { type BoundApi, createApi } from "@diffgazer/core/api";
import type {
  ClientConfigurationSummary,
  ConfigurationModelsResponse,
} from "@diffgazer/core/schemas/config";
import { DEFAULT_SETTINGS } from "@diffgazer/core/schemas/config";
import { GEMINI_CONFIGURATION } from "@diffgazer/core/testing/provider-fixtures";
import { createTestQueryWrapper } from "@diffgazer/core/testing/query-wrapper";
import { cleanup } from "ink-testing-library";
import { createElement, type ReactNode } from "react";
import stripAnsi from "strip-ansi";
import { afterEach, beforeEach, describe, expect, type Mock, test, vi } from "vitest";
import { NavigationProvider } from "../../../app/providers/navigation";
import { cleanupRootFrames, renderRootFrame } from "../../../testing/render-root-frame";
import { waitUntil } from "../../../testing/wait-until";
import { OnboardingWizard } from "./wizard";

const terminalDimensions = vi.hoisted(() => ({ current: { columns: 80, rows: 24 } }));

vi.mock("../../../hooks/use-terminal-dimensions", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../../hooks/use-terminal-dimensions")>();
  return {
    ...actual,
    useTerminalDimensions: () => terminalDimensions.current,
  };
});

vi.mock("@diffgazer/core/api/hooks", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@diffgazer/core/api/hooks")>();
  return {
    ...actual,
    useConfigurationInit: () => ({
      data: {
        configurations: [],
        selectedConfigurationId: null,
        setup: {
          hasSecretsStorage: false,
          hasProvider: false,
          hasModel: false,
          hasTrust: false,
          isConfigured: false,
          isReady: false,
          missing: ["provider"],
        },
      },
      isLoading: false,
      isFetching: false,
      error: null,
      refetch: vi.fn(),
    }),
  };
});

const DRAFT_CONFIGURATION: ClientConfigurationSummary = {
  ...GEMINI_CONFIGURATION,
  selectedModelId: null,
};

const DISCOVERED_MODELS: ConfigurationModelsResponse = {
  status: "passed",
  configurationId: DRAFT_CONFIGURATION.configurationId,
  productId: DRAFT_CONFIGURATION.productId,
  transportFamily: DRAFT_CONFIGURATION.transportFamily,
  models: [{ id: "gemini-2.5-flash", name: "gemini-2.5-flash", description: "1M", tier: "paid" }],
  checkedAt: "2026-07-31T12:00:00.000Z",
  source: "snapshot",
  cached: false,
};

let mockSaveSettings: Mock<BoundApi["saveSettings"]>;
let mockGetSettings: Mock<BoundApi["getSettings"]>;
let mockRunConfigurationAction: Mock<BoundApi["executeConfigurationAction"]>;
let mockGetConfigurationModels: Mock<BoundApi["getConfigurationModels"]>;

function createWrapper() {
  const api = {
    ...createApi({ baseUrl: "http://localhost" }),
    saveSettings: mockSaveSettings,
    getSettings: mockGetSettings,
    executeConfigurationAction: mockRunConfigurationAction,
    getConfigurationModels: mockGetConfigurationModels,
  } satisfies BoundApi;
  const { Wrapper: ApiWrapper } = createTestQueryWrapper({ api });

  return ({ children }: { children: ReactNode }) =>
    createElement(
      ApiWrapper,
      null,
      createElement(NavigationProvider, {
        initialRoute: { screen: "onboarding" },
        children,
      }),
    );
}

async function flushInk(times = 4): Promise<void> {
  for (let index = 0; index < times; index += 1) {
    await new Promise((resolve) => setImmediate(resolve));
  }
}

afterEach(() => {
  cleanup();
  cleanupRootFrames();
});

describe("OnboardingWizard", () => {
  beforeEach(() => {
    terminalDimensions.current = { columns: 80, rows: 24 };
    mockSaveSettings = vi.fn<BoundApi["saveSettings"]>().mockResolvedValue(undefined);
    mockGetSettings = vi.fn<BoundApi["getSettings"]>().mockResolvedValue(DEFAULT_SETTINGS);
    mockRunConfigurationAction = vi
      .fn<BoundApi["executeConfigurationAction"]>()
      .mockResolvedValue({ action: "delete", status: "succeeded" });
    mockGetConfigurationModels = vi
      .fn<BoundApi["getConfigurationModels"]>()
      .mockResolvedValue(DISCOVERED_MODELS);
  });

  test("renders the dynamic product step with Back and Next actions at 80 by 24", async () => {
    const Wrapper = createWrapper();
    const { lastFrame } = renderRootFrame(
      80,
      24,
      <Wrapper>
        <OnboardingWizard />
      </Wrapper>,
    );

    await flushInk();
    await vi.waitFor(() => expect(lastFrame()).toContain("SELECT PRODUCT"));
    const frame = stripAnsi(lastFrame() ?? "").replace(/\s+/g, " ");
    // Five steps fit the 80-column floor, so the full progress bar renders.
    expect(frame).toContain("[o] Product");
    expect(frame).toContain("[ ] Model");
    expect(frame).toContain("Google Gemini");
    expect(frame).toContain("[ Next ]");
  });

  test("goes straight from the model to the product notice without a conformance step", async () => {
    terminalDimensions.current = { columns: 80, rows: 40 };
    mockRunConfigurationAction.mockImplementation(async (action) =>
      action.action === "create"
        ? { action: "create", status: "succeeded", configuration: DRAFT_CONFIGURATION }
        : { action: "delete", status: "succeeded" },
    );

    const Wrapper = createWrapper();
    const { lastFrame, stdin } = renderRootFrame(
      80,
      40,
      <Wrapper>
        <OnboardingWizard />
      </Wrapper>,
    );
    // Ink re-emits colour codes and re-wraps every line, so both are normalised
    // away before the frame is read as prose.
    const frameText = () => stripAnsi(lastFrame() ?? "").replace(/\s+/g, " ");
    const showsStep = (title: string) => frameText().includes(title.toUpperCase());

    await flushInk();
    stdin.write("\t");
    await flushInk();
    stdin.write("\r");
    await waitUntil(() => showsStep("Configure Endpoint"));

    stdin.write("\t");
    await flushInk();
    stdin.write("\u001b[C");
    await flushInk();
    stdin.write("\r");
    await waitUntil(() => showsStep("Configure Authentication"));

    // Highlighting the environment method selects it, so the draft gains a
    // credential without typing a literal key into the test.
    stdin.write("\u001b[B");
    await flushInk();
    stdin.write("\t");
    await flushInk();
    stdin.write("\r");
    await waitUntil(() => showsStep("Select Model"));

    await waitUntil(() => frameText().includes("gemini-2.5-flash"));
    stdin.write("\r");
    await flushInk();
    stdin.write("\t");
    await flushInk();
    stdin.write("\u001b[C");
    await flushInk();
    stdin.write("\r");
    await waitUntil(() => showsStep("Provider Consent"));

    expect(frameText()).toContain("Diffgazer sends repository content");
    expect(frameText()).toContain("Google Gemini notice:");
    expect(frameText()).toContain("[ Accept ]");
  });

  test("pre-accepts the consent step when provider consent is already on record", async () => {
    terminalDimensions.current = { columns: 80, rows: 40 };
    mockRunConfigurationAction.mockImplementation(async (action) =>
      action.action === "create"
        ? { action: "create", status: "succeeded", configuration: DRAFT_CONFIGURATION }
        : { action: "delete", status: "succeeded" },
    );
    mockGetSettings.mockResolvedValue({
      ...DEFAULT_SETTINGS,
      providerConsent: { version: 1, acceptedAt: "2026-08-01T09:00:00.000Z" },
    });

    const Wrapper = createWrapper();
    const { lastFrame, stdin } = renderRootFrame(
      80,
      40,
      <Wrapper>
        <OnboardingWizard />
      </Wrapper>,
    );
    const frameText = () => stripAnsi(lastFrame() ?? "").replace(/\s+/g, " ");
    const showsStep = (title: string) => frameText().includes(title.toUpperCase());

    await flushInk();
    stdin.write("\t");
    await flushInk();
    stdin.write("\r");
    await waitUntil(() => showsStep("Configure Endpoint"));
    stdin.write("\t");
    await flushInk();
    stdin.write("\u001b[C");
    await flushInk();
    stdin.write("\r");
    await waitUntil(() => showsStep("Configure Authentication"));
    stdin.write("\u001b[B");
    await flushInk();
    stdin.write("\t");
    await flushInk();
    stdin.write("\r");
    await waitUntil(() => showsStep("Select Model"));
    await waitUntil(() => frameText().includes("gemini-2.5-flash"));
    stdin.write("\r");
    await flushInk();
    stdin.write("\t");
    await flushInk();
    stdin.write("\u001b[C");
    await flushInk();
    stdin.write("\r");
    await waitUntil(() => showsStep("Provider Consent"));

    // Nothing left to accept: the recorded consent stands and Complete Setup is live.
    expect(frameText()).toContain("[ Accepted ]");
    expect(frameText()).toContain("[ Complete Setup ]");
  });
});
