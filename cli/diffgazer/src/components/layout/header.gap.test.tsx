import type { ClientConfigurationSummary } from "@diffgazer/core/schemas/config";
import {
  GEMINI_CONFIGURATION,
  makeConfigurationInitResponse,
  makeReadiness,
} from "@diffgazer/core/testing/provider-fixtures";
import { Text } from "ink";
import stripAnsi from "strip-ansi";
import { afterEach, describe, expect, test, vi } from "vitest";
import { cleanupRootFrames, renderRootFrame } from "../../testing/render-root-frame";

const testCase = vi.hoisted(() => ({
  modelId: "claude-sonnet-4-5-20250929-thinking" as string | null,
}));

function buildInitData() {
  const configuration = {
    configurationId: "header-gap-test",
    revision: 1,
    status: "supported",
    transportFamily: "hosted-api",
    productId: "gemini",
    endpoint: GEMINI_CONFIGURATION.endpoint,
    selectedModelId: testCase.modelId,
    notices: [],
    availableActions: ["inspect", "select"],
  } as ClientConfigurationSummary;

  // A configuration with no selected model cannot be ready; the header still has to
  // render its canonical product label.
  const readiness = makeReadiness(testCase.modelId ? "ready" : "model-missing", "gemini");

  return makeConfigurationInitResponse([{ configuration, readiness }], "header-gap-test");
}

vi.mock("@diffgazer/core/api/hooks", () => ({
  useConfigurationInit: () => ({ data: buildInitData(), isLoading: false }),
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
    ["a model too long for the slot", "claude-sonnet-4-5-20250929-thinking"],
    ["a canonical provider label with no model segment", null],
  ])("holds the wordmark clear of %s at 80 columns", async (_case, model) => {
    testCase.modelId = model;
    const { lastFrame } = renderRootFrame(80, 24, <Text>body</Text>);

    await vi.waitFor(() => expect(lastFrame()).toContain(WORDMARK));
    const frame = stripAnsi(lastFrame() ?? "");
    if (model) {
      expect(frame).toMatch(/claude-sonnet/);
      expect(frame).toMatch(/hinking/);
      expect(frame).not.toContain("Google Gemini");
    } else {
      expect(frame).toContain("Google Gemini");
    }
    expect(frame).not.toContain("Not configured");
    // fitProviderLabel shortens what it can, but a label with nothing to drop
    // still fills the slot, so the gap has to be reserved by the layout.
    expect(wordmarkGap(lastFrame() ?? "")).toBeGreaterThanOrEqual(1);
    expect(frame.split("\n")).toHaveLength(24);
  });
});
