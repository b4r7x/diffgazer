import { act, render, screen } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { Dialog } from "../dialog/index";
import { focusToastRegion, Toaster, toast } from "./index";
import {
  applyToastTestEnvironment,
  inspectRegionViaHotkey,
  installPopoverStub,
} from "./toast-test-utils";

describe("Toast keyboard and focus management", () => {
  applyToastTestEnvironment();

  it("does not steal focus when a toast appears", () => {
    render(
      <div>
        <input aria-label="Focused input" />
        <Toaster />
      </div>,
    );
    const input = screen.getByRole("textbox", { name: "Focused input" });
    input.focus();
    expect(document.activeElement).toBe(input);

    act(() => {
      toast("New toast");
    });
    expect(document.activeElement).toBe(input);
  });

  it("dismisses the entire visible stack on a single Escape key", () => {
    render(<Toaster />);
    act(() => {
      toast("First", { id: "k1" });
      toast("Second", { id: "k2" });
    });

    act(() => {
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    });
    act(() => {
      vi.advanceTimersByTime(250);
    });

    expect(screen.queryByText("Second")).not.toBeInTheDocument();
    expect(screen.queryByText("First")).not.toBeInTheDocument();
  });

  it("moves focus off a removed toast action after Escape dismisses the stack", () => {
    render(<Toaster />);
    act(() => {
      toast("Actionable", { id: "focus-esc", action: <button type="button">Undo</button> });
    });

    const actionButton = screen.getByRole("button", { name: "Undo" });
    act(() => {
      actionButton.focus();
    });
    expect(document.activeElement).toBe(actionButton);

    act(() => {
      document.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }),
      );
    });
    act(() => {
      vi.advanceTimersByTime(250);
    });

    expect(screen.queryByText("Actionable")).not.toBeInTheDocument();
    expect(actionButton.isConnected).toBe(false);
    // Focus must not be stranded on the detached node; it lands on body where
    // the app's keyboard scopes take over.
    expect(document.activeElement).toBe(document.body);
  });

  it("dismisses a toast on Escape while a dialog is open and marks the keypress handled", () => {
    render(
      <>
        <Dialog defaultOpen>
          <Dialog.Content>
            <Dialog.Title>Blocking dialog</Dialog.Title>
          </Dialog.Content>
        </Dialog>
        <Toaster />
      </>,
    );
    act(() => {
      toast("Background toast", { id: "dialog-toast" });
    });

    const event = new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true });
    act(() => {
      document.dispatchEvent(event);
    });
    act(() => {
      vi.advanceTimersByTime(250);
    });

    expect(event.defaultPrevented).toBe(true);
    expect(screen.queryByText("Background toast")).not.toBeInTheDocument();
    expect(screen.getByRole("dialog", { name: "Blocking dialog" })).toHaveAttribute(
      "data-state",
      "open",
    );
  });

  it("consumes exactly one Escape for a stacked error burst before a window-level listener", () => {
    const scopeEscape = vi.fn();
    const onWindowKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented) return;
      if (event.key === "Escape") scopeEscape();
    };
    window.addEventListener("keydown", onWindowKeyDown);

    try {
      render(<Toaster />);
      act(() => {
        toast.error("Backend restarting", { id: "burst-1" });
        toast.error("Error loading review", { id: "burst-2" });
      });

      // The first press dismisses the whole stack and is consumed.
      act(() => {
        document.dispatchEvent(
          new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }),
        );
      });
      expect(scopeEscape).not.toHaveBeenCalled();

      // The stack is already dismissing (exit animation running), so the next
      // press falls through to the window scope without waiting for removal.
      act(() => {
        document.dispatchEvent(
          new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }),
        );
      });
      expect(scopeEscape).toHaveBeenCalledTimes(1);

      act(() => {
        vi.advanceTimersByTime(250);
      });
      expect(screen.queryByText("Backend restarting")).not.toBeInTheDocument();
      expect(screen.queryByText("Error loading review")).not.toBeInTheDocument();

      // With no toast left, Escape keeps reaching the window scope.
      act(() => {
        document.dispatchEvent(
          new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }),
        );
      });
      expect(scopeEscape).toHaveBeenCalledTimes(2);
    } finally {
      window.removeEventListener("keydown", onWindowKeyDown);
    }
  });

  it("focuses the toast region on the hotkey and ignores it inside editable elements", () => {
    render(
      <div>
        <input aria-label="Editor" />
        <Toaster hotkey="F8" />
      </div>,
    );
    act(() => {
      toast("Reachable toast", { action: <button type="button">Undo</button> });
    });

    const region = screen.getByRole("region", { name: "Notifications" });

    const regionHasFocus = () =>
      document.activeElement === region || region.contains(document.activeElement);

    // Hotkey while focus is in an editable element is ignored.
    const input = screen.getByRole("textbox", { name: "Editor" });
    input.focus();
    act(() => {
      input.dispatchEvent(new KeyboardEvent("keydown", { key: "F8", bubbles: true }));
    });
    expect(regionHasFocus()).toBe(false);

    // Hotkey from a non-editable target moves focus to the region.
    input.blur();
    act(() => {
      document.body.dispatchEvent(new KeyboardEvent("keydown", { key: "F8", bubbles: true }));
    });
    expect(regionHasFocus()).toBe(true);
  });

  it("does not claim a hotkey already handled by a non-editable control", () => {
    render(
      <div>
        <button type="button" onKeyDown={(event) => event.preventDefault()}>
          Application shortcut
        </button>
        <Toaster hotkey="F8" />
      </div>,
    );
    act(() => {
      toast("Reachable toast", { action: <button type="button">Undo</button> });
    });

    const button = screen.getByRole("button", { name: "Application shortcut" });
    const region = screen.getByRole("region", { name: "Notifications" });
    button.focus();
    const event = new KeyboardEvent("keydown", {
      key: "F8",
      bubbles: true,
      cancelable: true,
    });

    act(() => {
      button.dispatchEvent(event);
    });

    expect(event.defaultPrevented).toBe(true);
    expect(button).toHaveFocus();
    expect(region).not.toHaveFocus();
  });

  it("ignores the hotkey for an editable target inside an open shadow root", () => {
    render(<Toaster hotkey="F8" />);
    act(() => {
      toast("Reachable toast", { action: <button type="button">Undo</button> });
    });

    const region = screen.getByRole("region", { name: "Notifications" });
    const regionHasFocus = () =>
      document.activeElement === region || region.contains(document.activeElement);

    const host = document.createElement("div");
    document.body.append(host);
    const shadowRoot = host.attachShadow({ mode: "open" });
    const input = document.createElement("input");
    shadowRoot.append(input);
    input.focus();

    // A composed keydown surfaces the host as event.target on the document
    // listener; only composedPath()[0] reveals the editable shadow input.
    act(() => {
      input.dispatchEvent(
        new KeyboardEvent("keydown", { key: "F8", bubbles: true, composed: true }),
      );
    });

    expect(regionHasFocus()).toBe(false);
    host.remove();
  });

  it("returns focus to the pre-hotkey element on Escape inside the region", () => {
    render(
      <div>
        <button type="button">Page control</button>
        <Toaster hotkey="F8" />
      </div>,
    );
    act(() => {
      toast("Returnable toast", { id: "esc-return", action: <button type="button">Undo</button> });
    });
    const { pageControl, region } = inspectRegionViaHotkey();

    const escapeEvent = new KeyboardEvent("keydown", {
      key: "Escape",
      bubbles: true,
      cancelable: true,
    });
    act(() => {
      region.dispatchEvent(escapeEvent);
    });
    expect(pageControl).toHaveFocus();

    // Escape exits the inspection and is consumed, so app-level Escape
    // handlers (back navigation) cannot also fire and the stack stays visible.
    expect(escapeEvent.defaultPrevented).toBe(true);
    act(() => {
      vi.advanceTimersByTime(250);
    });
    expect(screen.getByText("Returnable toast")).toBeInTheDocument();
  });

  it("returns focus to the pre-hotkey element when the last toast is dismissed from inside the region", () => {
    render(
      <div>
        <button type="button">Page control</button>
        <Toaster hotkey="F8" />
      </div>,
    );
    act(() => {
      toast("Final toast", { id: "last-focused" });
    });
    const { pageControl } = inspectRegionViaHotkey();

    const dismissButton = screen.getByRole("button", { name: "Dismiss: Final toast" });
    act(() => {
      dismissButton.focus();
    });
    act(() => {
      dismissButton.click();
    });
    act(() => {
      vi.advanceTimersByTime(250);
    });
    expect(screen.queryByText("Final toast")).not.toBeInTheDocument();
    expect(pageControl).toHaveFocus();
  });

  it("walks the region controls with arrows and returns focus to the opener at the boundary", () => {
    render(
      <div>
        <button type="button">Page control</button>
        <Toaster hotkey="F8" />
      </div>,
    );
    act(() => {
      toast.error("Connection lost", {
        id: "arrow-walk",
        action: <button type="button">Retry</button>,
      });
    });
    const { pageControl, region } = inspectRegionViaHotkey();

    const arrow = (key: "ArrowDown" | "ArrowUp") => {
      act(() => {
        (document.activeElement ?? region).dispatchEvent(
          new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true }),
        );
      });
    };

    arrow("ArrowDown");
    expect(screen.getByRole("button", { name: "Retry" })).toHaveFocus();
    arrow("ArrowDown");
    expect(screen.getByRole("button", { name: "Dismiss: Connection lost" })).toHaveFocus();
    arrow("ArrowUp");
    expect(screen.getByRole("button", { name: "Retry" })).toHaveFocus();
    arrow("ArrowDown");
    arrow("ArrowDown");
    expect(pageControl).toHaveFocus();
  });

  it("enters the region through focusToastRegion and restores the opener on boundary exit", () => {
    render(
      <div>
        <button type="button">Page control</button>
        <Toaster />
      </div>,
    );
    expect(focusToastRegion()).toBe(false);

    act(() => {
      toast.error("Connection lost", {
        id: "arrow-entry",
        action: <button type="button">Retry</button>,
      });
    });
    const pageControl = screen.getByRole("button", { name: "Page control" });
    act(() => {
      pageControl.focus();
    });
    let entered = false;
    act(() => {
      entered = focusToastRegion();
    });
    expect(entered).toBe(true);
    const region = screen.getByRole("region", { name: "Notifications" });
    expect(region).toHaveFocus();

    act(() => {
      region.dispatchEvent(
        new KeyboardEvent("keydown", { key: "ArrowUp", bubbles: true, cancelable: true }),
      );
    });
    expect(pageControl).toHaveFocus();
  });

  it("leaves focus with the user when the last toast expires after focus left the region", () => {
    render(
      <div>
        <button type="button">Page control</button>
        <input aria-label="Elsewhere" />
        <Toaster hotkey="F8" />
      </div>,
    );
    act(() => {
      toast("Expiring toast", { id: "expire-1", duration: 3000 });
    });
    inspectRegionViaHotkey();

    const elsewhere = screen.getByRole("textbox", { name: "Elsewhere" });
    act(() => {
      elsewhere.focus();
    });

    act(() => {
      vi.advanceTimersByTime(3000);
    });
    act(() => {
      vi.advanceTimersByTime(250);
    });
    expect(screen.queryByText("Expiring toast")).not.toBeInTheDocument();
    expect(elsewhere).toHaveFocus();
  });

  it("leaves an open dialog's focus restore intact after an abandoned hotkey inspection", () => {
    // Triggerless dialog, as apps/web opens all of its dialogs: DialogContent
    // has no trigger ref to fall back on, so its restore must survive on its
    // own. An inspection started while the dialog is open and then abandoned
    // used to strand an entry above the dialog's on the shared restore stack.
    function ControlledDialog() {
      const [open, setOpen] = useState(true);
      return (
        <div>
          <button type="button" onClick={() => setOpen(true)}>
            Page control
          </button>
          <Dialog open={open} onOpenChange={setOpen}>
            <Dialog.Content>
              <Dialog.Title>Settings</Dialog.Title>
              <Dialog.Close>Close</Dialog.Close>
            </Dialog.Content>
          </Dialog>
          <Toaster hotkey="F8" />
        </div>
      );
    }

    const opener = document.createElement("button");
    opener.textContent = "Opener";
    document.body.append(opener);
    opener.focus();

    render(<ControlledDialog />);
    act(() => {
      toast("Background toast", { id: "stack-1" });
    });
    const closeButton = screen.getByRole("button", { name: "Close" });

    // Press the hotkey while the dialog is open. The dialog's focus trap keeps
    // focus inside, so the inspection never really starts — but it must also
    // not leave anything behind that outranks the dialog's own restore.
    act(() => {
      closeButton.dispatchEvent(
        new KeyboardEvent("keydown", { key: "F8", bubbles: true, cancelable: true }),
      );
    });

    act(() => {
      closeButton.click();
    });
    act(() => {
      vi.advanceTimersByTime(500);
    });

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(opener).toHaveFocus();
    opener.remove();
  });

  it("renders a toast triggered while a modal dialog is open", () => {
    render(
      <>
        <Dialog defaultOpen>
          <Dialog.Content>
            <Dialog.Title>Blocking dialog</Dialog.Title>
          </Dialog.Content>
        </Dialog>
        <Toaster />
      </>,
    );

    act(() => {
      toast.error("Failed to save", { id: "over-dialog" });
    });

    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("Failed to save");
    expect(screen.getByRole("region", { name: "Notifications" })).toContainElement(alert);
  });

  it("activates Popover API on the container when the browser supports it", () => {
    const stub = installPopoverStub();

    try {
      const { unmount, container } = render(<Toaster />);
      expect(stub.getOpenCount()).toBe(0);

      act(() => {
        toast("Top-layer toast", { id: "tl-1" });
      });
      const region = container.ownerDocument.querySelector(
        "[role='region'][aria-label='Notifications']",
      );
      expect(region).not.toBeNull();
      expect(region).toHaveAttribute("popover", "manual");
      expect(region).toHaveAttribute("data-popover-open");
      expect(stub.getOpenCount()).toBe(1);

      act(() => {
        toast.dismiss();
      });
      act(() => {
        vi.advanceTimersByTime(250);
      });
      expect(region).not.toHaveAttribute("data-popover-open");
      expect(stub.getOpenCount()).toBe(0);

      act(() => {
        toast("Re-issued", { id: "tl-2" });
      });
      expect(region).toHaveAttribute("data-popover-open");
      expect(stub.getOpenCount()).toBe(1);

      unmount();
      expect(stub.getOpenCount()).toBe(0);
    } finally {
      stub.restore();
    }
  });

  it("re-asserts the top-layer position when a dialog opens while toasts are visible", async () => {
    const stub = installPopoverStub();

    try {
      function Harness({ dialogOpen }: { dialogOpen: boolean }) {
        return (
          <>
            <Dialog open={dialogOpen}>
              <Dialog.Content>
                <Dialog.Title>Later dialog</Dialog.Title>
              </Dialog.Content>
            </Dialog>
            <Toaster />
          </>
        );
      }

      const { rerender, unmount } = render(<Harness dialogOpen={false} />);
      act(() => {
        toast.error("Persistent failure", { id: "pre-dialog" });
      });
      const showCallsBeforeDialog = stub.getShowCalls();
      expect(showCallsBeforeDialog).toBeGreaterThanOrEqual(1);

      // The MutationObserver re-runs hidePopover+showPopover as a microtask,
      // so flush one.
      rerender(<Harness dialogOpen />);
      await act(async () => {
        await Promise.resolve();
      });
      expect(stub.getShowCalls()).toBeGreaterThan(showCallsBeforeDialog);

      const region = document.querySelector("[role='region'][aria-label='Notifications']");
      expect(region).toHaveAttribute("data-popover-open");

      // Unmount before restoring the stub so the cleanup effect's hidePopover
      // call still resolves against the stubbed prototype.
      unmount();
    } finally {
      stub.restore();
    }
  });
});
