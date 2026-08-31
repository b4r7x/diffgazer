import {
  configurationStatus,
  GEMINI_CONFIGURATION,
  makeConfigurationInitResponse,
  OPENCODE_GO_CONFIGURATION,
} from "@diffgazer/core/testing/provider-fixtures";
import { Text } from "ink";
import stripAnsi from "strip-ansi";
import { afterEach, describe, expect, test, vi } from "vitest";
import { cleanupRootFrames, renderRootFrame } from "../../testing/render-root-frame";
import { useContentZone } from "./global";

const initState = vi.hoisted(() => ({ data: undefined as unknown, isLoading: false }));

vi.mock("@diffgazer/core/api/hooks", () => ({
  useConfigurationInit: () => ({ data: initState.data, isLoading: initState.isLoading }),
}));

afterEach(() => {
  cleanupRootFrames();
  initState.data = undefined;
  initState.isLoading = false;
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

  test("names the selected product and model the way the catalog publishes them", async () => {
    initState.data = makeConfigurationInitResponse([
      configurationStatus(GEMINI_CONFIGURATION, "ready"),
    ]);

    const { lastFrame } = renderRootFrame(120, 24, <Text>content</Text>);

    await vi.waitFor(() => expect(lastFrame()).toContain("Google Gemini"));
    expect(lastFrame()).toContain("Gemini 2.5 Flash");
  });

  test("headers a pool-bound configuration as the pool it bills, not the product", async () => {
    initState.data = makeConfigurationInitResponse([
      configurationStatus(OPENCODE_GO_CONFIGURATION, "ready"),
    ]);

    const { lastFrame } = renderRootFrame(120, 24, <Text>content</Text>);

    await vi.waitFor(() => expect(stripAnsi(lastFrame() ?? "")).toContain("OpenCode · Go"));
    expect(stripAnsi(lastFrame() ?? "")).not.toContain("OpenCode Zen");
  });

  test("joins distinct header chip segments with a separator", async () => {
    initState.data = makeConfigurationInitResponse([
      configurationStatus(GEMINI_CONFIGURATION, "ready"),
    ]);

    const { lastFrame } = renderRootFrame(120, 24, <Text>content</Text>);

    await vi.waitFor(() => expect(stripAnsi(lastFrame() ?? "")).toContain("· Ready"));
  });

  test("says the configuration is loading rather than calling it not configured", async () => {
    initState.isLoading = true;

    const { lastFrame } = renderRootFrame(120, 24, <Text>content</Text>);

    await vi.waitFor(() => expect(lastFrame()).toContain("Loading configuration"));
    const frame = stripAnsi(lastFrame() ?? "");
    expect(frame).not.toContain("Not configured");
    expect(frame).not.toContain("· Loading");
  });

  test("renders a redundant chip once, never 'Not configured · Not configured'", async () => {
    const { lastFrame } = renderRootFrame(120, 24, <Text>content</Text>);

    await vi.waitFor(() => expect(lastFrame()).toContain("Not configured"));
    const frame = stripAnsi(lastFrame() ?? "");
    expect(frame.match(/Not configured/g)).toHaveLength(1);
  });
});
