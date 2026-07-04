import { cleanup, render } from "ink-testing-library";
import { afterEach, describe, expect, test, vi } from "vitest";
import { CliThemeProvider } from "../../../theme/provider";
import { NoChangesView } from "./no-changes-view";

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

describe("NoChangesView (TUI)", () => {
  test("renders the shared no-diff copy for file mode", () => {
    const { lastFrame } = render(
      <CliThemeProvider initialTheme="dark">
        <NoChangesView mode="files" onSwitchMode={vi.fn()} onBack={vi.fn()} />
      </CliThemeProvider>,
    );
    const frame = lastFrame() ?? "";

    expect(frame).toContain("No Changes in Selected Files");
    expect(frame).toContain("Review Unstaged");
    expect(frame).toContain("Back");
  });

  test("lets keyboard users go back with Escape or the reachable Back button", async () => {
    const onSwitchMode = vi.fn();
    const onBack = vi.fn();
    const { stdin } = render(
      <CliThemeProvider initialTheme="dark">
        <NoChangesView mode="files" onSwitchMode={onSwitchMode} onBack={onBack} />
      </CliThemeProvider>,
    );

    stdin.write(ESCAPE);
    await waitUntil(() => onBack.mock.calls.length === 1);

    expect(onBack).toHaveBeenCalledTimes(1);

    stdin.write(ARROW_RIGHT);
    await flush();
    stdin.write("\r");
    await waitUntil(() => onBack.mock.calls.length === 2);

    expect(onBack).toHaveBeenCalledTimes(2);
    expect(onSwitchMode).not.toHaveBeenCalled();
  });
});
