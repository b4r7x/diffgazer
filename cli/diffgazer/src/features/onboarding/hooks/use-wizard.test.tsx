/**
 * @vitest-environment jsdom
 */
import { type BoundApi, createApi } from "@diffgazer/core/api";
import { FooterProvider, useFooterData } from "@diffgazer/core/footer";
import { getInitialWizardData } from "@diffgazer/core/onboarding";
import { createTestQueryWrapper } from "@diffgazer/core/testing/query-wrapper";
import { act, renderHook } from "@testing-library/react";
import { Text } from "ink";
import { render as renderInk } from "ink-testing-library";
import { createElement, type ReactNode } from "react";
import { beforeEach, describe, expect, it, type Mock, vi } from "vitest";
import { NavigationProvider } from "../../../app/providers/navigation";
import { CliThemeProvider } from "../../../theme/provider";
import { OnboardingWizard } from "../components/wizard";
import { useOnboardingWizard } from "./use-wizard";

const terminalDimensions = vi.hoisted(() => ({ current: { columns: 80, rows: 24 } }));

vi.mock("../../../hooks/use-terminal-dimensions", () => ({
  useTerminalDimensions: () => terminalDimensions.current,
}));

let mockSaveSettings: Mock<BoundApi["saveSettings"]>;
let mockRunConfigurationAction: Mock<BoundApi["executeConfigurationAction"]>;

function createWrapper() {
  const api = {
    ...createApi({ baseUrl: "http://localhost" }),
    saveSettings: mockSaveSettings,
    executeConfigurationAction: mockRunConfigurationAction,
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

function _FooterProbe() {
  const { shortcuts } = useFooterData();
  return (
    <Text>
      {shortcuts
        .map(({ key, label, disabled }) => `${key}:${label}:${disabled ? "disabled" : "enabled"}`)
        .join("|")}
    </Text>
  );
}

describe("useOnboardingWizard", () => {
  beforeEach(() => {
    terminalDimensions.current = { columns: 80, rows: 24 };
    mockSaveSettings = vi.fn<BoundApi["saveSettings"]>().mockResolvedValue(undefined);
    mockRunConfigurationAction = vi
      .fn<BoundApi["executeConfigurationAction"]>()
      .mockResolvedValue({ action: "delete", status: "succeeded" });
  });

  it("keeps progress labels readable in 40-column and wide frames", async () => {
    const Wrapper = createWrapper();
    terminalDimensions.current = { columns: 40, rows: 24 };
    const narrow = renderInk(
      <Wrapper>
        <CliThemeProvider initialTheme="dark">
          <FooterProvider initialShortcuts={[]}>
            <OnboardingWizard />
          </FooterProvider>
        </CliThemeProvider>
      </Wrapper>,
    );

    await flushInk();
    expect(narrow.lastFrame()).toMatch(/Step 1 of \d+: Product/);
    narrow.unmount();

    terminalDimensions.current = { columns: 120, rows: 24 };
    const wide = renderInk(
      <Wrapper>
        <CliThemeProvider initialTheme="dark">
          <FooterProvider initialShortcuts={[]}>
            <OnboardingWizard />
          </FooterProvider>
        </CliThemeProvider>
      </Wrapper>,
    );

    await flushInk();
    expect(wide.lastFrame()).toContain("Google Gemini");
    wide.unmount();
  });

  it("does not persist credentials when advancing through hosted authentication", async () => {
    const wrapper = createWrapper();
    const hook = renderHook(() => useOnboardingWizard(), { wrapper });

    act(() => hook.result.current.handleProductChange("openrouter"));
    act(() => {
      for (let index = 0; index < 3; index += 1) hook.result.current.handleNext();
    });
    act(() => hook.result.current.handleInputMethodChange("env"));
    act(() => hook.result.current.handleApiKeyChange("ignored"));
    act(() => hook.result.current.handleNext());

    expect(mockSaveSettings).not.toHaveBeenCalled();
    expect(mockRunConfigurationAction).not.toHaveBeenCalled();
  });

  it("uses the shorter CLI plan without hosted authentication controls", () => {
    const wrapper = createWrapper();
    const hook = renderHook(() => useOnboardingWizard(), { wrapper });

    act(() => hook.result.current.handleProductChange("codex-cli"));
    expect(hook.result.current.steps).toEqual([
      "product",
      "authentication",
      "model",
      "conformance",
      "acknowledgement",
    ]);
  });

  it("resets to the selected product plan without preserving literal credentials", () => {
    const wrapper = createWrapper();
    const hook = renderHook(() => useOnboardingWizard(), { wrapper });

    act(() => {
      hook.result.current.handleProductChange("qwen");
      hook.result.current.handleInputMethodChange("paste");
      hook.result.current.handleApiKeyChange("write-only-secret");
      hook.result.current.handleProductChange("local-openai");
    });

    expect(hook.result.current.wizardData).toEqual(getInitialWizardData("local-openai"));
    if (hook.result.current.wizardData.kind !== "runnable") throw new Error("expected runnable");
    expect(JSON.stringify(hook.result.current.wizardData.configurationInput)).not.toContain(
      "write-only-secret",
    );
  });

  it("moves from a local authentication step straight to the actions", () => {
    const wrapper = createWrapper();
    const hook = renderHook(() => useOnboardingWizard(), { wrapper });

    act(() => hook.result.current.handleProductChange("codex-cli"));
    act(() => hook.result.current.handleNext());
    expect(hook.result.current.currentStep).toBe("authentication");
    expect(hook.result.current.focusZone).toBe("step");

    act(() => hook.result.current.cycleFocusZone());
    expect(hook.result.current.focusZone).toBe("nav");
  });

  it("keeps the hosted method and input focus stops", () => {
    const wrapper = createWrapper();
    const hook = renderHook(() => useOnboardingWizard(), { wrapper });

    act(() => hook.result.current.handleProductChange("openrouter"));
    act(() => hook.result.current.handleNext());
    act(() => hook.result.current.handleNext());
    expect(hook.result.current.currentStep).toBe("authentication");
    expect(hook.result.current.focusZone).toBe("api-key-method");

    act(() => hook.result.current.cycleFocusZone());
    expect(hook.result.current.focusZone).toBe("api-key-input");
    act(() => hook.result.current.cycleFocusZone());
    expect(hook.result.current.focusZone).toBe("nav");
  });

  it("persists a real configuration before the model step discovers against it", async () => {
    mockRunConfigurationAction.mockResolvedValue({
      action: "create",
      status: "succeeded",
      configuration: {
        configurationId: "codex-cli-draft",
        revision: 1,
        status: "supported",
        transportFamily: "local-cli",
        productId: "codex-cli",
        installationId: "codex-installation",
        selectedModelId: null,
        notices: [],
        availableActions: ["inspect", "select", "test", "update", "delete"],
      },
    } as Awaited<ReturnType<BoundApi["executeConfigurationAction"]>>);

    const wrapper = createWrapper();
    const hook = renderHook(() => useOnboardingWizard(), { wrapper });

    act(() => hook.result.current.handleProductChange("codex-cli"));
    act(() => hook.result.current.handleNext());
    act(() =>
      hook.result.current.updateData({
        configurationInput: {
          transportFamily: "local-cli",
          productId: "codex-cli",
          installationId: "codex-installation",
        },
      }),
    );
    await act(async () => {
      hook.result.current.handleNext();
    });

    expect(hook.result.current.currentStep).toBe("model");
    expect(mockRunConfigurationAction).toHaveBeenCalledWith(
      expect.objectContaining({ action: "create" }),
    );
    // No client-invented identity may reach the server before the create.
    for (const [action] of mockRunConfigurationAction.mock.calls) {
      expect(action).not.toHaveProperty("configurationId");
    }
    expect(hook.result.current.draftConfiguration?.configurationId).toBe("codex-cli-draft");
  });

  it("keeps Back and Next nav focus exclusive via navIndex", () => {
    const wrapper = createWrapper();
    const hook = renderHook(() => useOnboardingWizard(), { wrapper });

    act(() => hook.result.current.handleNext());
    act(() => hook.result.current.cycleFocusZone());

    expect(hook.result.current.navIndex).toBe(0);
    act(() => hook.result.current.moveNavIndex(1));
    expect(hook.result.current.navIndex).toBe(1);
  });
});
