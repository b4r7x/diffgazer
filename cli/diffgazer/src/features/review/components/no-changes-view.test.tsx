import { cleanup, render } from "ink-testing-library";
import { afterEach, describe, expect, test, vi } from "vitest";
import { CliThemeProvider } from "../../../theme/provider";
import { NoChangesView } from "./no-changes-view";

afterEach(() => {
  cleanup();
});

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
});
