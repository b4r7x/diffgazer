import { FooterProvider } from "@diffgazer/core/footer";
import { getNoChangesCopy } from "@diffgazer/core/review";
import type { ReviewMode } from "@diffgazer/core/schemas/review";
import { cleanup, render } from "ink-testing-library";
import { afterEach, describe, expect, test, vi } from "vitest";
import { flush } from "../../../testing/flush";
import { waitUntil } from "../../../testing/wait-until";
import { CliThemeProvider } from "../../../theme/provider";
import { frameText } from "../testing/frame-text";
import { NoChangesView } from "./no-changes-view";

const ARROW_RIGHT = "\u001b[C";
const ESCAPE = "\u001b";

afterEach(() => {
  cleanup();
});

describe("NoChangesView (TUI)", () => {
  test.each<[ReviewMode]>([
    ["staged"],
    ["unstaged"],
    ["files"],
  ])("renders the shared no-diff copy for %s mode", (mode) => {
    const { title, message, switchLabel } = getNoChangesCopy(mode);
    const { lastFrame } = render(
      <CliThemeProvider initialTheme="dark">
        <FooterProvider initialShortcuts={[]}>
          <NoChangesView mode={mode} onSwitchMode={vi.fn()} onBack={vi.fn()} />
        </FooterProvider>
      </CliThemeProvider>,
    );
    const frame = lastFrame() ?? "";

    expect(frame).toContain(title);
    expect(frameText(frame)).toContain(message);
    expect(frame).toContain(switchLabel);
    expect(frame).toContain("Back");
  });

  test("lets keyboard users go back with Escape or the reachable Back button", async () => {
    const onSwitchMode = vi.fn();
    const onBack = vi.fn();
    const { stdin } = render(
      <CliThemeProvider initialTheme="dark">
        <FooterProvider initialShortcuts={[]}>
          <NoChangesView mode="files" onSwitchMode={onSwitchMode} onBack={onBack} />
        </FooterProvider>
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

  test("ignores action input while an alternate review is starting", async () => {
    const onSwitchMode = vi.fn();
    const onBack = vi.fn();
    const { stdin } = render(
      <CliThemeProvider initialTheme="dark">
        <FooterProvider initialShortcuts={[]}>
          <NoChangesView mode="files" onSwitchMode={onSwitchMode} onBack={onBack} disabled />
        </FooterProvider>
      </CliThemeProvider>,
    );

    stdin.write("\r");
    stdin.write(ESCAPE);
    await flush();

    expect(onSwitchMode).not.toHaveBeenCalled();
    expect(onBack).not.toHaveBeenCalled();
  });
});
