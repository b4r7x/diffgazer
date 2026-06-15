import { render, screen, within } from "@testing-library/react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { isHTMLDialogElement } from "@/lib/aria";
import { DialogShell } from "./dialog-shell";

// axe skipped: internal overlay infrastructure with no standalone accessible UI; consumer dialogs run axe.

function requireFrameDocument(frame: HTMLIFrameElement): Document {
  const frameDocument = frame.contentDocument;
  if (!frameDocument) throw new Error("Expected iframe document");
  return frameDocument;
}

function polyfillDialogElement(doc: Document): void {
  const DialogCtor = doc.defaultView?.HTMLDialogElement;
  if (!DialogCtor) return;
  DialogCtor.prototype.showModal ??= function showModal(this: HTMLDialogElement) {
    this.setAttribute("open", "");
  };
  DialogCtor.prototype.close ??= function close(this: HTMLDialogElement) {
    this.removeAttribute("open");
  };
}

function fireTabFromActive(ownerDocument: Document, shiftKey = false) {
  const KeyboardEventCtor = ownerDocument.defaultView?.KeyboardEvent ?? KeyboardEvent;
  const event = new KeyboardEventCtor("keydown", {
    key: "Tab",
    shiftKey,
    bubbles: true,
    cancelable: true,
  });
  ownerDocument.activeElement?.dispatchEvent(event);
  return event;
}

describe("DialogShell", () => {
  const frameRoots: Root[] = [];

  afterEach(() => {
    for (const root of frameRoots.splice(0)) {
      act(() => {
        root.unmount();
      });
    }
    document.body.replaceChildren();
  });

  it("scopes open-shell focus gating per ownerDocument", async () => {
    const frame = document.createElement("iframe");
    document.body.append(frame);
    const frameDocument = requireFrameDocument(frame);
    polyfillDialogElement(frameDocument);

    render(
      <DialogShell open aria-label="Host shell">
        <button type="button" id="host-first">
          Host first
        </button>
        <button type="button" id="host-second">
          Host second
        </button>
      </DialogShell>,
    );

    const frameContainer = frameDocument.createElement("div");
    frameDocument.body.append(frameContainer);

    await act(async () => {
      const root = createRoot(frameContainer);
      frameRoots.push(root);
      root.render(
        <DialogShell open aria-label="Frame shell">
          <button type="button" id="frame-first">
            Frame first
          </button>
          <button type="button" id="frame-second">
            Frame second
          </button>
        </DialogShell>,
      );
    });

    const hostDialog = screen.getByRole("dialog", { name: "Host shell" });
    const frameDialog = within(frameDocument.body).getByRole("dialog", { name: "Frame shell" });
    expect(isHTMLDialogElement(hostDialog)).toBe(true);
    expect(isHTMLDialogElement(frameDialog)).toBe(true);

    const hostFirst = hostDialog?.querySelector("#host-first") as HTMLButtonElement;
    const hostSecond = hostDialog?.querySelector("#host-second") as HTMLButtonElement;
    const frameFirst = frameDialog?.querySelector("#frame-first") as HTMLButtonElement;
    const frameSecond = frameDialog?.querySelector("#frame-second") as HTMLButtonElement;

    hostFirst.focus();
    expect(document.activeElement).toBe(hostFirst);

    frameFirst.focus();
    expect(frameDocument.activeElement).toBe(frameFirst);

    hostSecond.focus();
    const hostTabEvent = fireTabFromActive(document);
    expect(hostTabEvent.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(hostFirst);

    frameSecond.focus();
    const frameTabEvent = fireTabFromActive(frameDocument);
    expect(frameTabEvent.defaultPrevented).toBe(true);
    expect(frameDocument.activeElement).toBe(frameFirst);
  });

  it("uses owner-document-safe dialog guards for cross-realm dialogs", async () => {
    const frame = document.createElement("iframe");
    document.body.append(frame);
    const frameDocument = requireFrameDocument(frame);
    polyfillDialogElement(frameDocument);

    const onBeforeShowModal = vi.fn();
    const frameContainer = frameDocument.createElement("div");
    frameDocument.body.append(frameContainer);

    await act(async () => {
      const root = createRoot(frameContainer);
      frameRoots.push(root);
      root.render(
        <DialogShell open aria-label="Frame shell" onBeforeShowModal={onBeforeShowModal}>
          <button type="button">Frame action</button>
        </DialogShell>,
      );
    });

    const frameDialog = within(frameDocument.body).getByRole("dialog", { name: "Frame shell" });
    expect(isHTMLDialogElement(frameDialog)).toBe(true);
    expect(frameDialog).toHaveAttribute("open");
    expect(onBeforeShowModal).toHaveBeenCalledWith(frameDocument);
  });
});
