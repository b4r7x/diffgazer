import "./model-select-overlay.terminal-mock";
import { useFooterData } from "@diffgazer/core/footer";
import { Text } from "ink";
import { cleanup, render } from "ink-testing-library";
import stripAnsi from "strip-ansi";
import { afterEach, describe, expect, test } from "vitest";
import { ModelSelectOverlay } from "./model-select-overlay";
import { setTestTerminalDimensions } from "./model-select-overlay.terminal-mock";
import { flushUntil, geminiName, Wrapper } from "./model-select-overlay.test-harness";

function FooterProbe() {
  const { shortcuts, rightShortcuts } = useFooterData();
  const format = (list: typeof shortcuts) =>
    list.map((shortcut) => `[${shortcut.key}] ${shortcut.label}`).join(" ");
  return <Text>{`FOOTER ${format(shortcuts)} ${format(rightShortcuts)}`}</Text>;
}

function renderOverlay() {
  return render(
    <Wrapper>
      <FooterProbe />
      <ModelSelectOverlay
        open={true}
        onOpenChange={() => {}}
        providerId="gemini"
        onSelect={() => {}}
      />
    </Wrapper>,
  );
}

afterEach(() => {
  cleanup();
});

describe("ModelSelectOverlay reads as an overlay", () => {
  test.each([100, 60])("keeps gutters on both sides of the card at %i columns", async (columns) => {
    setTestTerminalDimensions({ columns, rows: 30 });
    const { lastFrame } = renderOverlay();

    await flushUntil(() => lastFrame()?.includes(geminiName("gemini-2.5-flash")) ?? false);
    const lines = stripAnsi(lastFrame() ?? "").split("\n");
    const topBorder = lines.find((line) => line.includes("┌"));
    if (topBorder === undefined) throw new Error("dialog border not rendered");

    const leftGutter = topBorder.indexOf("┌");
    const rightGutter = columns - (topBorder.lastIndexOf("┐") + 1);

    expect(leftGutter).toBeGreaterThan(0);
    expect(rightGutter).toBeGreaterThan(0);
    expect(topBorder.length).toBeLessThan(columns);
  });

  test("names the provider it is picking a model for", async () => {
    const { lastFrame } = renderOverlay();

    await flushUntil(() => lastFrame()?.includes(geminiName("gemini-2.5-flash")) ?? false);
    const frame = stripAnsi(lastFrame() ?? "");

    expect(frame).toContain("Select Model");
    expect(frame).toContain("Google Gemini · 5 models");
  });

  test("publishes its keys to the one shortcut-bar grammar instead of an inline hint row", async () => {
    const { lastFrame } = renderOverlay();

    await flushUntil(() => lastFrame()?.includes("[Tab] Switch Zone") ?? false);
    const frame = stripAnsi(lastFrame() ?? "");

    expect(frame).toContain("[/] Search");
    expect(frame).toContain("[f] Filter Tier");
    expect(frame).toContain("[Esc] Close");
    expect(frame).not.toContain("Tab: zone");
    expect(frame).not.toContain("/: search");
  });

  test("marks the selected tier tab with a glyph, so the state survives a stripped frame", async () => {
    const { lastFrame } = renderOverlay();

    await flushUntil(() => lastFrame()?.includes(geminiName("gemini-2.5-flash")) ?? false);
    const frame = stripAnsi(lastFrame() ?? "");

    expect(frame).toContain("· ALL");
  });
});
