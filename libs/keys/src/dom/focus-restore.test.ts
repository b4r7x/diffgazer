import { afterEach, describe, expect, it, vi } from "vitest";
import { requireFrameDocument } from "../testing/assertions.js";
import { getRestorableFocusTarget, restoreFocus } from "./focus-restore.js";

function button(label: string, ownerDocument: Document = document) {
  const element = ownerDocument.createElement("button");
  element.textContent = label;
  ownerDocument.body.append(element);
  return element;
}

describe("focus restore utilities", () => {
  afterEach(() => {
    document.body.replaceChildren();
  });

  it("captures the active HTMLElement and restores focus to connected targets", () => {
    const trigger = button("Trigger");
    const other = button("Other");

    trigger.focus();

    expect(getRestorableFocusTarget()).toBe(trigger);

    other.focus();
    expect(restoreFocus(trigger)).toBe(true);
    expect(document.activeElement).toBe(trigger);

    trigger.remove();
    expect(restoreFocus(trigger)).toBe(false);
  });

  it("restores to the same connected trigger across repeated panel cycles", () => {
    const trigger = button("Open panel");
    const panel = button("Panel action");

    for (let cycle = 0; cycle < 2; cycle += 1) {
      trigger.focus();
      const captured = getRestorableFocusTarget();
      panel.focus();

      expect(captured).toBe(trigger);
      expect(restoreFocus(captured)).toBe(true);
      expect(document.activeElement).toBe(trigger);
      expect(trigger.isConnected).toBe(true);
    }
  });

  it("ignores non-restorable active elements", () => {
    const trigger = button("Trigger");

    trigger.focus();
    trigger.remove();
    expect(getRestorableFocusTarget()).toBe(null);

    document.body.focus();
    expect(getRestorableFocusTarget()).toBe(null);
  });

  it("captures and restores focus inside an open shadow root", () => {
    const host = document.createElement("div");
    document.body.append(host);
    const shadowRoot = host.attachShadow({ mode: "open" });
    const shadowButton = document.createElement("button");
    shadowButton.textContent = "Shadow";
    shadowRoot.append(shadowButton);

    shadowButton.focus();

    expect(document.activeElement).toBe(host);
    expect(getRestorableFocusTarget()).toBe(shadowButton);

    const other = button("Other");
    other.focus();

    expect(restoreFocus(shadowButton)).toBe(true);
    expect(host.shadowRoot?.activeElement).toBe(shadowButton);
  });

  it("retries with a plain focus() call when the engine rejects FocusOptions", () => {
    const target = button("Trigger");
    const originalFocus = target.focus.bind(target);
    const focusSpy = vi.spyOn(target, "focus").mockImplementation((options?: FocusOptions) => {
      if (options) throw new Error("FocusOptions unsupported");
      originalFocus();
    });

    expect(restoreFocus(target, { preventScroll: true })).toBe(true);
    expect(document.activeElement).toBe(target);
    expect(focusSpy).toHaveBeenNthCalledWith(1, { preventScroll: true });
    expect(focusSpy).toHaveBeenNthCalledWith(2);

    focusSpy.mockRestore();
  });

  it("captures and restores focus in the provided ownerDocument", () => {
    const frame = document.createElement("iframe");
    document.body.append(frame);
    const frameDocument = requireFrameDocument(frame);

    const trigger = button("Trigger", frameDocument);
    const other = button("Other", frameDocument);

    trigger.focus();
    expect(getRestorableFocusTarget(frameDocument)).toBe(trigger);

    other.focus();
    expect(restoreFocus(trigger)).toBe(true);
    expect(frameDocument?.activeElement).toBe(trigger);
  });
});
