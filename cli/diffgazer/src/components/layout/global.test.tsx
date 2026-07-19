import { Text } from "ink";
import { afterEach, describe, expect, test, vi } from "vitest";
import { cleanupRootFrames, renderRootFrame } from "../../testing/render-root-frame";
import { useContentZone } from "./global";

vi.mock("@diffgazer/core/api/hooks", () => ({
  useInit: () => ({ data: undefined, isLoading: false }),
}));

afterEach(() => {
  cleanupRootFrames();
});

function ContentZoneProbe() {
  const contentZone = useContentZone();
  return <Text>content rows: {contentZone.contentRows}</Text>;
}

describe("GlobalLayout", () => {
  test.each([
    [39, 24],
    [80, 10],
  ])("names both minimum dimensions in the %ix%i too-small notice", async (columns, rows) => {
    const { lastFrame } = renderRootFrame(columns, rows, <Text>hidden content</Text>);

    await vi.waitFor(() => expect(lastFrame()).toContain("Terminal too small"));
    const frame = lastFrame() ?? "";
    expect(frame).toContain("40 columns");
    expect(frame).toContain("12 rows");
    expect(frame).not.toContain("hidden content");
  });

  test("provides the 20-row content budget at 80x24", async () => {
    const { lastFrame } = renderRootFrame(80, 24, <ContentZoneProbe />);

    await vi.waitFor(() => expect(lastFrame()).toContain("content rows: 20"));
  });
});
