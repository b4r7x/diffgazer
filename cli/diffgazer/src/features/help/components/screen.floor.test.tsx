import { cleanup } from "ink-testing-library";
import stripAnsi from "strip-ansi";
import { afterEach, describe, expect, test, vi } from "vitest";
import { cleanupRootFrames, renderRootFrame } from "../../../testing/render-root-frame";
import { HelpScreen } from "./screen";

vi.mock("@diffgazer/core/api/hooks", () => ({
  useInit: () => ({ data: undefined, isLoading: false }),
}));

afterEach(() => {
  cleanup();
  cleanupRootFrames();
});

describe("HelpScreen floor", () => {
  test("scrolls help content inside the 60x20 floor without composited garbage", async () => {
    const { lastFrame } = renderRootFrame(60, 20, <HelpScreen />);

    await vi.waitFor(() => expect(lastFrame()).toContain("KEYBOARD SHORTCUTS"));
    const frame = stripAnsi(lastFrame() ?? "");

    expect(frame.split("\n")).toHaveLength(20);
    // Overflowing Ink composites two shortcut rows onto one terminal row,
    // producing garbage tokens ("Escer" from Esc+Enter, "Settingst" from
    // Settings+Quit). A clamped ScrollArea must never emit those.
    expect(frame).not.toMatch(/Escer|Settingst/);

    const hasScrollIndicator = frame.includes("▼");
    const hasCompleteShortcutRow = frame.includes("Navigate Menus and Lists");
    expect(hasScrollIndicator || hasCompleteShortcutRow).toBe(true);
  });
});
