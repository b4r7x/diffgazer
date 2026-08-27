/**
 * @vitest-environment jsdom
 */
import { createApi } from "@diffgazer/core/api";
import { FooterProvider } from "@diffgazer/core/footer";
import { createTestQueryWrapper } from "@diffgazer/core/testing/query-wrapper";
import { render as renderInk } from "ink-testing-library";
import { createElement, type ReactNode } from "react";
import { afterAll, describe, expect, it, vi } from "vitest";
import { NavigationProvider } from "../../../app/providers/navigation";
import { frameForegrounds } from "../../../testing/frame-colors";
import { waitUntil } from "../../../testing/wait-until";
import { selectionHue } from "../../../theme/chrome";
import { darkPalette } from "../../../theme/palettes";
import { CliThemeProvider } from "../../../theme/provider";
import { OnboardingWizard } from "./wizard";

// Ink reads colour support from the environment when it first imports chalk,
// which happens above this file's own imports. The rest of the wizard suite
// asserts plain text, so this colour case lives here instead.
const restoreForceColor = vi.hoisted(() => {
  const previous = process.env.FORCE_COLOR;
  process.env.FORCE_COLOR = "3";
  return () => {
    if (previous === undefined) delete process.env.FORCE_COLOR;
    else process.env.FORCE_COLOR = previous;
  };
});

afterAll(restoreForceColor);

const terminalDimensions = vi.hoisted(() => ({ current: { columns: 80, rows: 24 } }));

vi.mock("../../../hooks/use-terminal-dimensions", () => ({
  useTerminalDimensions: () => terminalDimensions.current,
}));

const ARROW_RIGHT = "\u001b[C";

function renderWizard() {
  const { Wrapper: ApiWrapper } = createTestQueryWrapper({
    api: createApi({ baseUrl: "http://localhost" }),
  });
  const Wrapper = ({ children }: { children: ReactNode }) =>
    createElement(
      ApiWrapper,
      null,
      createElement(NavigationProvider, {
        initialRoute: { screen: "onboarding" },
        children,
      }),
    );
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

function methodLine(frame: string | undefined): string {
  return (frame ?? "").split("\n").find((row) => row.includes("Paste API key directly")) ?? "";
}

describe("OnboardingWizard method highlight", () => {
  it("drops the method highlight while focus sits on the nav row", async () => {
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

    expect(frameForegrounds(methodLine(view.lastFrame()))).toContain(selectionHue(darkPalette));

    view.stdin.write("\t");
    await flushInk();
    expect(frameForegrounds(methodLine(view.lastFrame()))).toContain(selectionHue(darkPalette));

    view.stdin.write("\t");
    await flushInk();
    expect(frameForegrounds(methodLine(view.lastFrame()))).not.toContain(selectionHue(darkPalette));
    view.unmount();
  });
});
