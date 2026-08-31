import "../testing/terminal-mock";
import { useFooterData } from "@diffgazer/core/footer";
import {
  GEMINI_CONFIGURATION,
  OPENCODE_ZEN_CONFIGURATION,
} from "@diffgazer/core/testing/provider-fixtures";
import { Text } from "ink";
import { cleanup, render } from "ink-testing-library";
import stripAnsi from "strip-ansi";
import { afterEach, describe, expect, test } from "vitest";
import { flushUntil, geminiName, Wrapper } from "../testing/model-select-overlay";
import { setTestTerminalDimensions } from "../testing/terminal-mock";
import { ModelSelectOverlay } from "./model-select-overlay";

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
      <ModelSelectOverlay open onOpenChange={() => {}} configuration={GEMINI_CONFIGURATION} />
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

  test("names the configuration it is picking a model for", async () => {
    const { lastFrame } = renderOverlay();

    await flushUntil(() => lastFrame()?.includes(geminiName("gemini-2.5-flash")) ?? false);
    const frame = stripAnsi(lastFrame() ?? "");

    expect(frame).toContain("Select Model");
    expect(frame).toContain("gemini · 1 model");
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

  // Taught only where it does something: the pool row renders on dual-pool
  // products alone.
  test("teaches p only on a product whose endpoints are billing pools", async () => {
    const { lastFrame } = renderOverlay();

    await flushUntil(() => lastFrame()?.includes("[Tab] Switch Zone") ?? false);
    expect(stripAnsi(lastFrame() ?? "")).not.toContain("[p] Pool");

    cleanup();
    const zen = render(
      <Wrapper>
        <FooterProbe />
        <ModelSelectOverlay
          open
          onOpenChange={() => {}}
          configuration={OPENCODE_ZEN_CONFIGURATION}
        />
      </Wrapper>,
    );

    await flushUntil(() => zen.lastFrame()?.includes("[p] Pool") ?? false);
    // p sits beside the other list keys, before the tier filter it precedes.
    expect(stripAnsi(zen.lastFrame() ?? "")).toContain("[/] Search [p] Pool [f] Filter Tier");
  });

  test("marks the selected tier tab with a glyph, so the state survives a stripped frame", async () => {
    const { lastFrame } = renderOverlay();

    await flushUntil(() => lastFrame()?.includes(geminiName("gemini-2.5-flash")) ?? false);
    const frame = stripAnsi(lastFrame() ?? "");
    expect(frame).toContain("· ALL");
  });
});
