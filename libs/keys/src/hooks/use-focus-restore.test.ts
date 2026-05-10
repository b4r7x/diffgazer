import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { useFocusRestore } from "./use-focus-restore";

function button(label: string) {
  const element = document.createElement("button");
  element.textContent = label;
  document.body.append(element);
  return element;
}

describe("useFocusRestore", () => {
  afterEach(() => {
    cleanup();
    document.body.replaceChildren();
  });

  it("restores nested targets in stack order", () => {
    const outsideTrigger = button("Outside");
    const parentControl = button("Parent control");
    const childControl = button("Child control");
    const parentRestore = renderHook(() => useFocusRestore({ restoreOnUnmount: false }));
    const childRestore = renderHook(() => useFocusRestore({ restoreOnUnmount: false }));

    outsideTrigger.focus();
    act(() => {
      expect(parentRestore.result.current.capture()).toBe(outsideTrigger);
    });

    parentControl.focus();
    act(() => {
      expect(childRestore.result.current.capture()).toBe(parentControl);
    });

    childControl.focus();
    act(() => {
      expect(childRestore.result.current.restore()).toBe(true);
    });
    expect(document.activeElement).toBe(parentControl);

    act(() => {
      expect(parentRestore.result.current.restore()).toBe(true);
    });
    expect(document.activeElement).toBe(outsideTrigger);
  });

  it("restores on unmount when enabled", () => {
    const trigger = button("Trigger");
    const inside = button("Inside");

    trigger.focus();
    const focusRestore = renderHook(() => useFocusRestore());
    act(() => {
      focusRestore.result.current.capture();
    });

    inside.focus();
    focusRestore.unmount();

    expect(document.activeElement).toBe(trigger);
  });

  it("uses fallback when the captured target is unavailable", () => {
    const trigger = button("Trigger");
    const fallback = button("Fallback");
    const focusRestore = renderHook(() =>
      useFocusRestore({ fallback, restoreOnUnmount: false }),
    );

    trigger.focus();
    act(() => {
      expect(focusRestore.result.current.capture()).toBe(trigger);
    });

    trigger.remove();
    act(() => {
      expect(focusRestore.result.current.restore()).toBe(true);
    });

    expect(document.activeElement).toBe(fallback);
  });

  it("removes a captured entry when disabled", () => {
    const outsideTrigger = button("Outside");
    const parentControl = button("Parent control");
    const parentRestore = renderHook(() => useFocusRestore({ restoreOnUnmount: false }));
    const childRestore = renderHook(
      ({ enabled }) => useFocusRestore({ enabled, restoreOnUnmount: false }),
      { initialProps: { enabled: true } },
    );

    outsideTrigger.focus();
    act(() => {
      parentRestore.result.current.capture();
    });

    parentControl.focus();
    act(() => {
      childRestore.result.current.capture();
    });

    act(() => {
      childRestore.rerender({ enabled: false });
    });

    expect(childRestore.result.current.target).toBe(null);
    act(() => {
      expect(parentRestore.result.current.restore()).toBe(true);
    });
    expect(document.activeElement).toBe(outsideTrigger);
  });
});
