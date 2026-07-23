// Side-effect import first: registers vi.mock("use-terminal-dimensions") before
// ModelSelectOverlay pulls in the real hook. Must stay above the value imports;
// biome keeps side-effect imports as chunk separators so sorting cannot sink it.
import "./model-select-overlay.terminal-mock";
import { type BoundApi, createApi } from "@diffgazer/core/api";
import type {
  ActivateProviderResponse,
  ProviderModelsResponse,
} from "@diffgazer/core/schemas/config";
import { cleanup, render } from "ink-testing-library";
import { afterEach, describe, expect, test, vi } from "vitest";
import { terminalCellWidth } from "../../../lib/terminal-width";
import { ModelSelectOverlay } from "./model-select-overlay";
import { setTestTerminalDimensions } from "./model-select-overlay.terminal-mock";
import {
  ARROW_DOWN,
  countPrefixes,
  flush,
  flushUntil,
  Wrapper,
} from "./model-select-overlay.test-harness";

function getLargeModelName(index: number): string {
  return `Large Model ${String(index).padStart(2, "0")}`;
}

function makeLargeCatalog(count = 60): ProviderModelsResponse {
  return {
    models: Array.from({ length: count }, (_, index) => ({
      id: `large-model-${String(index).padStart(2, "0")}`,
      name: getLargeModelName(index),
      description: `Context window ${index}`,
      tier: index % 2 === 0 ? "free" : "paid",
    })),
    fetchedAt: new Date().toISOString(),
    source: "live",
    cached: false,
  };
}

function countRenderedModels(frame: string | undefined, catalog: ProviderModelsResponse): number {
  const text = frame ?? "";
  return catalog.models.filter((model) => text.includes(model.name)).length;
}

function countOverflowIndicators(frame: string | undefined): number {
  const text = frame ?? "";
  return Number(text.includes("\u25B2")) + Number(text.includes("\u25BC"));
}

describe("ModelSelectOverlay large catalog windowing", () => {
  afterEach(() => {
    cleanup();
  });

  test("renders only the visible model window and keeps the highlighted row visible while navigating the full list", async () => {
    setTestTerminalDimensions({ columns: 80, rows: 19 });
    const catalog = makeLargeCatalog();
    const getProviderModels = vi
      .fn<() => Promise<ProviderModelsResponse>>()
      .mockResolvedValue(catalog);
    const activateProvider = vi
      .fn<(providerId: string, model?: string) => Promise<ActivateProviderResponse>>()
      .mockResolvedValue({ provider: "gemini", model: "large-model-25" });
    const api = {
      ...createApi({ baseUrl: "http://localhost" }),
      getProviderModels,
      activateProvider,
    } satisfies BoundApi;
    const onSelect = vi.fn();
    const expectedViewportRows = 4;

    const { stdin, lastFrame } = render(
      <Wrapper api={api}>
        <ModelSelectOverlay
          open={true}
          onOpenChange={() => {}}
          providerId="gemini"
          onSelect={onSelect}
        />
      </Wrapper>,
    );

    await flushUntil(
      () => lastFrame()?.includes(getLargeModelName(expectedViewportRows - 2)) ?? false,
    );

    expect(countRenderedModels(lastFrame(), catalog) + countOverflowIndicators(lastFrame())).toBe(
      expectedViewportRows,
    );
    expect(lastFrame()).toContain("\u25BC");
    expect(lastFrame()).not.toContain(getLargeModelName(expectedViewportRows - 1));

    for (let i = 0; i < 25; i += 1) {
      stdin.write(ARROW_DOWN);
      await flush();
    }

    const navigatedFrame = lastFrame();
    expect(
      countRenderedModels(navigatedFrame, catalog) + countOverflowIndicators(navigatedFrame),
    ).toBe(expectedViewportRows);
    expect(navigatedFrame).toContain("\u25B2");
    expect(navigatedFrame).toContain("\u25BC");
    expect(navigatedFrame).toContain(getLargeModelName(25));
    expect(
      countPrefixes(navigatedFrame, getLargeModelName(25)).highlighted,
      `expected the navigated model to be highlighted:\n${navigatedFrame}`,
    ).toBe(1);
    expect(navigatedFrame).not.toContain(getLargeModelName(0));

    stdin.write("\r");
    await flushUntil(() => onSelect.mock.calls.length > 0);

    expect(activateProvider).toHaveBeenCalledWith("gemini", "large-model-25");
    expect(onSelect).toHaveBeenCalledWith("large-model-25");
  });
});

describe("ModelSelectOverlay long description", () => {
  afterEach(() => {
    cleanup();
  });

  test("truncates a description that overflows the row width with an ellipsis instead of the full text", async () => {
    const longDescription =
      "A very long model description that easily overflows the terminal row width FULLTAILVISIBLE";
    const catalog: ProviderModelsResponse = {
      models: [
        { id: "gemini-2.5-flash", name: "Flash", description: longDescription, tier: "free" },
      ],
      fetchedAt: new Date().toISOString(),
      source: "live",
      cached: false,
    };
    const getProviderModels = vi
      .fn<() => Promise<ProviderModelsResponse>>()
      .mockResolvedValue(catalog);
    const api = {
      ...createApi({ baseUrl: "http://localhost" }),
      getProviderModels,
    } satisfies BoundApi;

    const { lastFrame } = render(
      <Wrapper api={api}>
        <ModelSelectOverlay
          open={true}
          onOpenChange={() => {}}
          providerId="gemini"
          onSelect={() => {}}
        />
      </Wrapper>,
    );

    await flushUntil(() => lastFrame()?.includes("Flash") ?? false);

    const frame = lastFrame() ?? "";
    expect(frame).toContain("A very long model");
    expect(frame).toContain("…");
    expect(frame).not.toContain("FULLTAILVISIBLE");
  });

  test("keeps a wide long-name model and footer within a 40-column terminal budget", async () => {
    setTestTerminalDimensions({ columns: 40, rows: 19 });
    expect(terminalCellWidth("いe\u0301🙂")).toBe(5);
    const catalog: ProviderModelsResponse = {
      models: [
        {
          id: "gemini-wide-model",
          name: "Gemini 超長い Wide Model Name FULLNAMEEND",
          description:
            "A very long e\u0301🙂 model description that easily overflows the terminal row width FULLTAILVISIBLE",
          tier: "free",
        },
      ],
      fetchedAt: new Date().toISOString(),
      source: "live",
      cached: false,
    };
    const api = {
      ...createApi({ baseUrl: "http://localhost" }),
      getProviderModels: vi.fn<() => Promise<ProviderModelsResponse>>().mockResolvedValue(catalog),
    } satisfies BoundApi;

    const { lastFrame } = render(
      <Wrapper api={api}>
        <ModelSelectOverlay
          open={true}
          onOpenChange={() => {}}
          providerId="gemini"
          onSelect={() => {}}
        />
      </Wrapper>,
    );

    await flushUntil(() => lastFrame()?.includes("Gemini") ?? false);

    const frame = lastFrame() ?? "";
    const lines = frame.split("\n");
    expect(lines.filter((line) => line.includes("[ ]"))).toHaveLength(1);
    expect(lines.every((line) => terminalCellWidth(line) <= 40)).toBe(true);
    expect(lines).toHaveLength(15);
    expect(frame).toContain("Tab: zone");
    expect(frame).not.toContain("FULLNAMEEND");
    expect(frame).not.toContain("FULLTAILVISIBLE");
  });
});
