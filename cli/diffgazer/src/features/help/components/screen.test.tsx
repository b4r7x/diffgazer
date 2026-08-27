import { HELP_SHORTCUTS } from "@diffgazer/core/schemas/presentation";
import { cleanup } from "ink-testing-library";
import stripAnsi from "strip-ansi";
import { afterEach, describe, expect, test, vi } from "vitest";
import { cleanupRootFrames, renderRootFrame } from "../../../testing/render-root-frame";
import { HelpScreen } from "./screen";

vi.mock("@diffgazer/core/api/hooks", () => ({
  useConfigurationInit: () => ({ data: undefined, isLoading: false }),
}));

afterEach(() => {
  cleanup();
  cleanupRootFrames();
});

describe("HelpScreen", () => {
  test("names the scope of every shortcut group inside an 80 by 24 root frame", async () => {
    const { lastFrame } = renderRootFrame(80, 24, <HelpScreen />);

    await vi.waitFor(() => expect(lastFrame()).toContain("ANYWHERE"));
    const frame = lastFrame() ?? "";
    expect(frame).toContain("IN LISTS");
    expect(frame).not.toContain("PgUp/PgDn ·");
    expect(frame.split("\n")).toHaveLength(24);
  });

  // Tall enough to show every group at once: the table has grown past what a
  // 30-row terminal fits without scrolling, and the alignment check needs the
  // first and last group on one screen. The height tracks the table: the home
  // group gained its f row.
  test("renders every group with one aligned key column at 100x39", async () => {
    const { lastFrame } = renderRootFrame(100, 39, <HelpScreen />);

    await vi.waitFor(() => expect(lastFrame()).toContain("IN HISTORY"));
    const frame = stripAnsi(lastFrame() ?? "");

    for (const header of [
      "ANYWHERE",
      "IN LISTS",
      "ON THE PROVIDERS PAGE",
      "IN A REVIEW",
      "IN HISTORY",
    ]) {
      expect(frame).toContain(header);
    }

    const labelColumn = (label: string) => {
      const line = frame.split("\n").find((row) => row.includes(label));
      if (line === undefined) throw new Error(`no help row for ${label}`);
      return line.indexOf(label);
    };
    // First group and last group share one key column, so the table stays
    // aligned across group headers.
    expect(labelColumn("Select / Confirm")).toBe(labelColumn("Search Runs"));
  });

  test("keeps a shortcut row for every distinct key and label pair", async () => {
    const { lastFrame } = renderRootFrame(100, 39, <HelpScreen />);

    await vi.waitFor(() => expect(lastFrame()).toContain("IN HISTORY"));
    const rows = stripAnsi(lastFrame() ?? "").split("\n");

    for (const { key, label } of HELP_SHORTCUTS) {
      expect(rows.some((row) => row.includes(key) && row.includes(label))).toBe(true);
    }
  });
});
