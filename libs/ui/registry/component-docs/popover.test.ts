// @vitest-environment jsdom

import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { usePopoverBehavior } from "../ui/popover/use-behavior";

afterEach(() => {
  vi.useRealTimers();
});

describe("Popover behavior contract", () => {
  it("cancels a pending hover open when disabled while closed", () => {
    vi.useFakeTimers();
    const onOpenChange = vi.fn();
    const { result, rerender } = renderHook(
      ({ enabled }) =>
        usePopoverBehavior({
          open: false,
          onOpenChange,
          enabled,
          triggerMode: "hover",
          delayMs: 500,
        }),
      { initialProps: { enabled: true } },
    );

    act(() => result.current.onTriggerEnter());
    rerender({ enabled: false });
    act(() => vi.advanceTimersByTime(500));

    expect(onOpenChange).not.toHaveBeenCalled();
  });

  it("cancels a pending hover close when disabled while open", () => {
    vi.useFakeTimers();
    const onOpenChange = vi.fn();
    const { result, rerender } = renderHook(
      ({ enabled }) =>
        usePopoverBehavior({
          open: true,
          onOpenChange,
          enabled,
          triggerMode: "hover",
          delayMs: 500,
          closeDelayMs: 500,
        }),
      { initialProps: { enabled: true } },
    );

    act(() => {
      result.current.onTriggerEnter();
      result.current.onTriggerLeave();
    });
    rerender({ enabled: false });

    expect(onOpenChange).toHaveBeenCalledOnce();
    expect(onOpenChange).toHaveBeenLastCalledWith(false);

    act(() => vi.advanceTimersByTime(500));

    expect(onOpenChange).toHaveBeenCalledOnce();
  });
});
