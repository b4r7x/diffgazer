/**
 * @vitest-environment jsdom
 */
import { type BoundApi, createApi } from "@diffgazer/core/api";
import { FooterProvider } from "@diffgazer/core/footer";
import { createTestQueryWrapper } from "@diffgazer/core/testing/query-wrapper";
import { render as renderInk } from "ink-testing-library";
import { createElement, type ReactNode } from "react";
import { beforeEach, describe, expect, it, type Mock, vi } from "vitest";

import { NavigationProvider } from "../../../app/providers/navigation-provider";
import { CliThemeProvider } from "../../../theme/provider";
import { OnboardingWizard } from "./wizard";

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

describe("OnboardingWizard interaction", () => {
  beforeEach(() => {
    terminalDimensions.current = { columns: 80, rows: 24 };
    mockSaveSettings = vi.fn<BoundApi["saveSettings"]>().mockResolvedValue(undefined);
    mockSaveConfig = vi.fn<BoundApi["saveConfig"]>().mockResolvedValue(undefined);
    mockDeleteProviderCredentials = vi
      .fn<BoundApi["deleteProviderCredentials"]>()
      .mockResolvedValue({ deleted: true, provider: "openrouter" });
    mockGetProviderStatus = vi.fn<BoundApi["getProviderStatus"]>().mockResolvedValue([
      { provider: "gemini", hasApiKey: false, isActive: false },
      { provider: "openrouter", hasApiKey: false, isActive: false },
    ]);
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

  it("shows the API Key step and storage callout when early save fails", async () => {
    mockSaveConfig.mockRejectedValueOnce(new Error("STORAGE_NOT_CONFIGURED"));

    const Wrapper = createWrapper();
    const view = renderInk(
      <Wrapper>
        <CliThemeProvider initialTheme="dark">
          <FooterProvider initialShortcuts={[]}>
            <OnboardingWizard />
          </FooterProvider>
        </CliThemeProvider>
      </Wrapper>,
    );

    await flushInk();
    view.stdin.write("\t");
    await flushInk();
    view.stdin.write("\r");
    await flushInk();

    await vi.waitFor(() => expect(view.lastFrame()).toContain("Select an AI provider"));

    view.stdin.write("\u001b[B");
    await flushInk();
    view.stdin.write("\r");
    await flushInk();

    view.stdin.write("\t");
    await flushInk();
    view.stdin.write("\u001b[C");
    await flushInk();
    view.stdin.write("\r");
    await flushInk();

    await vi.waitFor(() =>
      expect(view.lastFrame()).toContain("Provide your API key for OpenRouter"),
    );

    view.stdin.write("\u001b[B");
    await flushInk();
    view.stdin.write("\t");
    await flushInk();
    view.stdin.write("\r");
    await flushInk(8);

    await vi.waitFor(() => {
      const frame = view.lastFrame() ?? "";
      expect(frame).toContain("API KEY");
      expect(frame).toContain("STORAGE_NOT_CONFIGURED");
    });

    view.unmount();
  });
});
