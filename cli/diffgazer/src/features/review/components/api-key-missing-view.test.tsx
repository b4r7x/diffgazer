import { FooterProvider } from "@diffgazer/core/footer";
import { cleanup, render } from "ink-testing-library";
import { afterEach, describe, expect, test, vi } from "vitest";
import { CliThemeProvider } from "../../../theme/provider";
import { ApiKeyMissingView } from "./api-key-missing-view";

const ARROW_RIGHT = "\u001b[C";
const ESCAPE = "\u001b";

afterEach(() => {
  cleanup();
});

async function flush(times = 4): Promise<void> {
  for (let i = 0; i < times; i += 1) {
    await new Promise((resolve) => setImmediate(resolve));
  }
}

async function waitUntil(predicate: () => boolean, attempts = 100): Promise<void> {
  for (let i = 0; i < attempts; i += 1) {
    if (predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
}

describe("ApiKeyMissingView (TUI)", () => {
  test("lets keyboard users go back with Escape or the reachable Back button", async () => {
    const onGoToSettings = vi.fn();
    const onBack = vi.fn();
    const { stdin, lastFrame } = render(
      <CliThemeProvider initialTheme="dark">
        <FooterProvider initialShortcuts={[]}>
          <ApiKeyMissingView provider="gemini" onGoToSettings={onGoToSettings} onBack={onBack} />
        </FooterProvider>
      </CliThemeProvider>,
    );

    expect(lastFrame()).toContain("Back");

    stdin.write(ESCAPE);
    await waitUntil(() => onBack.mock.calls.length === 1);

    expect(onBack).toHaveBeenCalledTimes(1);

    stdin.write(ARROW_RIGHT);
    await flush();
    stdin.write("\r");
    await waitUntil(() => onBack.mock.calls.length === 2);

    expect(onBack).toHaveBeenCalledTimes(2);
    expect(onGoToSettings).not.toHaveBeenCalled();
  });
});
