/**
 * @vitest-environment jsdom
 */
import { type BoundApi, createApi } from "@diffgazer/core/api";
import { FooterProvider } from "@diffgazer/core/footer";
import { createTestQueryWrapper } from "@diffgazer/core/testing/query-wrapper";
import { render as renderInk } from "ink-testing-library";
import { createElement, type ReactNode } from "react";
import { beforeEach, describe, expect, it, type Mock, vi } from "vitest";
import { NavigationProvider } from "../../../app/providers/navigation";
import { waitUntil } from "../../../testing/wait-until";
import { CliThemeProvider } from "../../../theme/provider";
import { OnboardingWizard } from "./wizard";

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

describe("OnboardingWizard interaction", () => {
  beforeEach(() => {
    terminalDimensions.current = { columns: 80, rows: 24 };
    mockSaveSettings = vi.fn<BoundApi["saveSettings"]>().mockResolvedValue(undefined);
    mockRunConfigurationAction = vi
      .fn<BoundApi["executeConfigurationAction"]>()
      .mockResolvedValue({ action: "delete", status: "succeeded" });
  });

  it("walks a hosted product through authentication without early persistence", async () => {
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
    await waitUntil(() => view.lastFrame()?.includes("CONFIGURE ENDPOINT") ?? false);

    view.stdin.write("\t");
    await flushInk();
    view.stdin.write("\u001b[C");
    await flushInk();
    view.stdin.write("\r");
    await waitUntil(() => view.lastFrame()?.includes("CONFIGURE AUTHENTICATION") ?? false);

    expect(view.lastFrame()).toContain("Paste API key directly");
    expect(mockSaveSettings).not.toHaveBeenCalled();
    expect(mockRunConfigurationAction).not.toHaveBeenCalled();
    view.unmount();
  });
});
