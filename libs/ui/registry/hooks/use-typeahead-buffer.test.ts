import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useTypeaheadBuffer } from "./use-typeahead-buffer";

describe("useTypeaheadBuffer", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("ignores non-character keys and rejects Space on an empty buffer", () => {
    const { result } = renderHook(() => useTypeaheadBuffer());
    expect(result.current("Enter")).toBeNull();
    expect(result.current("ArrowDown")).toBeNull();
    // Space is rejected while the buffer is empty so it stays the select/activate key.
    expect(result.current(" ")).toBeNull();
  });

  it("accumulates printable characters into a lowercased buffer", () => {
    const { result } = renderHook(() => useTypeaheadBuffer());
    expect(result.current("A")).toBe("a");
    expect(result.current("B")).toBe("ab");
    expect(result.current("c")).toBe("abc");
  });

  it("accepts Space into a non-empty buffer to disambiguate multi-word labels", () => {
    const { result } = renderHook(() => useTypeaheadBuffer());
    expect(result.current("n")).toBe("n");
    expect(result.current("e")).toBe("ne");
    expect(result.current("w")).toBe("new");
    // Space extends the query once characters are buffered ("new y").
    expect(result.current(" ")).toBe("new ");
    expect(result.current("y")).toBe("new y");
  });

  it("resets the buffer after the idle window", () => {
    const { result } = renderHook(() => useTypeaheadBuffer(500));
    expect(result.current("a")).toBe("a");
    expect(result.current("b")).toBe("ab");
    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(result.current("c")).toBe("c");
  });

  it("starts a new buffer when the interaction session changes", () => {
    const { result, rerender } = renderHook(
      ({ session }) => useTypeaheadBuffer(undefined, session),
      { initialProps: { session: "closed" } },
    );

    expect(result.current("a")).toBe("a");
    rerender({ session: "open" });
    expect(result.current("b")).toBe("b");
  });

  describe("locale-aware lowercasing", () => {
    it("emits a Turkish dotted I that round-trips through default-locale lowercase", () => {
      const { result } = renderHook(() => useTypeaheadBuffer());
      // Same transformation `matchesSearch`/`typeaheadSearch` apply to labels.
      const expected = "İ".toLocaleLowerCase();
      expect(result.current("İ")).toBe(expected);
    });
  });
});
