import { cleanup } from "ink-testing-library";
import { act } from "react";
import stripAnsi from "strip-ansi";
import { afterEach, describe, expect, test, vi } from "vitest";

import { cleanupRootFrames } from "../../../../testing/render-root-frame";
import { flush, renderView } from "./test-support";

afterEach(() => {
  cleanup();
  cleanupRootFrames();
  vi.useRealTimers();
});

describe("ReviewProgressView (TUI) elapsed time", () => {
  test("uses the lifecycle completion timestamp after streaming completes", () => {
    vi.useFakeTimers();
    const startedAt = new Date("2026-01-01T00:00:00.000Z");
    const completedAt = new Date("2026-01-01T00:00:02.500Z");
    vi.setSystemTime(new Date("2026-01-01T00:00:12.500Z"));

    const { lastFrame } = renderView({
      isStreaming: false,
      startedAt,
      completedAt,
    });

    // The label and value are separately coloured Text nodes, so the raw frame
    // splits them with an escape sequence whenever colour is on.
    expect(stripAnsi(lastFrame() ?? "")).toContain("Elapsed: 00:02");
  });

  test("advances elapsed time during a silent stream", async () => {
    vi.useFakeTimers({
      toFake: ["Date", "setTimeout", "clearTimeout", "setInterval", "clearInterval"],
    });
    const startedAt = new Date("2026-01-01T00:00:00.000Z");
    vi.setSystemTime(startedAt);

    const { lastFrame } = renderView({
      events: [],
      isStreaming: true,
      startedAt,
    });

    await flush();
    expect(stripAnsi(lastFrame() ?? "")).toMatch(/Elapsed:\s*00:00/);

    act(() => {
      vi.advanceTimersByTime(1_000);
    });

    await flush();
    expect(stripAnsi(lastFrame() ?? "")).toMatch(/Elapsed:\s*00:01/);
  });
});
