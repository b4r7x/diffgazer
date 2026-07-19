import { cleanup } from "ink-testing-library";
import { afterEach, describe, expect, test, vi } from "vitest";
import { cleanupRootFrames, renderRootFrame } from "../../../testing/render-root-frame";
import { OnboardingWizard } from "./wizard";

vi.mock("@diffgazer/core/api/hooks", () => ({
  useInit: () => ({ data: undefined, isLoading: false }),
}));

vi.mock("@diffgazer/core/providers", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@diffgazer/core/providers")>()),
  useModelSource: () => ({
    models: Array.from({ length: 20 }, (_, index) => ({
      id: `snapshot-model-${index}`,
      name: `Snapshot Model ${index}`,
      description: "Bundled model",
      tier: "paid",
      recommended: index === 0,
    })),
    loading: false,
    error: null,
    isOpenRouter: false,
    source: "snapshot",
    fetchedAt: null,
    retry: vi.fn(),
  }),
}));

vi.mock("../hooks/use-wizard", () => ({
  useOnboardingWizard: () => ({
    currentStep: "model",
    stepIndex: 3,
    focusArea: "nav",
    navIndex: 1,
    isFirstStep: false,
    isLastStep: false,
    canProceed: true,
    isSaving: false,
    error: null,
    apiKeyInputFocused: false,
    wizardData: {
      secretsStorage: "file",
      provider: "gemini",
      inputMethod: "paste",
      apiKey: "",
      model: "snapshot-model-0",
      defaultLenses: [],
      agentExecution: "sequential",
    },
    handleSecretsStorageChange: vi.fn(),
    handleProviderChange: vi.fn(),
    handleInputMethodChange: vi.fn(),
    handleApiKeyChange: vi.fn(),
    setApiKeyInputFocused: vi.fn(),
    handleModelChange: vi.fn(),
    handleLensesChange: vi.fn(),
    handleAgentExecutionChange: vi.fn(),
    cycleFocusZone: vi.fn(),
    moveNavIndex: vi.fn(),
    handleBack: vi.fn(),
    handleNext: vi.fn(),
  }),
}));

afterEach(() => {
  cleanup();
  cleanupRootFrames();
});

describe("OnboardingWizard", () => {
  test("keeps Back and Next visible with the wrapped snapshot notice at 80 by 24", async () => {
    const { lastFrame } = renderRootFrame(80, 24, <OnboardingWizard />);

    await vi.waitFor(() => expect(lastFrame()).toContain("bundled model catalog"));
    const frame = lastFrame() ?? "";
    expect(frame).toContain("Back");
    expect(frame).toContain("Next");
    expect(frame.split("\n")).toHaveLength(24);
  });
});
