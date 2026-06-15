import { renderHook } from "@testing-library/react";
import { createRef, type Ref } from "react";
import { describe, expect, it, vi } from "vitest";
import { useComposedRefs } from "./use-composed-refs";

describe("useComposedRefs", () => {
  it("keeps a stable callback identity across re-renders with the same refs", () => {
    const a = createRef<HTMLDivElement>();
    const b = createRef<HTMLDivElement>();
    const { result, rerender } = renderHook(({ refs }) => useComposedRefs(...refs), {
      initialProps: { refs: [a, b] as Array<Ref<HTMLDivElement>> },
    });
    const first = result.current;
    rerender({ refs: [a, b] as Array<Ref<HTMLDivElement>> });
    expect(result.current).toBe(first);
  });

  it("returns a new callback when a ref identity changes", () => {
    const a = createRef<HTMLDivElement>();
    const b = createRef<HTMLDivElement>();
    const c = createRef<HTMLDivElement>();
    const { result, rerender } = renderHook(({ refs }) => useComposedRefs(...refs), {
      initialProps: { refs: [a, b] as Array<Ref<HTMLDivElement>> },
    });
    const first = result.current;
    rerender({ refs: [a, c] as Array<Ref<HTMLDivElement>> });
    expect(result.current).not.toBe(first);
  });

  it("assigns the element to every composed ref", () => {
    const objectRef = createRef<HTMLDivElement>();
    const callbackRef = vi.fn();
    const { result } = renderHook(() => useComposedRefs(objectRef, callbackRef));
    const node = document.createElement("div");
    result.current(node);
    expect(objectRef.current).toBe(node);
    expect(callbackRef).toHaveBeenCalledWith(node);
  });

  it("ignores null and undefined refs", () => {
    const objectRef = createRef<HTMLDivElement>();
    const { result } = renderHook(() => useComposedRefs(objectRef, null, undefined));
    const node = document.createElement("div");
    expect(() => result.current(node)).not.toThrow();
    expect(objectRef.current).toBe(node);
  });
});
