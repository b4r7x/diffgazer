import "./model-select-overlay.terminal-mock";
import { type BoundApi, createApi } from "@diffgazer/core/api";
import { cleanup, render } from "ink-testing-library";
import { afterEach, describe, expect, test, vi } from "vitest";
import { terminalCellWidth } from "../../../lib/terminal-width";
import { ModelSelectOverlay } from "./model-select-overlay";
import { setTestTerminalDimensions } from "./model-select-overlay.terminal-mock";
import {
  flushUntil,
  GEMINI_CONFIGURATION,
  readyFor,
  testDiscoveryResponse,
  Wrapper,
} from "./model-select-overlay.test-support";

describe("ModelSelectOverlay layout", () => {
  afterEach(() => {
    cleanup();
  });

  test("renders the discovered model within the bounded viewport", async () => {
    setTestTerminalDimensions({ columns: 80, rows: 19 });
    const _longDescription = "Exact credentialed production-path evidence passed. FULLTAILVISIBLE";
    const configuration = {
      ...GEMINI_CONFIGURATION,
      selectedModelId: "gemini-2.5-flash" as const,
    };
    const testConfiguration = vi.fn<BoundApi["testConfiguration"]>().mockResolvedValue({
      ...testDiscoveryResponse(configuration, readyFor("gemini")),
      configuration,
    });
    const api = {
      ...createApi({ baseUrl: "http://localhost" }),
      testConfiguration,
    } satisfies BoundApi;
    const onSelect = vi.fn();

    const { lastFrame } = render(
      <Wrapper api={api}>
        <ModelSelectOverlay
          open
          onOpenChange={() => {}}
          configuration={configuration}
          onSelect={onSelect}
        />
      </Wrapper>,
    );

    await flushUntil(() => lastFrame()?.includes("gemini-2.5-flash") ?? false);
    const frame = lastFrame() ?? "";
    expect(frame).toContain("gemini-2.5-flash");
    expect(frame).not.toContain("FULLTAILVISIBLE");
  });

  test("keeps a wide long-name model and footer within a 40-column terminal budget", async () => {
    setTestTerminalDimensions({ columns: 40, rows: 19 });
    expect(terminalCellWidth("いe\u0301🙂")).toBe(5);
    const { lastFrame } = render(
      <Wrapper>
        <ModelSelectOverlay open onOpenChange={() => {}} configuration={GEMINI_CONFIGURATION} />
      </Wrapper>,
    );

    await flushUntil(() => lastFrame()?.includes("Select Model") ?? false);
    await flushUntil(() => lastFrame()?.includes("1 model") ?? false, 500);
    const frame = lastFrame() ?? "";
    const lines = frame.split("\n");
    expect(lines.every((line) => terminalCellWidth(line) <= 40)).toBe(true);
    expect(frame).not.toContain("FULLTAILVISIBLE");
  });
});
