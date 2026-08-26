import type { ReviewEvent } from "@diffgazer/core/review";
import { describe, expect, it } from "vitest";
import { groupFileRowWindow } from "./file-row-groups";
import { convertEventRowWindow, deriveEventRowIndex } from "./row-index";

const timestamp = "2026-01-01T00:00:00.000Z";

type FileProgressAgent = Extract<ReviewEvent, { type: "file_progress" }>["agent"];

function fileEvent(agent: FileProgressAgent, completed: number, total: number): ReviewEvent {
  return {
    type: "file_progress",
    agent,
    file: `src/file-${completed}.ts`,
    completed,
    total,
    timestamp,
  };
}

function thinkingEvent(label: string): ReviewEvent {
  return { type: "agent_thinking", agent: "detective", thought: label, timestamp };
}

function indexOf(events: readonly ReviewEvent[]) {
  return deriveEventRowIndex(null, events, undefined);
}

describe("groupFileRowWindow", () => {
  it("collapses a consecutive same-lens FILE burst to one row with the first entry's id", () => {
    const events = [
      thinkingEvent("before"),
      fileEvent("detective", 1, 3),
      fileEvent("detective", 2, 3),
      fileEvent("detective", 3, 3),
      thinkingEvent("after"),
    ];
    const rows = groupFileRowWindow(indexOf(events), 0, events.length);

    expect(rows.map((row) => row.entry.message)).toEqual([
      "before",
      "Included 3 files in prompt (3/3)",
      "after",
    ]);
    expect(rows[1]).toMatchObject({
      entry: { id: "file_progress-1", tag: "FILE", tagType: "system" },
      firstRow: 1,
      rowCount: 3,
    });
    expect(rows[2]).toMatchObject({ firstRow: 4, rowCount: 1 });
  });

  it("does not merge two adjacent bursts from different lenses", () => {
    const events = [
      fileEvent("detective", 1, 2),
      fileEvent("detective", 2, 2),
      fileEvent("guardian", 1, 2),
      fileEvent("guardian", 2, 2),
    ];
    const rows = groupFileRowWindow(indexOf(events), 0, events.length);

    expect(rows.map((row) => row.entry.message)).toEqual([
      "Included 2 files in prompt (2/2)",
      "Included 2 files in prompt (2/2)",
    ]);
    expect(rows.map((row) => row.firstRow)).toEqual([0, 2]);
    expect(rows.map((row) => row.entry.id)).toEqual(["file_progress-0", "file_progress-2"]);
  });

  it("passes singleton FILE rows and non-FILE rows through unchanged", () => {
    const events = [
      thinkingEvent("one"),
      fileEvent("detective", 1, 1),
      thinkingEvent("two"),
      fileEvent("guardian", 1, 1),
    ];
    const index = indexOf(events);
    const rows = groupFileRowWindow(index, 0, events.length);

    expect(rows.map((row) => row.entry)).toEqual(convertEventRowWindow(index, 0, events.length));
    expect(rows.map((row) => row.rowCount)).toEqual([1, 1, 1, 1]);
  });

  it("renders a burst spanning a window edge as a partial group per window", () => {
    const events = Array.from({ length: 6 }, (_, offset) => fileEvent("detective", offset + 1, 6));
    const index = indexOf(events);

    const firstWindow = groupFileRowWindow(index, 0, 4);
    const secondWindow = groupFileRowWindow(index, 4, 6);

    expect(firstWindow).toHaveLength(1);
    expect(firstWindow[0]).toMatchObject({
      entry: { message: "Included 4 files in prompt (4/6)" },
      firstRow: 0,
      rowCount: 4,
    });
    expect(secondWindow).toHaveLength(1);
    expect(secondWindow[0]).toMatchObject({
      entry: { message: "Included 2 files in prompt (6/6)" },
      firstRow: 4,
      rowCount: 2,
    });
  });
});
