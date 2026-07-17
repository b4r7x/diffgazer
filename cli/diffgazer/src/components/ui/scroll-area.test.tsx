import { makeIssue } from "@diffgazer/core/testing/factories";
import { Box, Text } from "ink";
import { cleanup, render } from "ink-testing-library";
import type { ReactNode } from "react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { CodeSnippet } from "../../features/review/components/code-snippet";
import { DiffView } from "../../features/review/components/diff-view";
import { IssueDetailsPane } from "../../features/review/components/issue-details-pane";
import { CliThemeProvider } from "../../theme/provider";
import { ScrollArea } from "./scroll-area";

afterEach(() => {
  cleanup();
});

const ARROW_UP = "\u001b[A";
const ARROW_DOWN = "\u001b[B";
const PAGE_UP = "\u001b[5~";
const HOME = "\u001b[H";
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

  test.each([
    ["ArrowUp", ARROW_UP],
    ["PageUp", PAGE_UP],
    ["Home", HOME],
  ])("keeps auto-tail enabled when %s cannot move the viewport", async (_name, key) => {
    const { stdin, rerender, lastFrame } = render(
      <CliThemeProvider initialTheme="dark">
        <ScrollArea height={3} isActive autoTail>
          {items(3)}
        </ScrollArea>
      </CliThemeProvider>,
    );
    await flush();

    stdin.write(key);
    await flush();

    rerender(
      <CliThemeProvider initialTheme="dark">
        <ScrollArea height={3} isActive autoTail>
          {items(6)}
        </ScrollArea>
      </CliThemeProvider>,
    );
    await flush();

    const frame = lastFrame() ?? "";
    expect(frame).toContain("item-3");
    expect(frame).toContain("item-5");
    expect(frame).not.toContain("item-0");
  });

  test("suppresses auto-tail after the user scrolls up, then re-enables at the bottom", async () => {
    const contentIdentity = Symbol("review");
    const { stdin, rerender, lastFrame } = render(
      <CliThemeProvider initialTheme="dark">
        <ScrollArea height={3} isActive autoTail contentIdentity={contentIdentity}>
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
        <ScrollArea height={3} isActive autoTail contentIdentity={contentIdentity}>
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
        <ScrollArea height={3} isActive autoTail contentIdentity={contentIdentity}>
          {items(12)}
        </ScrollArea>
      </CliThemeProvider>,
    );
    await flush();
    expect(lastFrame()).toContain("item-11");
  });

  test("restores tail-following when a new content identity starts empty", async () => {
    const nextIdentity = Symbol("next-review");
    const { stdin, rerender, lastFrame } = render(
      <CliThemeProvider initialTheme="dark">
        <ScrollArea height={3} isActive autoTail contentIdentity={Symbol("old-review")}>
          {items(6, "old")}
        </ScrollArea>
      </CliThemeProvider>,
    );
    await flush();

    stdin.write(ARROW_UP);
    await flush();
    expect(lastFrame()).not.toContain("old-5");

    rerender(
      <CliThemeProvider initialTheme="dark">
        <ScrollArea height={3} isActive autoTail contentIdentity={nextIdentity}>
          {items(0, "next")}
        </ScrollArea>
      </CliThemeProvider>,
    );
    await flush();

    rerender(
      <CliThemeProvider initialTheme="dark">
        <ScrollArea height={3} isActive autoTail contentIdentity={nextIdentity}>
          {items(6, "next")}
        </ScrollArea>
      </CliThemeProvider>,
    );
    await flush();

    const frame = lastFrame() ?? "";
    expect(frame).toContain("next-5");
    expect(frame).not.toContain("next-0");
  });

  test("moves to the tail when equal-length content has a new identity", async () => {
    const { stdin, rerender, lastFrame } = render(
      <CliThemeProvider initialTheme="dark">
        <ScrollArea height={3} isActive autoTail contentIdentity="old-review">
          {items(6, "old")}
        </ScrollArea>
      </CliThemeProvider>,
    );
    await flush();

    stdin.write(ARROW_UP);
    await flush();
    expect(lastFrame()).not.toContain("old-5");

    rerender(
      <CliThemeProvider initialTheme="dark">
        <ScrollArea height={3} isActive autoTail contentIdentity="next-review">
          {items(6, "next")}
        </ScrollArea>
      </CliThemeProvider>,
    );
    await flush();

    const frame = lastFrame() ?? "";
    expect(frame).toContain("next-5");
    expect(frame).not.toContain("next-0");
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

describe("ScrollArea rendered terminal rows", () => {
  test("scrolls multiline rows emitted by an opaque DiffView child", async () => {
    const { stdin, lastFrame } = render(
      <CliThemeProvider initialTheme="dark">
        <ScrollArea height={3} isActive>
          <DiffView patch={"--- a/file.ts\n+++ b/file.ts\n@@ -1 +1 @@\n-old\n+tail-marker"} />
        </ScrollArea>
      </CliThemeProvider>,
    );
    await flush();

    expect(lastFrame()).not.toContain("tail-marker");
    expect(lastFrame()).toContain("\u25BC");

    stdin.write(END);
    await flush();

    expect(lastFrame()).toContain("tail-marker");
    expect(lastFrame()).toContain("\u25B2");
  });

  test("scrolls bordered and padded rows emitted by an opaque CodeSnippet child", async () => {
    const { stdin, lastFrame } = render(
      <CliThemeProvider initialTheme="dark">
        <ScrollArea height={3} isActive>
          <CodeSnippet
            filePath="src/example.ts"
            startLine={10}
            code={"const first = true;\nconst middle = true;\nconst tailMarker = true;"}
          />
        </ScrollArea>
      </CliThemeProvider>,
    );
    await flush();

    expect(lastFrame()).not.toContain("tailMarker");
    stdin.write(END);
    await flush();

    expect(lastFrame()).toContain("tailMarker");
  });

  test("counts terminal wrapping instead of React child count", async () => {
    const { stdin, lastFrame } = render(
      <CliThemeProvider initialTheme="dark">
        <ScrollArea height={2} isActive>
          <Box width={12}>
            <Text>start words words words words wrapped-tail</Text>
          </Box>
        </ScrollArea>
      </CliThemeProvider>,
    );
    await flush();

    expect(lastFrame()).not.toContain("wrapped-tail");
    expect(lastFrame()).toContain("\u25BC");
    stdin.write(END);
    await flush();

    expect(lastFrame()).toContain("wrapped-tail");
  });

  test("counts compound child gaps, padding, and borders", async () => {
    const { stdin, lastFrame } = render(
      <CliThemeProvider initialTheme="dark">
        <ScrollArea height={3} isActive>
          <Box flexDirection="column" borderStyle="round" paddingY={1} gap={1}>
            <Text>compound-start</Text>
            <Text>compound-tail</Text>
          </Box>
        </ScrollArea>
      </CliThemeProvider>,
    );
    await flush();

    expect(lastFrame()).not.toContain("compound-tail");
    stdin.write(END);
    await flush();

    expect(lastFrame()).toContain("compound-tail");
  });

  test("scrolls through IssueDetailsPane into its CodeSnippet evidence rows", async () => {
    const issue = makeIssue({
      evidence: [
        {
          type: "code",
          title: "Measured evidence",
          sourceId: "source:measured",
          file: "src/measured.ts",
          range: { start: 20, end: 22 },
          excerpt:
            "const evidenceStart = true;\nconst evidenceMiddle = true;\nconst evidenceTail = true;",
        },
      ],
    });
    const { stdin, lastFrame } = render(
      <CliThemeProvider initialTheme="dark">
        <IssueDetailsPane
          issue={issue}
          activeTab="details"
          isActive
          scrollHeight={3}
          onTabChange={vi.fn()}
          completedSteps={new Set()}
          onToggleStep={vi.fn()}
        />
      </CliThemeProvider>,
    );
    await flush();

    expect(lastFrame()).not.toContain("evidenceTail");
    for (let step = 0; step < 20 && !lastFrame()?.includes("evidenceTail"); step += 1) {
      stdin.write(ARROW_DOWN);
      await flush();
    }

    expect(lastFrame()).toContain("evidenceTail");
  });

  test("scrolls IssueDetailsPane patch rows rendered by DiffView", async () => {
    const issue = makeIssue({
      suggested_patch: "--- a/file.ts\n+++ b/file.ts\n@@ -1 +1 @@\n-old\n+pane-patch-tail",
    });
    const { stdin, lastFrame } = render(
      <CliThemeProvider initialTheme="dark">
        <IssueDetailsPane
          issue={issue}
          activeTab="patch"
          isActive
          scrollHeight={3}
          onTabChange={vi.fn()}
          completedSteps={new Set()}
          onToggleStep={vi.fn()}
        />
      </CliThemeProvider>,
    );
    await flush();

    expect(lastFrame()).not.toContain("pane-patch-tail");
    stdin.write(END);
    await flush();

    expect(lastFrame()).toContain("pane-patch-tail");
  });
});
