import { afterEach, describe, expect, it } from "vitest";
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

  it("ignores non-restorable active elements", () => {
    const trigger = button("Trigger");

    trigger.focus();
    trigger.remove();
    expect(getRestorableFocusTarget()).toBe(null);

    document.body.focus();
    expect(getRestorableFocusTarget()).toBe(null);
  });

  it("captures and restores focus in the provided ownerDocument", () => {
    const frame = document.createElement("iframe");
    document.body.append(frame);
    const frameDocument = frame.contentDocument;
    expect(frameDocument).not.toBeNull();

    const trigger = button("Trigger", frameDocument!);
    const other = button("Other", frameDocument!);

    trigger.focus();
    expect(getRestorableFocusTarget(frameDocument!)).toBe(trigger);

    other.focus();
    expect(restoreFocus(trigger)).toBe(true);
    expect(frameDocument!.activeElement).toBe(trigger);
  });
});
