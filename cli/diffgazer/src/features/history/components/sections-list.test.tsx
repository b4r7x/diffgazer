import type { TimelineItem } from "@diffgazer/core/schemas/presentation";
import { cleanup, render } from "ink-testing-library";
import { useState } from "react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { CliThemeProvider } from "../../../theme/provider";
import { SectionsList } from "./sections-list";

afterEach(() => {
  cleanup();
});

describe("SectionsList", () => {
  test("down arrow immediately updates the highlighted section id", async () => {
    const items: TimelineItem[] = [
      { id: "all", label: "All", count: 4 },
      { id: "today", label: "Today", count: 2 },
    ];
    const onHighlightChange = vi.fn();

    function Harness() {
      const [selectedId, setSelectedId] = useState("all");
      return (
        <CliThemeProvider initialTheme="dark">
          <SectionsList
            items={items}
            selectedId={selectedId}
            onSelect={vi.fn()}
            onHighlightChange={(id) => {
              setSelectedId(id);
              onHighlightChange(id);
            }}
            height={4}
            width={18}
          />
        </CliThemeProvider>
      );
    }

    const view = render(<Harness />);
    view.stdin.write("\u001B[B");
    await flush();

    expect(onHighlightChange).toHaveBeenCalledWith("today");
    expect(view.lastFrame()).toContain("Today");
  });

  test("keeps keyboard highlight visible while rendering a bounded section window", async () => {
    const items: TimelineItem[] = Array.from({ length: 12 }, (_, index) => ({
      id: `section-${index}`,
      label: `Section ${index}`,
      count: index,
    }));

    function Harness() {
      const [selectedId, setSelectedId] = useState(items[0]?.id ?? "");
      return (
        <CliThemeProvider initialTheme="dark">
          <SectionsList
            items={items}
            selectedId={selectedId}
            onSelect={vi.fn()}
            onHighlightChange={setSelectedId}
            height={4}
            width={18}
          />
        </CliThemeProvider>
      );
    }

    const { lastFrame, stdin } = render(<Harness />);
    await flush();
    const topRows = (lastFrame() ?? "").split("\n").filter(Boolean);
    expect(topRows.join("\n")).toContain("Section 0");
    expect(topRows.at(-1)).toContain("\u25BC");
    expect(topRows.length).toBeLessThanOrEqual(4);

    for (let index = 0; index < 4; index += 1) {
      stdin.write("\u001B[B");
      await flush();
    }

    const frame = lastFrame() ?? "";
    expect(frame).toContain("Section 4");
    expect(frame).not.toContain("Section 0");
    expect(frame.split("\n")[0]).toContain("\u25B2");
    expect(frame.split("\n").at(-1)).toContain("\u25BC");
    expect(frame.split("\n").filter(Boolean).length).toBeLessThanOrEqual(4);

    for (let index = 0; index < 7; index += 1) {
      stdin.write("\u001B[B");
      await flush();
    }

    const bottomRows = (lastFrame() ?? "").split("\n").filter(Boolean);
    expect(bottomRows[0]).toContain("\u25B2");
    expect(bottomRows.join("\n")).toContain("Section 11");
    expect(bottomRows.length).toBeLessThanOrEqual(4);
  });

  test("truncates long labels without wrapping the highlighted section", async () => {
    const items: TimelineItem[] = Array.from({ length: 6 }, (_, index) => ({
      id: `section-${index}`,
      label: `${index}: Section with an extremely long label TAIL`,
      count: index === 4 ? Number.MAX_SAFE_INTEGER : index,
    }));

    function Harness() {
      const [selectedId, setSelectedId] = useState(items[0]?.id ?? "");
      return (
        <CliThemeProvider initialTheme="dark">
          <SectionsList
            items={items}
            selectedId={selectedId}
            onSelect={vi.fn()}
            onHighlightChange={setSelectedId}
            height={4}
            width={18}
          />
        </CliThemeProvider>
      );
    }

    const { lastFrame, stdin } = render(<Harness />);
    for (let index = 0; index < 4; index += 1) {
      stdin.write("\u001B[B");
      await flush();
    }

    const lines = (lastFrame() ?? "").split("\n").filter(Boolean);
    expect(lines.some((line) => line.includes("4:"))).toBe(true);
    expect(lines[0]).toContain("\u25B2");
    expect(lines.at(-1)).toContain("\u25BC");
    expect(lines.join("\n")).not.toContain(String(Number.MAX_SAFE_INTEGER));
    expect(lines.join("\n")).not.toContain("TAIL");
    expect(lines.length).toBeLessThanOrEqual(4);
    expect(lines.every((line) => line.length <= 18)).toBe(true);
  });
});

async function flush(times = 4): Promise<void> {
  for (let index = 0; index < times; index += 1) {
    await new Promise((resolve) => setImmediate(resolve));
  }
}
