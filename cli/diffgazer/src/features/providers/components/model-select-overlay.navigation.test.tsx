import "../testing/terminal-mock";
import type { BoundApi } from "@diffgazer/core/api";
import type { ModelInfo } from "@diffgazer/core/schemas/config";
import {
  GEMINI_CONFIGURATION,
  OPENCODE_ZEN_CONFIGURATION,
} from "@diffgazer/core/testing/provider-fixtures";
import { cleanup, render } from "ink-testing-library";
import stripAnsi from "strip-ansi";
import { afterEach, describe, expect, test, vi } from "vitest";
import {
  ARROW_DOWN,
  ARROW_UP,
  catalogModelsResponse,
  countPrefixes,
  flush,
  flushUntil,
  geminiName,
  makeGeminiApi,
  Wrapper,
} from "../testing/model-select-overlay";
import { ModelSelectOverlay } from "./model-select-overlay";

// Both names carry a "j" so a search query of "j" keeps the list populated,
// which is what makes the search-zone case assertable.
const JK_MODELS: ModelInfo[] = [
  { id: "jet-flash", name: "jet-flash", description: "fast tier", tier: "paid" },
  { id: "jet-pro", name: "jet-pro", description: "deep tier", tier: "paid" },
];

function renderTwoModelOverlay() {
  const getConfigurationModels = vi
    .fn<BoundApi["getConfigurationModels"]>()
    .mockResolvedValue(catalogModelsResponse(GEMINI_CONFIGURATION, JK_MODELS));
  const api = { ...makeGeminiApi(), getConfigurationModels } satisfies BoundApi;
  return render(
    <Wrapper api={api}>
      <ModelSelectOverlay open onOpenChange={() => {}} configuration={GEMINI_CONFIGURATION} />
    </Wrapper>,
  );
}

// A dual-pool product draws both filter groups on one row, so the same zone
// chain has to be read off that row rather than off two.
const POOL_MODELS: ModelInfo[] = JK_MODELS.map((model) => ({
  ...model,
  endpointProfileIds: ["zen", "go"],
}));

function renderPoolOverlay() {
  const getConfigurationModels = vi
    .fn<BoundApi["getConfigurationModels"]>()
    .mockResolvedValue(catalogModelsResponse(OPENCODE_ZEN_CONFIGURATION, POOL_MODELS));
  const api = { ...makeGeminiApi(), getConfigurationModels } satisfies BoundApi;
  return render(
    <Wrapper api={api}>
      <ModelSelectOverlay open onOpenChange={() => {}} configuration={OPENCODE_ZEN_CONFIGURATION} />
    </Wrapper>,
  );
}

/** Only the focused group draws the arrow hint, and the pool group draws first. */
function focusedFilterGroup(frame: string | undefined): "pool" | "tier" | null {
  const row = stripAnsi(frame ?? "")
    .split("\n")
    .find((line) => line.includes("ALL"));
  if (!row) return null;
  const hint = row.indexOf("<-/->");
  if (hint < 0) return null;
  return hint < row.indexOf("ALL") ? "pool" : "tier";
}

describe("ModelSelectOverlay list navigation", () => {
  afterEach(() => {
    cleanup();
  });

  test("j and k move the highlighted model row", async () => {
    const { stdin, lastFrame } = renderTwoModelOverlay();

    await flushUntil(() => lastFrame()?.includes("jet-pro") ?? false);
    expect(countPrefixes(lastFrame(), "jet-flash").highlighted).toBe(1);

    stdin.write("j");
    await flush();
    expect(countPrefixes(lastFrame(), "jet-pro").highlighted).toBe(1);
    expect(countPrefixes(lastFrame(), "jet-flash").highlighted).toBe(0);

    stdin.write("k");
    await flush();
    expect(countPrefixes(lastFrame(), "jet-flash").highlighted).toBe(1);
    expect(countPrefixes(lastFrame(), "jet-pro").highlighted).toBe(0);
  });

  test("typing j in the search zone extends the query and leaves the highlight put", async () => {
    const { stdin, lastFrame } = renderTwoModelOverlay();

    await flushUntil(() => lastFrame()?.includes("jet-pro") ?? false);
    stdin.write("/");
    await flush();
    stdin.write("j");
    await flush();

    expect(lastFrame()).toContain("j█");
    expect(lastFrame()).not.toContain("Search models...");

    // Tab back through filters into the list: the query never moved the highlight.
    stdin.write("\t");
    await flush();
    stdin.write("\t");
    await flush();
    expect(countPrefixes(lastFrame(), "jet-flash").highlighted).toBe(1);
    expect(countPrefixes(lastFrame(), "jet-pro").highlighted).toBe(0);
  });
});

describe("ModelSelectOverlay zone arrow chain", () => {
  afterEach(() => {
    cleanup();
  });

  test("arrows move down into the filter tabs and back up into search", async () => {
    const { stdin, lastFrame } = renderTwoModelOverlay();

    await flushUntil(() => lastFrame()?.includes("jet-pro") ?? false);
    stdin.write("/");
    await flush();
    expect(lastFrame()).toContain("Search models...█");

    stdin.write(ARROW_DOWN);
    await flush();
    expect(lastFrame()).toContain("<-/->");
    expect(lastFrame()).not.toContain("Search models...█");

    stdin.write(ARROW_UP);
    await flush();
    expect(lastFrame()).toContain("Search models...█");
    expect(lastFrame()).not.toContain("<-/->");
  });

  test("arrows move down from the filter tabs into the model list", async () => {
    const { stdin, lastFrame } = renderTwoModelOverlay();

    await flushUntil(() => lastFrame()?.includes("jet-pro") ?? false);
    stdin.write("\t");
    await flush();
    stdin.write("\t");
    await flush();
    expect(lastFrame()).toContain("<-/->");

    stdin.write(ARROW_DOWN);
    await flush();
    expect(lastFrame()).not.toContain("<-/->");

    stdin.write(ARROW_DOWN);
    await flush();
    expect(countPrefixes(lastFrame(), "jet-pro").highlighted).toBe(1);
  });

  test("the populated list stops at both ends instead of wrapping, exiting up into the filters", async () => {
    const { stdin, lastFrame } = renderTwoModelOverlay();

    await flushUntil(() => lastFrame()?.includes("jet-pro") ?? false);
    expect(countPrefixes(lastFrame(), "jet-flash").highlighted).toBe(1);

    stdin.write(ARROW_UP);
    await flush();
    expect(lastFrame()).toContain("<-/->");
    expect(countPrefixes(lastFrame(), "jet-flash").highlighted).toBe(0);

    stdin.write(ARROW_DOWN);
    await flush();
    stdin.write(ARROW_DOWN);
    await flush();
    expect(countPrefixes(lastFrame(), "jet-pro").highlighted).toBe(1);

    stdin.write(ARROW_DOWN);
    await flush();
    expect(countPrefixes(lastFrame(), "jet-pro").highlighted).toBe(1);
    expect(countPrefixes(lastFrame(), "jet-flash").highlighted).toBe(0);
  });

  test("arrows walk search, the pool group, and the tier group of the merged row", async () => {
    const { stdin, lastFrame } = renderPoolOverlay();

    await flushUntil(() => lastFrame()?.includes("jet-pro") ?? false);
    stdin.write("/");
    await flush();
    expect(lastFrame()).toContain("Search models...█");

    stdin.write(ARROW_DOWN);
    await flush();
    expect(focusedFilterGroup(lastFrame())).toBe("pool");
    expect(lastFrame()).not.toContain("Search models...█");

    stdin.write(ARROW_DOWN);
    await flush();
    expect(focusedFilterGroup(lastFrame())).toBe("tier");

    stdin.write(ARROW_UP);
    await flush();
    expect(focusedFilterGroup(lastFrame())).toBe("pool");

    stdin.write(ARROW_UP);
    await flush();
    expect(lastFrame()).toContain("Search models...█");
  });

  test("arrows move down from the merged row into the model list", async () => {
    const { stdin, lastFrame } = renderPoolOverlay();

    await flushUntil(() => lastFrame()?.includes("jet-pro") ?? false);
    stdin.write("\t");
    await flush();
    stdin.write("\t");
    await flush();
    expect(focusedFilterGroup(lastFrame())).toBe("pool");
    stdin.write("\t");
    await flush();
    expect(focusedFilterGroup(lastFrame())).toBe("tier");

    stdin.write(ARROW_DOWN);
    await flush();
    expect(focusedFilterGroup(lastFrame())).toBeNull();

    stdin.write(ARROW_DOWN);
    await flush();
    expect(countPrefixes(lastFrame(), "jet-pro").highlighted).toBe(1);
  });

  test("the populated list exits up into the tier group of the merged row", async () => {
    const { stdin, lastFrame } = renderPoolOverlay();

    await flushUntil(() => lastFrame()?.includes("jet-pro") ?? false);
    expect(countPrefixes(lastFrame(), "jet-flash").highlighted).toBe(1);

    stdin.write(ARROW_UP);
    await flush();
    expect(focusedFilterGroup(lastFrame())).toBe("tier");
    expect(countPrefixes(lastFrame(), "jet-flash").highlighted).toBe(0);

    stdin.write(ARROW_DOWN);
    await flush();
    stdin.write(ARROW_DOWN);
    await flush();
    expect(countPrefixes(lastFrame(), "jet-pro").highlighted).toBe(1);

    stdin.write(ARROW_DOWN);
    await flush();
    expect(countPrefixes(lastFrame(), "jet-pro").highlighted).toBe(1);
    expect(countPrefixes(lastFrame(), "jet-flash").highlighted).toBe(0);
  });
});

describe("ModelSelectOverlay retry control", () => {
  afterEach(() => {
    cleanup();
  });

  function renderFailedDiscovery() {
    const getConfigurationModels = vi
      .fn<BoundApi["getConfigurationModels"]>()
      .mockRejectedValueOnce(new Error("Model discovery failed. Test the configuration again."))
      .mockResolvedValue(catalogModelsResponse(GEMINI_CONFIGURATION));
    const api = { ...makeGeminiApi(), getConfigurationModels } satisfies BoundApi;
    const view = render(
      <Wrapper api={api}>
        <ModelSelectOverlay open onOpenChange={() => {}} configuration={GEMINI_CONFIGURATION} />
      </Wrapper>,
    );
    return { ...view, getConfigurationModels };
  }

  test("renders Retry as a control and runs discovery when Enter activates it", async () => {
    const { stdin, lastFrame, getConfigurationModels } = renderFailedDiscovery();

    await flushUntil(() => lastFrame()?.includes("Model discovery failed") ?? false);
    expect(lastFrame()).toContain("[ Retry ]");

    stdin.write(ARROW_UP);
    await flush();
    stdin.write("\r");
    await flushUntil(() => lastFrame()?.includes(geminiName("gemini-2.5-flash")) ?? false);

    expect(getConfigurationModels).toHaveBeenCalledTimes(2);
    expect(lastFrame()).not.toContain("[ Retry ]");
  });

  test("reaches Retry by arrowing down from the search and filter zones", async () => {
    const { stdin, lastFrame, getConfigurationModels } = renderFailedDiscovery();

    await flushUntil(() => lastFrame()?.includes("Model discovery failed") ?? false);
    stdin.write("/");
    await flush();
    stdin.write(ARROW_DOWN);
    await flush();
    expect(lastFrame()).toContain("<-/->");

    stdin.write(ARROW_DOWN);
    await flush();
    stdin.write("\r");
    await flushUntil(() => lastFrame()?.includes(geminiName("gemini-2.5-flash")) ?? false);

    expect(getConfigurationModels).toHaveBeenCalledTimes(2);
  });
});

describe("ModelSelectOverlay search input mode", () => {
  afterEach(() => {
    cleanup();
  });

  test("typing q in model search does not trigger the global quit shortcut", async () => {
    const onOpenChange = vi.fn();
    const { stdin, lastFrame } = render(
      <Wrapper>
        <ModelSelectOverlay open onOpenChange={onOpenChange} configuration={GEMINI_CONFIGURATION} />
      </Wrapper>,
    );

    await flushUntil(() => lastFrame()?.includes(geminiName("gemini-2.5-flash")) ?? false);
    stdin.write("/");
    await flush();
    stdin.write("q");
    await flush();

    expect(lastFrame()).toContain("q");
    expect(lastFrame()).not.toContain("Search models...");
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
  });

  test("one Escape closes the dialog even with a populated search", async () => {
    const onOpenChange = vi.fn();
    const { stdin, lastFrame } = render(
      <Wrapper>
        <ModelSelectOverlay open onOpenChange={onOpenChange} configuration={GEMINI_CONFIGURATION} />
      </Wrapper>,
    );

    await flushUntil(() => lastFrame()?.includes(geminiName("gemini-2.5-flash")) ?? false);
    stdin.write("/");
    await flush();
    stdin.write("pro");
    await flush();
    expect(lastFrame()).toContain("pro");

    stdin.write("\u001B");
    await flushUntil(() => onOpenChange.mock.calls.length > 0);
    expect(onOpenChange).toHaveBeenCalledOnce();
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  test("one Escape closes from the filter zone", async () => {
    const onOpenChange = vi.fn();
    const { stdin, lastFrame } = render(
      <Wrapper>
        <ModelSelectOverlay open onOpenChange={onOpenChange} configuration={GEMINI_CONFIGURATION} />
      </Wrapper>,
    );

    await flushUntil(() => lastFrame()?.includes(geminiName("gemini-2.5-flash")) ?? false);
    stdin.write("\t");
    await flush();
    stdin.write("\t");
    await flush();
    expect(lastFrame()).toContain("<-/->");
    stdin.write("\u001B");
    await flushUntil(() => onOpenChange.mock.calls.length > 0);

    expect(onOpenChange).toHaveBeenCalledOnce();
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
