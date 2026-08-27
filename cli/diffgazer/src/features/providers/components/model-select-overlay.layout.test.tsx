import "../testing/terminal-mock";
import { type BoundApi, createApi } from "@diffgazer/core/api";
import { GEMINI_CONFIGURATION } from "@diffgazer/core/testing/provider-fixtures";
import { cleanup, render } from "ink-testing-library";
import { afterEach, describe, expect, test, vi } from "vitest";
import { terminalCellWidth } from "../../../lib/terminal-width";
import { catalogModelsResponse, flushUntil, Wrapper } from "../testing/model-select-overlay";
import { setTestTerminalDimensions } from "../testing/terminal-mock";
import { ModelSelectOverlay } from "./model-select-overlay";

describe("ModelSelectOverlay layout", () => {
  afterEach(() => {
    cleanup();
  });

  test("renders the discovered model within the bounded viewport", async () => {
    setTestTerminalDimensions({ columns: 80, rows: 19 });
    const configuration = {
      ...GEMINI_CONFIGURATION,
      selectedModelId: "gemini-2.5-flash" as const,
    };
    const getConfigurationModels = vi.fn<BoundApi["getConfigurationModels"]>().mockResolvedValue(
      catalogModelsResponse(configuration, [
        {
          id: "gemini-2.5-flash",
          name: "gemini-2.5-flash",
          description: "1M context FULLTAILVISIBLE",
          tier: "paid",
        },
      ]),
    );
    const api = {
      ...createApi({ baseUrl: "http://localhost" }),
      getConfigurationModels,
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
    const getConfigurationModels = vi.fn<BoundApi["getConfigurationModels"]>().mockResolvedValue(
      catalogModelsResponse(GEMINI_CONFIGURATION, [
        {
          id: "vendor/extremely-long-model-name-that-must-not-wrap",
          name: "vendor/extremely-long-model-name-that-must-not-wrap",
          description: "1M context FULLTAILVISIBLE",
          tier: "paid",
        },
      ]),
    );
    const api = {
      ...createApi({ baseUrl: "http://localhost" }),
      getConfigurationModels,
    } satisfies BoundApi;
    const { lastFrame } = render(
      <Wrapper api={api}>
        <ModelSelectOverlay open onOpenChange={() => {}} configuration={GEMINI_CONFIGURATION} />
      </Wrapper>,
    );

    await flushUntil(() => lastFrame()?.includes("Select Model") ?? false);
    await flushUntil(() => lastFrame()?.includes("1 model") ?? false, 500);
    const frame = lastFrame() ?? "";
    const lines = frame.split("\n");
    expect(lines.every((line) => terminalCellWidth(line) <= 40)).toBe(true);
    // The wide row is on screen, truncated rather than wrapped.
    expect(frame).toContain("vendor/");
    expect(frame).not.toContain("FULLTAILVISIBLE");
  });
});
