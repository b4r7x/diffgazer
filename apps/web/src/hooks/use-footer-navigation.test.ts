import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";

const keyHandlers = new Map<string, () => void>();

vi.mock("keyscope", () => ({
  useKey: (
    keyOrHandlers: string | Record<string, () => void>,
    handlerOrOptions?: (() => void) | { enabled?: boolean },
    maybeOptions?: { enabled?: boolean },
  ) => {
    if (typeof keyOrHandlers === "string") {
      const options = maybeOptions ?? (typeof handlerOrOptions === "object" ? handlerOrOptions : undefined);
      if ((options as { enabled?: boolean })?.enabled === false) return;
      keyHandlers.set(keyOrHandlers, handlerOrOptions as () => void);
    } else {
      const options = handlerOrOptions as { enabled?: boolean } | undefined;
      if (options?.enabled === false) return;
      for (const [key, handler] of Object.entries(keyOrHandlers)) {
        keyHandlers.set(key, handler);
      }
    }
  },
}));

import { useFooterNavigation } from "./use-footer-navigation";

function press(key: string) {
  const handler = keyHandlers.get(key);
  if (!handler) throw new Error(`Missing handler for key "${key}"`);
  handler();
}

function renderSubject(overrides: Partial<Parameters<typeof useFooterNavigation>[0]> = {}) {
  const onAction = vi.fn();
  const defaults: Parameters<typeof useFooterNavigation>[0] = {
    enabled: true,
    buttonCount: 3,
    onAction,
    wrap: false,
    autoEnter: true,
  };

  const hookResult = renderHook(() => useFooterNavigation({ ...defaults, ...overrides }));
  return { ...hookResult, onAction };
}

describe("useFooterNavigation", () => {
  beforeEach(() => {
    keyHandlers.clear();
  });

  it("enterFooter sets inFooter true with correct initial index", () => {
    const { result } = renderSubject();

    act(() => result.current.enterFooter(2));

    expect(result.current.inFooter).toBe(true);
    expect(result.current.focusedIndex).toBe(2);
  });

  it("enterFooter defaults to index 0", () => {
    const { result } = renderSubject();

    act(() => result.current.enterFooter());

    expect(result.current.inFooter).toBe(true);
    expect(result.current.focusedIndex).toBe(0);
  });

  it("ArrowRight updates focusedIndex forward", () => {
    const { result } = renderSubject();

    act(() => result.current.enterFooter(0));
    act(() => press("ArrowRight"));

    expect(result.current.focusedIndex).toBe(1);
  });

  it("ArrowLeft updates focusedIndex backward", () => {
    const { result } = renderSubject();

    act(() => result.current.enterFooter(2));
    act(() => press("ArrowLeft"));

    expect(result.current.focusedIndex).toBe(1);
  });

  it("ArrowLeft clamps at 0 without wrap", () => {
    const { result } = renderSubject({ wrap: false });

    act(() => result.current.enterFooter(0));
    act(() => press("ArrowLeft"));

    expect(result.current.focusedIndex).toBe(0);
  });

  it("ArrowRight clamps at last index without wrap", () => {
    const { result } = renderSubject({ buttonCount: 3, wrap: false });

    act(() => result.current.enterFooter(2));
    act(() => press("ArrowRight"));

    expect(result.current.focusedIndex).toBe(2);
  });

  it("ArrowLeft wraps to last index with wrap enabled", () => {
    const { result } = renderSubject({ buttonCount: 3, wrap: true });

    act(() => result.current.enterFooter(0));
    act(() => press("ArrowLeft"));

    expect(result.current.focusedIndex).toBe(2);
  });

  it("ArrowRight wraps to first index with wrap enabled", () => {
    const { result } = renderSubject({ buttonCount: 3, wrap: true });

    act(() => result.current.enterFooter(2));
    act(() => press("ArrowRight"));

    expect(result.current.focusedIndex).toBe(0);
  });

  it("ArrowUp exits footer", () => {
    const { result } = renderSubject();

    act(() => result.current.enterFooter(1));
    act(() => press("ArrowUp"));

    expect(result.current.inFooter).toBe(false);
  });

  it("Enter triggers onAction with current focusedIndex", () => {
    const { result, onAction } = renderSubject();

    act(() => result.current.enterFooter(1));
    act(() => press("Enter"));

    expect(onAction).toHaveBeenCalledWith(1);
  });

  it("Space triggers onAction with current focusedIndex", () => {
    const { result, onAction } = renderSubject();

    act(() => result.current.enterFooter(2));
    act(() => press(" "));

    expect(onAction).toHaveBeenCalledWith(2);
  });

  it("reset clears footer state", () => {
    const { result } = renderSubject();

    act(() => result.current.enterFooter(2));
    act(() => result.current.reset());

    expect(result.current.inFooter).toBe(false);
    expect(result.current.focusedIndex).toBe(0);
  });

  it("reset accepts a custom initial index", () => {
    const { result } = renderSubject();

    act(() => result.current.enterFooter(2));
    act(() => result.current.reset(1));

    expect(result.current.focusedIndex).toBe(1);
  });

  it("does not register key handlers when enabled is false", () => {
    renderSubject({ enabled: false });

    expect(keyHandlers.size).toBe(0);
  });
});
