/**
 * @vitest-environment jsdom
 */
import { EventEmitter } from "node:events";
import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const useStdoutMock = vi.hoisted(() => vi.fn());

// Boundary mock: Ink terminal stdout hook.
vi.mock("ink", () => ({
  useStdout: useStdoutMock,
}));

import { useTerminalDimensions } from "./use-terminal-dimensions";

class FakeStdout extends EventEmitter {
  columns = 80;
  rows = 24;
}

function mountConsumer(stdout: FakeStdout) {
  useStdoutMock.mockReturnValue({ stdout, write: vi.fn() });
  return renderHook(() => useTerminalDimensions());
}

describe("useTerminalDimensions", () => {
  it("attaches a single shared resize listener for many consumers", () => {
    const stdout = new FakeStdout();
    const consumers = Array.from({ length: 12 }, () => mountConsumer(stdout));

    expect(stdout.listenerCount("resize")).toBe(1);

    for (const consumer of consumers) {
      expect(consumer.result.current).toEqual({ columns: 80, rows: 24 });
    }

    stdout.columns = 120;
    stdout.rows = 40;
    act(() => {
      stdout.emit("resize");
    });

    for (const consumer of consumers) {
      expect(consumer.result.current).toEqual({ columns: 120, rows: 40 });
    }

    const [unmounted, ...survivors] = consumers;
    if (!unmounted) throw new Error("Expected at least one mounted consumer");
    unmounted.unmount();
    expect(stdout.listenerCount("resize")).toBe(1);

    stdout.columns = 100;
    stdout.rows = 30;
    act(() => {
      stdout.emit("resize");
    });

    for (const consumer of survivors) {
      expect(consumer.result.current).toEqual({ columns: 100, rows: 30 });
    }

    for (const consumer of survivors) consumer.unmount();
    expect(stdout.listenerCount("resize")).toBe(0);
  });

  it("returns 80x24 fallbacks when the stream reports no size", () => {
    const stdout = new FakeStdout();
    stdout.columns = undefined as unknown as number;
    stdout.rows = undefined as unknown as number;

    const { result } = mountConsumer(stdout);

    expect(result.current).toEqual({ columns: 80, rows: 24 });
  });
});
