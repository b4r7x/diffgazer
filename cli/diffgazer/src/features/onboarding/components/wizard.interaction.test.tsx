/**
 * @vitest-environment jsdom
 */
import { type BoundApi, createApi } from "@diffgazer/core/api";
import { FooterProvider } from "@diffgazer/core/footer";
import { SELECTABLE_PRODUCT_IDS } from "@diffgazer/core/providers";
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

const ARROW_UP = "\u001b[A";
const ARROW_DOWN = "\u001b[B";
const ARROW_RIGHT = "\u001b[C";

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

function renderWizard() {
  const Wrapper = createWrapper();
  return renderInk(
    <Wrapper>
      <CliThemeProvider initialTheme="dark">
        <FooterProvider initialShortcuts={[]}>
          <OnboardingWizard />
        </FooterProvider>
      </CliThemeProvider>
    </Wrapper>,
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
    const view = renderWizard();

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

  it("hands the product list down to the action row and back up on ArrowUp", async () => {
    const view = renderWizard();

    await flushInk();
    for (let index = 0; index < SELECTABLE_PRODUCT_IDS.length; index += 1) {
      view.stdin.write(ARROW_DOWN);
      await flushInk();
    }
    view.stdin.write(ARROW_UP);
    await flushInk();
    view.stdin.write("\r");
    await flushInk();
    expect(view.lastFrame()).toContain("SELECT PRODUCT");

    view.stdin.write(ARROW_DOWN);
    await flushInk();
    view.stdin.write("\r");
    await waitUntil(() => view.lastFrame()?.includes("CONFIGURE ENDPOINT") ?? false);
    view.unmount();
  });

  it("puts the api key field in the authentication step's arrow chain", async () => {
    const view = renderWizard();

    await flushInk();
    view.stdin.write("\t");
    await flushInk();
    view.stdin.write("\r");
    await waitUntil(() => view.lastFrame()?.includes("CONFIGURE ENDPOINT") ?? false);
    view.stdin.write("\t");
    await flushInk();
    view.stdin.write(ARROW_RIGHT);
    await flushInk();
    view.stdin.write("\r");
    await waitUntil(() => view.lastFrame()?.includes("CONFIGURE AUTHENTICATION") ?? false);

    view.stdin.write(ARROW_DOWN);
    await flushInk();
    view.stdin.write(ARROW_DOWN);
    await flushInk();
    view.stdin.write("abc");
    await flushInk();
    expect(view.lastFrame()).toContain("***");

    view.stdin.write(ARROW_UP);
    await flushInk();
    view.stdin.write("d");
    await flushInk();
    expect(view.lastFrame()).not.toContain("****");
    view.unmount();
  });
});
