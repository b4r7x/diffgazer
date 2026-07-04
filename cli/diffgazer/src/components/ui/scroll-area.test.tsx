import { Box, Text } from "ink";
import { cleanup, render } from "ink-testing-library";
import type { ReactNode } from "react";
import { afterEach, describe, expect, test } from "vitest";
import { CliThemeProvider } from "../../theme/provider";
import { ScrollArea } from "./scroll-area";

afterEach(() => {
  cleanup();
});

const ARROW_UP = "\u001b[A";
const ARROW_DOWN = "\u001b[B";
const END = "\u001b[F";

async function flush(times = 4): Promise<void> {
  for (let i = 0; i < times; i += 1) {
    await new Promise((resolve) => setImmediate(resolve));
  }
}

function items(count: number, prefix = "item"): ReactNode[] {
  return Array.from({ length: count }, (_, i) => `${prefix}-${i}`).map((label) => (
    <Text key={label}>{label}</Text>
  ));
}

describe("ScrollArea autoTail", () => {
  test("pins the view to the tail when items are appended", async () => {
    const { rerender, lastFrame } = render(
      <CliThemeProvider initialTheme="dark">
        <ScrollArea height={3} isActive autoTail>
          {items(3)}
        </ScrollArea>
      </CliThemeProvider>,
    );
    await flush();
    expect(lastFrame()).toContain("item-2");

    rerender(
      <CliThemeProvider initialTheme="dark">
        <ScrollArea height={3} isActive autoTail>
          {items(6)}
        </ScrollArea>
      </CliThemeProvider>,
    );
    await flush();

    const frame = lastFrame() ?? "";
    expect(frame).toContain("item-5");
    expect(frame).toContain("item-3");
    expect(frame).not.toContain("item-0");
  });

  test("suppresses auto-tail after the user scrolls up, then re-enables at the bottom", async () => {
    const { stdin, rerender, lastFrame } = render(
      <CliThemeProvider initialTheme="dark">
        <ScrollArea height={3} isActive autoTail>
          {items(6)}
        </ScrollArea>
      </CliThemeProvider>,
    );
    await flush();
    expect(lastFrame()).toContain("item-5");

    // User scrolls up: auto-tail must be suppressed.
    stdin.write(ARROW_UP);
    await flush();
    expect(lastFrame()).toContain("item-2");
    expect(lastFrame()).not.toContain("item-5");

    // New items arrive while scrolled up: the view stays put, not pinned to tail.
    rerender(
      <CliThemeProvider initialTheme="dark">
        <ScrollArea height={3} isActive autoTail>
          {items(9)}
        </ScrollArea>
      </CliThemeProvider>,
    );
    await flush();
    expect(lastFrame()).toContain("item-2");
    expect(lastFrame()).not.toContain("item-8");

    // Returning to the bottom (End) re-enables auto-tail.
    stdin.write(END);
    await flush();
    expect(lastFrame()).toContain("item-8");

    rerender(
      <CliThemeProvider initialTheme="dark">
        <ScrollArea height={3} isActive autoTail>
          {items(12)}
        </ScrollArea>
      </CliThemeProvider>,
    );
    await flush();
    expect(lastFrame()).toContain("item-11");
  });

  test("clamps the offset when content shrinks below the current scroll position", async () => {
    const { stdin, rerender, lastFrame } = render(
      <CliThemeProvider initialTheme="dark">
        <ScrollArea height={3} isActive>
          {items(9)}
        </ScrollArea>
      </CliThemeProvider>,
    );
    await flush();

    // Scroll to the bottom.
    stdin.write(END);
    await flush();
    expect(lastFrame()).toContain("item-8");

    // Content shrinks; the offset clamps so the visible window stays valid.
    rerender(
      <CliThemeProvider initialTheme="dark">
        <ScrollArea height={3} isActive>
          {items(4)}
        </ScrollArea>
      </CliThemeProvider>,
    );
    await flush();

    const frame = lastFrame() ?? "";
    expect(frame).toContain("item-3");
    expect(frame).toContain("item-1");
  });

  test("ArrowDown back to the bottom re-enables auto-tail after scrolling up", async () => {
    const { stdin, rerender, lastFrame } = render(
      <CliThemeProvider initialTheme="dark">
        <ScrollArea height={3} isActive autoTail>
          {items(6)}
        </ScrollArea>
      </CliThemeProvider>,
    );
    await flush();
    expect(lastFrame()).toContain("item-5");

    // Scroll up twice (away from the tail).
    stdin.write(ARROW_UP);
    await flush();
    stdin.write(ARROW_UP);
    await flush();
    expect(lastFrame()).toContain("item-1");
    expect(lastFrame()).not.toContain("item-5");

    // ArrowDown back to the bottom re-enables auto-tail (next === maxOffset).
    stdin.write(ARROW_DOWN);
    await flush();
    stdin.write(ARROW_DOWN);
    await flush();
    expect(lastFrame()).toContain("item-5");

    rerender(
      <CliThemeProvider initialTheme="dark">
        <ScrollArea height={3} isActive autoTail>
          {items(9)}
        </ScrollArea>
      </CliThemeProvider>,
    );
    await flush();
    expect(lastFrame()).toContain("item-8");
  });

  test("scrolls content rendered inside a single column child", async () => {
    const { stdin, lastFrame } = render(
      <CliThemeProvider initialTheme="dark">
        <ScrollArea height={3} isActive>
          <Box flexDirection="column">{items(6)}</Box>
        </ScrollArea>
      </CliThemeProvider>,
    );
    await flush();

    expect(lastFrame()).toContain("item-0");
    expect(lastFrame()).toContain("\u25BC");

    stdin.write(ARROW_DOWN);
    await flush();

    const frame = lastFrame() ?? "";
    expect(frame).toContain("item-1");
    expect(frame).toContain("item-3");
    expect(frame).not.toContain("item-0");
  });
});
