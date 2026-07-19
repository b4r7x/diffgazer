/**
 * @vitest-environment jsdom
 */
import { type BoundApi, createApi } from "@diffgazer/core/api";
import { FooterProvider, useFooterData } from "@diffgazer/core/footer";
import { createDeferred } from "@diffgazer/core/testing/deferred";
import { createTestQueryWrapper } from "@diffgazer/core/testing/query-wrapper";
import { act, renderHook, waitFor } from "@testing-library/react";
import { Text } from "ink";
import { render as renderInk } from "ink-testing-library";
import { createElement, type ReactNode, useContext, useMemo } from "react";
import { beforeEach, describe, expect, it, type Mock, vi } from "vitest";

import { TerminalKeyboardProvider } from "../../../app/providers/keyboard";
import { NavigationProvider } from "../../../app/providers/navigation-provider";
import { AppGlobalShortcuts } from "../../../app/root";
import { ExitPreparationProvider } from "../../../hooks/use-exit";
import { KeyboardContext, type KeyboardContextValue } from "../../../hooks/use-keyboard";
import { registerServerSet } from "../../../lib/servers/stop-all";
import { CliThemeProvider } from "../../../theme/provider";
import { OnboardingWizard } from "../components/wizard";
import { useOnboardingWizard } from "./use-wizard";

const terminalDimensions = vi.hoisted(() => ({ current: { columns: 80, rows: 24 } }));

vi.mock("../../../hooks/use-terminal-dimensions", () => ({
  useTerminalDimensions: () => terminalDimensions.current,
}));

let mockSaveSettings: Mock<BoundApi["saveSettings"]>;
let mockSaveConfig: Mock<BoundApi["saveConfig"]>;
let mockDeleteProviderCredentials: Mock<BoundApi["deleteProviderCredentials"]>;
let mockGetProviderStatus: Mock<BoundApi["getProviderStatus"]>;
let mockGetProviderModels: Mock<BoundApi["getProviderModels"]>;

function createWrapper() {
  const api = {
    ...createApi({ baseUrl: "http://localhost" }),
    saveSettings: mockSaveSettings,
    saveConfig: mockSaveConfig,
    deleteProviderCredentials: mockDeleteProviderCredentials,
    getProviderStatus: mockGetProviderStatus,
    getProviderModels: mockGetProviderModels,
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

function FooterProbe() {
  const { shortcuts } = useFooterData();
  const output = shortcuts
    .map(
      ({ key, label, disabled }) => `${key}:${label}:${disabled === true ? "disabled" : "enabled"}`,
    )
    .join("|");
  return <Text>{output}</Text>;
}

function QRegistrationBoundary({
  children,
  onRegistered,
}: {
  children: ReactNode;
  onRegistered: () => void;
}) {
  const keyboard = useContext(KeyboardContext);
  const observedKeyboard = useMemo<KeyboardContextValue | null>(() => {
    if (!keyboard) return null;

    return {
      ...keyboard,
      registerGlobalHandler: (hotkey, handler) => {
        const unregister = keyboard.registerGlobalHandler(hotkey, handler);
        if (hotkey === "q") onRegistered();
        return unregister;
      },
    };
  }, [keyboard, onRegistered]);

  if (!observedKeyboard) throw new Error("keyboard provider did not mount");
  return <KeyboardContext value={observedKeyboard}>{children}</KeyboardContext>;
}

describe("useOnboardingWizard", () => {
  beforeEach(() => {
    terminalDimensions.current = { columns: 80, rows: 24 };
    mockSaveSettings = vi.fn<BoundApi["saveSettings"]>().mockResolvedValue(undefined);
    mockSaveConfig = vi.fn<BoundApi["saveConfig"]>().mockResolvedValue(undefined);
    mockDeleteProviderCredentials = vi
      .fn<BoundApi["deleteProviderCredentials"]>()
      .mockResolvedValue({ deleted: true, provider: "openrouter" });
    mockGetProviderStatus = vi
      .fn<BoundApi["getProviderStatus"]>()
      .mockResolvedValue([{ provider: "gemini", hasApiKey: false, isActive: false }]);
    mockGetProviderModels = vi.fn<BoundApi["getProviderModels"]>().mockResolvedValue({
      models: [
        {
          id: "gemini-2.5-flash",
          name: "Gemini 2.5 Flash",
          description: "Fast model",
          tier: "free",
          recommended: true,
        },
      ],
      fetchedAt: "2026-01-01T00:00:00.000Z",
      source: "snapshot",
      cached: false,
    });
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
    expect(narrow.lastFrame()).toContain("[o] Step 1 of 6: Storage");
    narrow.unmount();

    terminalDimensions.current = { columns: 80, rows: 24 };
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
    const progressLine = wide
      .lastFrame()
      ?.split("\n")
      .find((line) => line.includes("[o] Storage"));
    expect(progressLine).toContain("[ ] Provider");
    expect(progressLine).toContain("[ ] API Key");
    expect(progressLine).toContain("[ ] Execution");
    expect(progressLine).not.toMatch(/[●○]/u);
    wide.unmount();
  });

  it("saves storage before credentials and absorbs a cleanup failure without rethrowing", async () => {
    mockDeleteProviderCredentials.mockRejectedValueOnce(new Error("cleanup failed"));

    const wrapper = createWrapper();
    const hook = renderHook(() => useOnboardingWizard(), { wrapper });

    act(() => hook.result.current.handleNext());
    act(() => hook.result.current.handleProviderChange("openrouter"));
    act(() => hook.result.current.handleNext());
    act(() => hook.result.current.handleInputMethodChange("env"));
    act(() => hook.result.current.handleApiKeyChange("ignored"));

    await act(async () => {
      hook.result.current.handleNext();
    });

    expect(mockSaveSettings.mock.invocationCallOrder[0]).toBeLessThan(
      mockSaveConfig.mock.invocationCallOrder[0] ?? Number.POSITIVE_INFINITY,
    );
    expect(mockSaveSettings).toHaveBeenCalledWith({ secretsStorage: "file" });
    expect(mockSaveConfig).toHaveBeenCalledWith({
      provider: "openrouter",
      apiKey: { kind: "env", varName: "OPENROUTER_API_KEY" },
    });

    let threw = false;
    await act(async () => {
      try {
        await hook.result.current.cleanupEarlySave();
      } catch {
        threw = true;
      }
    });

    expect(threw).toBe(false);
    expect(mockDeleteProviderCredentials).toHaveBeenCalledWith("openrouter");
  });

  it("surfaces a failed early save through the wizard error so the TUI can render it", async () => {
    mockSaveConfig.mockRejectedValueOnce(new Error("STORAGE_NOT_CONFIGURED"));

    const wrapper = createWrapper();
    const hook = renderHook(() => useOnboardingWizard(), { wrapper });

    act(() => hook.result.current.handleNext());
    act(() => hook.result.current.handleProviderChange("openrouter"));
    act(() => hook.result.current.handleNext());
    act(() => hook.result.current.handleInputMethodChange("env"));
    act(() => hook.result.current.handleApiKeyChange("ignored"));

    await act(async () => {
      hook.result.current.handleNext();
    });

    expect(hook.result.current.error).toBe("STORAGE_NOT_CONFIGURED");
    // The failed early save keeps the user on the api-key step.
    expect(hook.result.current.currentStep).toBe("api-key");
  });

  it("awaits abandoned credential cleanup before q shutdown can stop the server", async () => {
    const qRegistration = createDeferred<void>();
    const deletion = createDeferred<{
      deleted: boolean;
      provider: "openrouter";
    }>();
    const order: string[] = [];
    mockDeleteProviderCredentials.mockImplementation(async () => {
      order.push("delete-start");
      const result = await deletion.promise;
      order.push("delete-complete");
      return result;
    });
    const stop = vi.fn(async () => {
      order.push("server-stop");
    });
    registerServerSet([{ start: vi.fn(async () => {}), stop }]);

    const exitProcess = vi.fn();
    let wizard: ReturnType<typeof useOnboardingWizard> | null = null;

    function WizardExitHarness() {
      wizard = useOnboardingWizard();
      return <AppGlobalShortcuts />;
    }

    const Wrapper = createWrapper();
    const shortcuts = renderInk(
      <Wrapper>
        <TerminalKeyboardProvider>
          <QRegistrationBoundary onRegistered={qRegistration.resolve}>
            <ExitPreparationProvider exitProcess={exitProcess}>
              <WizardExitHarness />
            </ExitPreparationProvider>
          </QRegistrationBoundary>
        </TerminalKeyboardProvider>
      </Wrapper>,
    );

    await qRegistration.promise;
    if (!wizard) throw new Error("wizard did not mount");
    act(() => wizard?.handleNext());
    act(() => wizard?.handleProviderChange("openrouter"));
    act(() => wizard?.handleNext());
    act(() => wizard?.handleInputMethodChange("env"));
    act(() => wizard?.handleApiKeyChange("ignored"));
    act(() => wizard?.handleNext());
    await waitFor(() => expect(wizard?.currentStep).toBe("model"));

    shortcuts.stdin.write("q");
    await flushInk();

    await waitFor(() => expect(mockDeleteProviderCredentials).toHaveBeenCalledWith("openrouter"));
    expect(stop).not.toHaveBeenCalled();
    expect(exitProcess).not.toHaveBeenCalled();

    deletion.resolve({ deleted: true, provider: "openrouter" });
    await waitFor(() => expect(exitProcess).toHaveBeenCalledOnce());

    expect(order).toEqual(["delete-start", "delete-complete", "server-stop"]);
  });

  it("reports an explicit terminal warning when unmount cleanup fails", async () => {
    const warning = vi.spyOn(console, "error").mockImplementation(() => {});
    mockDeleteProviderCredentials.mockRejectedValueOnce(new Error("permission denied"));
    const hook = renderHook(() => useOnboardingWizard(), { wrapper: createWrapper() });

    act(() => hook.result.current.handleNext());
    act(() => hook.result.current.handleProviderChange("openrouter"));
    act(() => hook.result.current.handleNext());
    act(() => hook.result.current.handleInputMethodChange("env"));
    act(() => hook.result.current.handleApiKeyChange("ignored"));
    act(() => hook.result.current.handleNext());
    await waitFor(() => expect(hook.result.current.currentStep).toBe("model"));

    hook.unmount();

    await waitFor(() =>
      expect(warning).toHaveBeenCalledWith(
        expect.stringContaining("Warning: Failed to remove saved credentials: permission denied"),
      ),
    );
    warning.mockRestore();
  });

  it("keeps Back and Next nav focus exclusive via navIndex", () => {
    const wrapper = createWrapper();
    const hook = renderHook(() => useOnboardingWizard(), { wrapper });

    act(() => hook.result.current.handleNext());
    act(() => hook.result.current.toggleFocusArea());

    expect(hook.result.current.navIndex).toBe(0);

    act(() => hook.result.current.moveNavIndex(1));
    expect(hook.result.current.navIndex).toBe(1);

    act(() => hook.result.current.moveNavIndex(-1));
    expect(hook.result.current.navIndex).toBe(0);
  });

  it("allows the focused Back action while the current step blocks Next", () => {
    const wrapper = createWrapper();
    const hook = renderHook(() => useOnboardingWizard(), { wrapper });

    act(() => hook.result.current.handleNext());
    act(() => hook.result.current.handleProviderChange("openrouter"));
    act(() => hook.result.current.handleNext());
    expect(hook.result.current.currentStep).toBe("api-key");
    expect(hook.result.current.canProceed).toBe(false);

    act(() => hook.result.current.toggleFocusArea());
    expect(hook.result.current.navIndex).toBe(0);

    act(() => hook.result.current.handleBack());
    expect(hook.result.current.currentStep).toBe("provider");
  });

  it("keeps the focused Next action on a blocked step without advancing", () => {
    const wrapper = createWrapper();
    const hook = renderHook(() => useOnboardingWizard(), { wrapper });

    act(() => hook.result.current.handleNext());
    act(() => hook.result.current.handleProviderChange("openrouter"));
    act(() => hook.result.current.handleNext());
    act(() => hook.result.current.toggleFocusArea());
    act(() => hook.result.current.moveNavIndex(1));
    act(() => hook.result.current.handleNext());

    expect(hook.result.current.currentStep).toBe("api-key");
    expect(hook.result.current.navIndex).toBe(1);
  });

  it("enters an API key, tabs to Next, and advances to model selection", async () => {
    const Wrapper = createWrapper();
    const view = renderInk(
      <Wrapper>
        <CliThemeProvider initialTheme="dark">
          <FooterProvider initialShortcuts={[]}>
            <OnboardingWizard />
            <FooterProbe />
          </FooterProvider>
        </CliThemeProvider>
      </Wrapper>,
    );

    await flushInk();
    expect(view.lastFrame()).toContain("SECRETS STORAGE");

    view.stdin.write("\t");
    await flushInk();
    view.stdin.write("\r");
    await flushInk();
    expect(view.lastFrame()).toContain("AI PROVIDER");

    view.stdin.write("\t");
    await flushInk();
    view.stdin.write("\u001b[C");
    await flushInk();
    view.stdin.write("\r");
    await flushInk();
    expect(view.lastFrame()).toContain("API KEY");

    view.stdin.write("\t");
    await flushInk();
    view.stdin.write("\t");
    await flushInk();
    expect(view.lastFrame()).toContain("Enter:Next:disabled");

    view.stdin.write("\u001b[D");
    await flushInk();
    expect(view.lastFrame()).toContain("Enter:Back:enabled");

    view.stdin.write("\t");
    await flushInk();
    view.stdin.write("\t");
    await flushInk();
    view.stdin.write("sk-walkthrough-key");
    await flushInk();
    expect(view.lastFrame()).toContain("*".repeat("sk-walkthrough-key".length));
    expect(view.lastFrame()).toContain("Tab:Focus Actions:enabled");

    view.stdin.write("\t");
    await flushInk();
    expect(view.lastFrame()).toContain("Enter:Next:enabled");
    view.stdin.write("\r");
    await flushInk(8);

    expect(view.lastFrame()).toContain("MODEL SELECTION");
    view.unmount();
  });

  it("skips the fixed environment input when tabbing to Next", async () => {
    const Wrapper = createWrapper();
    const view = renderInk(
      <Wrapper>
        <CliThemeProvider initialTheme="dark">
          <FooterProvider initialShortcuts={[]}>
            <OnboardingWizard />
            <FooterProbe />
          </FooterProvider>
        </CliThemeProvider>
      </Wrapper>,
    );

    await flushInk();
    view.stdin.write("\t");
    await flushInk();
    view.stdin.write("\r");
    await flushInk();
    view.stdin.write("\t");
    await flushInk();
    view.stdin.write("\u001b[C");
    await flushInk();
    view.stdin.write("\r");
    await flushInk();

    expect(view.lastFrame()).toContain("API KEY");
    expect(view.lastFrame()).toContain("Tab:Focus Input:enabled");

    view.stdin.write("\u001b[B");
    await flushInk();

    expect(view.lastFrame()).toContain("Fixed for this provider");
    expect(view.lastFrame()).toContain("Tab:Focus Actions:enabled");
    expect(view.lastFrame()).not.toContain("Tab:Focus Input:enabled");

    view.stdin.write("\t");
    await flushInk();
    expect(view.lastFrame()).toContain("Enter:Next:enabled");

    view.stdin.write("\r");
    await flushInk(8);

    expect(view.lastFrame()).toContain("MODEL SELECTION");
    view.unmount();
  });
});
