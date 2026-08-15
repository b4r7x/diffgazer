import "../testing/terminal-mock";
import type { BoundApi } from "@diffgazer/core/api";
import type { ModelInfo } from "@diffgazer/core/schemas/config";
import { GEMINI_CONFIGURATION } from "@diffgazer/core/testing/provider-fixtures";
import { cleanup, render } from "ink-testing-library";
import { afterEach, describe, expect, test, vi } from "vitest";
import {
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

  test("Escape clears a populated search before closing the dialog", async () => {
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
    await flushUntil(() => lastFrame()?.includes("Search models...") ?? false);

    expect(lastFrame()).toContain("Select Model");
    expect(lastFrame()).toContain("Search models...");
    expect(onOpenChange).not.toHaveBeenCalled();

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
