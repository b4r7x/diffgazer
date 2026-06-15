import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { requireFrameDocument } from "../testing/assertions.js";
import { useFocusRestore } from "./use-focus-restore.js";

function button(label: string) {
  const element = document.createElement("button");
  element.textContent = label;
  document.body.append(element);
  return element;
}

describe("useFocusRestore", () => {
  afterEach(() => {
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
    const focusRestore = renderHook(() => useFocusRestore({ fallback, restoreOnUnmount: false }));

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

  it("keeps independent restore stacks per ownerDocument", () => {
    const frame = document.createElement("iframe");
    document.body.append(frame);
    const frameDocument = requireFrameDocument(frame);

    const hostTrigger = button("Host trigger");
    const hostInside = button("Host inside");
    const frameTrigger = frameDocument.createElement("button");
    frameTrigger.textContent = "Frame trigger";
    frameDocument.body.append(frameTrigger);
    const frameInside = frameDocument.createElement("button");
    frameInside.textContent = "Frame inside";
    frameDocument.body.append(frameInside);

    const hostRestore = renderHook(() => useFocusRestore({ restoreOnUnmount: false }));
    const frameRestore = renderHook(() => useFocusRestore({ restoreOnUnmount: false }));

    hostTrigger.focus();
    act(() => {
      expect(hostRestore.result.current.capture()).toBe(hostTrigger);
    });

    frameTrigger.focus();
    act(() => {
      expect(frameRestore.result.current.capture(frameDocument)).toBe(frameTrigger);
    });

    hostInside.focus();
    frameInside.focus();
    expect(document.activeElement).toBe(hostInside);
    expect(frameDocument.activeElement).toBe(frameInside);

    act(() => {
      expect(frameRestore.result.current.restore()).toBe(true);
    });
    expect(frameDocument.activeElement).toBe(frameTrigger);
    expect(document.activeElement).toBe(hostInside);

    act(() => {
      expect(hostRestore.result.current.restore()).toBe(true);
    });
    expect(document.activeElement).toBe(hostTrigger);

    frame.remove();
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
