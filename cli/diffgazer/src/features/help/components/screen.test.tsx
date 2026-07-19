import { cleanup } from "ink-testing-library";
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

describe("HelpScreen", () => {
  test("fits split scroll shortcuts into an 80 by 24 root frame", async () => {
    const { lastFrame } = renderRootFrame(80, 24, <HelpScreen />);

    await vi.waitFor(() => expect(lastFrame()).toContain("PgUp/PgDn"));
    const frame = lastFrame() ?? "";
    expect(frame).toContain("Home/End");
    expect(frame).not.toContain("PgUp/PgDn ·");
    expect(frame.split("\n")).toHaveLength(24);
  });
});
