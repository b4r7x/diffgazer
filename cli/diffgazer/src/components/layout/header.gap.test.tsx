import { Text } from "ink";
import stripAnsi from "strip-ansi";
import { afterEach, describe, expect, test, vi } from "vitest";
import { cleanupRootFrames, renderRootFrame } from "../../testing/render-root-frame";

const config = vi.hoisted(() => ({
  provider: "gemini",
  model: undefined as string | undefined,
}));

vi.mock("@diffgazer/core/api/hooks", () => ({
  useInit: () => ({ data: { configured: true, config }, isLoading: false }),
}));

afterEach(() => {
  cleanupRootFrames();
});

const WORDMARK = "diffgazer";

function wordmarkGap(frame: string): number {
  const row = stripAnsi(frame)
    .split("\n")
    .find((line) => line.includes(WORDMARK));
  if (!row) throw new Error("header row not rendered");
  const afterWordmark = row.slice(row.indexOf(WORDMARK) + WORDMARK.length);
  return afterWordmark.match(/^ */)?.[0].length ?? 0;
}

describe("Header status slot", () => {
  test.each([
    ["a model too long for the slot", "gemini", "claude-sonnet-4-5-20250929-thinking"],
    ["a label with no provider prefix to drop", "a-provider-slug-with-no-model-segment", undefined],
  ])("holds the wordmark clear of %s at 80 columns", async (_case, provider, model) => {
    config.provider = provider;
    config.model = model;
    const { lastFrame } = renderRootFrame(80, 24, <Text>body</Text>);

    await vi.waitFor(() => expect(lastFrame()).toContain(WORDMARK));
    // fitProviderLabel shortens what it can, but a label with nothing to drop
    // still fills the slot, so the gap has to be reserved by the layout.
    expect(wordmarkGap(lastFrame() ?? "")).toBeGreaterThanOrEqual(1);
    expect(stripAnsi(lastFrame() ?? "").split("\n")).toHaveLength(24);
  });
});
