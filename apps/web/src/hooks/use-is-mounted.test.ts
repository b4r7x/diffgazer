import { renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useIsMountedRef } from "./use-is-mounted";

describe("useIsMountedRef", () => {
  it("reports mounted while rendered and unmounted after teardown", () => {
    const { result, unmount } = renderHook(() => useIsMountedRef());

    expect(result.current.current).toBe(true);

    unmount();

    expect(result.current.current).toBe(false);
  });

  it("lets work started before unmount skip its late completion", async () => {
    let resolveRequest: (() => void) | undefined;
    const request = new Promise<void>((resolve) => {
      resolveRequest = resolve;
    });
    const completions: string[] = [];

    const { result, unmount } = renderHook(() => useIsMountedRef());
    const isMountedRef = result.current;

    const inFlight = request.then(() => {
      if (!isMountedRef.current) return;
      completions.push("navigated");
    });

    unmount();
    resolveRequest?.();
    await inFlight;

    expect(completions).toEqual([]);
  });
});
