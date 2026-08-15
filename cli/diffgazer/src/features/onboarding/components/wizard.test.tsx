/**
 * @vitest-environment jsdom
 */
import { type BoundApi, createApi } from "@diffgazer/core/api";
import { canProceed, getInitialWizardData } from "@diffgazer/core/onboarding";
import { SELECTABLE_PRODUCT_IDS } from "@diffgazer/core/providers";
import type {
  ClientConfigurationSummary,
  ConfigurationModelsResponse,
} from "@diffgazer/core/schemas/config";
import {
  CONFORMANCE_TEST_COST_DISCLOSURE,
  LocalHttpConfigurationInputSchema,
} from "@diffgazer/core/schemas/config";
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
let mockRunConfigurationAction: Mock<BoundApi["executeConfigurationAction"]>;
let mockGetConfigurationModels: Mock<BoundApi["getConfigurationModels"]>;

function createWrapper() {
  const api = {
    ...createApi({ baseUrl: "http://localhost" }),
    saveSettings: mockSaveSettings,
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
    await vi.waitFor(() => expect(lastFrame()).toContain("Google Gemini"));
    const frame = lastFrame() ?? "";
    expect(frame).toContain("Step 1 of 6: Product");
    expect(frame).toContain("SELECT PRODUCT");
  });

  test("discloses the billed readiness test before the user confirms conformance", async () => {
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
    await waitUntil(() => showsStep("Verify Conformance"));

    expect(frameText()).toContain(CONFORMANCE_TEST_COST_DISCLOSURE.replace(/\s+/g, " "));
    expect(frameText()).toContain("Your first review verifies structured review support");
    // The step records an acknowledgement, so its control must not claim a
    // verification the wizard gives the user no means to perform.
    expect(frameText()).toContain("I understand");
    expect(frameText()).not.toContain("Confirm conformance");
  });

  test("names each local server in the endpoint picker instead of showing bare URLs", async () => {
    terminalDimensions.current = { columns: 100, rows: 50 };

    const Wrapper = createWrapper();
    const { lastFrame, stdin } = renderRootFrame(
      100,
      50,
      <Wrapper>
        <OnboardingWizard />
      </Wrapper>,
    );
    const frameText = () => stripAnsi(lastFrame() ?? "").replace(/\s+/g, " ");

    await flushInk();
    for (let step = 0; step < SELECTABLE_PRODUCT_IDS.indexOf("local-openai"); step += 1) {
      stdin.write("\u001b[B");
      await flushInk();
    }
    stdin.write("\r");
    await flushInk();
    stdin.write("\t");
    await flushInk();
    stdin.write("\r");
    await waitUntil(() => frameText().includes("CONFIGURE ENDPOINT"));

    expect(frameText()).toContain("LM Studio");
    expect(frameText()).toContain("http://127.0.0.1:1234/v1");
  });

  test("ollama endpoint binding stays valid without a local-openai preset", () => {
    const draft = getInitialWizardData("ollama");
    const input = draft.configurationInput;
    expect(input.transportFamily).toBe("local-http");
    expect(canProceed("endpoint-binding", draft)).toBe(true);

    expect(
      LocalHttpConfigurationInputSchema.safeParse({ ...input, presetId: "default" }).success,
    ).toBe(false);
  });
});
