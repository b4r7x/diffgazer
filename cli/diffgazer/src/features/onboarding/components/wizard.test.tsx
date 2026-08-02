/**
 * @vitest-environment jsdom
 */
import { type BoundApi, createApi } from "@diffgazer/core/api";
import { createTestQueryWrapper } from "@diffgazer/core/testing/query-wrapper";
import { cleanup } from "ink-testing-library";
import { createElement, type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, type Mock, test, vi } from "vitest";
import { NavigationProvider } from "../../../app/providers/navigation";
import { cleanupRootFrames, renderRootFrame } from "../../../testing/render-root-frame";
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
    useInit: () => ({
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
});
