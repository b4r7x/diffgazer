import { renderHook, act } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useTypeaheadBuffer } from "../use-typeahead-buffer.js";

describe("useTypeaheadBuffer", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("ignores non-character keys", () => {
    const { result } = renderHook(() => useTypeaheadBuffer());
    expect(result.current("Enter")).toBeNull();
    expect(result.current("ArrowDown")).toBeNull();
    expect(result.current(" ")).toBeNull();
  });

  it("accumulates printable characters into a lowercased buffer", () => {
    const { result } = renderHook(() => useTypeaheadBuffer());
    expect(result.current("A")).toBe("a");
    expect(result.current("B")).toBe("ab");
    expect(result.current("c")).toBe("abc");
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

  describe("locale-aware lowercasing", () => {
    it("emits a Turkish dotted I that round-trips through default-locale lowercase", () => {
      const { result } = renderHook(() => useTypeaheadBuffer());
      // Same transformation `matchesSearch`/`typeaheadSearch` apply to labels.
      const expected = "İ".toLocaleLowerCase();
      expect(result.current("İ")).toBe(expected);
    });

    it("preserves German ß and matches uppercase ß lowercasing", () => {
      const { result } = renderHook(() => useTypeaheadBuffer());
      expect(result.current("ß")).toBe("ß".toLocaleLowerCase());
    });

    it("returns composed Unicode (NFC) buffer", () => {
      const { result } = renderHook(() => useTypeaheadBuffer());
      expect(result.current("É")).toBe("É".toLocaleLowerCase());
    });
  });
});
