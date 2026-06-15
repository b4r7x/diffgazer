import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useCopyToClipboard } from "./use-copy-to-clipboard";

describe("useCopyToClipboard", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("writes the text and reports copied on success", async () => {
    const write = vi.fn().mockResolvedValue(undefined);
    const onCopy = vi.fn();
    const { result } = renderHook(() => useCopyToClipboard({ write, onCopy }));

    expect(result.current.status).toBe("idle");

    let returned: boolean | undefined;
    await act(async () => {
      returned = await result.current.copy("css-var");
    });

    expect(write).toHaveBeenCalledWith("css-var");
    expect(onCopy).toHaveBeenCalledWith("css-var");
    expect(returned).toBe(true);
    expect(result.current.copied).toBe(true);
    expect(result.current.failed).toBe(false);
  });

  it("reports failed and forwards the error when the write rejects", async () => {
    const error = new Error("denied");
    const write = vi.fn().mockRejectedValue(error);
    const onError = vi.fn();
    const { result } = renderHook(() => useCopyToClipboard({ write, onError }));

    let returned: boolean | undefined;
    await act(async () => {
      returned = await result.current.copy("x");
    });

    expect(onError).toHaveBeenCalledWith(error);
    expect(returned).toBe(false);
    expect(result.current.failed).toBe(true);
    expect(result.current.copied).toBe(false);
  });

  it("resets to idle after the 2000ms window", async () => {
    const write = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() => useCopyToClipboard({ write }));

    await act(async () => {
      await result.current.copy("x");
    });
    expect(result.current.copied).toBe(true);

    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(result.current.status).toBe("idle");
  });

  it("restarts the reset timer when copied again before it elapses", async () => {
    const write = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() => useCopyToClipboard({ write }));

    await act(async () => {
      await result.current.copy("a");
    });
    act(() => {
      vi.advanceTimersByTime(1500);
    });
    expect(result.current.copied).toBe(true);

    await act(async () => {
      await result.current.copy("b");
    });
    act(() => {
      vi.advanceTimersByTime(1500);
    });
    // Still copied: the second copy restarted the 2000ms window.
    expect(result.current.copied).toBe(true);

    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(result.current.status).toBe("idle");
  });

  it("honors a custom resetMs", async () => {
    const write = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() => useCopyToClipboard({ write, resetMs: 500 }));

    await act(async () => {
      await result.current.copy("x");
    });
    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(result.current.status).toBe("idle");
  });

  it("clears the pending reset timer on unmount", async () => {
    const write = vi.fn().mockResolvedValue(undefined);
    const clearSpy = vi.spyOn(globalThis, "clearTimeout");
    const { result, unmount } = renderHook(() => useCopyToClipboard({ write }));

    await act(async () => {
      await result.current.copy("x");
    });

    clearSpy.mockClear();
    unmount();
    expect(clearSpy).toHaveBeenCalled();
  });

  it("defaults to navigator.clipboard.writeText", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { ...globalThis.navigator, clipboard: { writeText } });
    const { result } = renderHook(() => useCopyToClipboard());

    await act(async () => {
      await result.current.copy("var(--base)");
    });

    expect(writeText).toHaveBeenCalledWith("var(--base)");
    vi.unstubAllGlobals();
  });
});
