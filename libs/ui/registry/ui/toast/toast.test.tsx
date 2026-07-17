import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { act, configure, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { axe } from "../../../testing/axe";
import { toastDoc } from "../../component-docs/toast";
import { Dialog } from "../dialog/index";
import { Toaster, toast } from "./index";
import { dismiss, remove, useToastStore } from "./toast-store";

// The Toaster's persistent polite live region (F-229) duplicates visible toast
// text for screen readers, so text queries ignore it like script/style.
const DEFAULT_IGNORE = "script, style";
const TOAST_IGNORE = `${DEFAULT_IGNORE}, [data-slot="toast-announcer"], [data-slot="toast-announcer"] *`;
const LAZY_CHUNK_TIMEOUT_MS = 8_000;
const compoundComponentsGuide = readFileSync(
  resolve(import.meta.dirname, "../../../docs/content/patterns/compound-components.mdx"),
  "utf8",
);

function StoreReader({ onRead }: { onRead: (ids: string[]) => void }) {
  const { toasts } = useToastStore();
  onRead(toasts.map((t) => t.id));
  return null;
}

function cleanupStore() {
  let ids: string[] = [];
  const { unmount } = render(
    <StoreReader
      onRead={(v) => {
        ids = v;
      }}
    />,
  );
  unmount();
  for (const id of ids) {
    dismiss(id);
    remove(id);
  }
}

interface PopoverStub {
  getOpenCount: () => number;
  getShowCalls: () => number;
  restore: () => void;
}

// jsdom implements no popover / showPopover / hidePopover / :popover-open, so
// stub them to exercise the Toaster's supporting-browser branch. Every other
// test covers the non-supporting branch.
function installPopoverStub(): PopoverStub {
  const Proto = HTMLElement.prototype;
  const popoverDesc = Object.getOwnPropertyDescriptor(Proto, "popover");
  const showDesc = Object.getOwnPropertyDescriptor(Proto, "showPopover");
  const hideDesc = Object.getOwnPropertyDescriptor(Proto, "hidePopover");
  const matchesDesc = Object.getOwnPropertyDescriptor(Proto, "matches");
  const originalMatches = Proto.matches;
  let openCount = 0;
  let showCalls = 0;
  Object.defineProperty(Proto, "popover", {
    configurable: true,
    get(this: HTMLElement) {
      return this.getAttribute("popover");
    },
    set(this: HTMLElement, v: string | null) {
      if (v == null) this.removeAttribute("popover");
      else this.setAttribute("popover", v);
    },
  });
  Object.defineProperty(Proto, "showPopover", {
    configurable: true,
    writable: true,
    value(this: HTMLElement) {
      openCount++;
      showCalls++;
      this.setAttribute("data-popover-open", "");
    },
  });
  Object.defineProperty(Proto, "hidePopover", {
    configurable: true,
    writable: true,
    value(this: HTMLElement) {
      openCount--;
      this.removeAttribute("data-popover-open");
    },
  });
  Object.defineProperty(Proto, "matches", {
    configurable: true,
    writable: true,
    value(this: HTMLElement, selector: string) {
      if (selector === ":popover-open") return this.hasAttribute("data-popover-open");
      return originalMatches.call(this, selector);
    },
  });

  return {
    getOpenCount: () => openCount,
    getShowCalls: () => showCalls,
    restore() {
      if (popoverDesc) Object.defineProperty(Proto, "popover", popoverDesc);
      else Reflect.deleteProperty(Proto, "popover");
      if (showDesc) Object.defineProperty(Proto, "showPopover", showDesc);
      else Reflect.deleteProperty(Proto, "showPopover");
      if (hideDesc) Object.defineProperty(Proto, "hidePopover", hideDesc);
      else Reflect.deleteProperty(Proto, "hidePopover");
      if (matchesDesc) Object.defineProperty(Proto, "matches", matchesDesc);
    },
  };
}

describe("Toast", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    configure({ defaultIgnore: TOAST_IGNORE });
    Object.defineProperty(document, "hidden", { value: false, writable: true, configurable: true });
  });

  afterEach(() => {
    cleanupStore();
    configure({ defaultIgnore: DEFAULT_IGNORE });
    vi.useRealTimers();
  });

  it("creates a toast via toast() API and renders in Toaster", () => {
    render(<Toaster />);
    act(() => {
      toast("Hello world");
    });
    expect(screen.getByText("Hello world")).toBeInTheDocument();
  });

  it("creates fallback ids when randomUUID is unavailable", () => {
    const cryptoDescriptor = Object.getOwnPropertyDescriptor(globalThis, "crypto");
    Object.defineProperty(globalThis, "crypto", { configurable: true, value: undefined });

    try {
      render(<Toaster />);
      let id!: string;
      act(() => {
        id = toast("Fallback id");
      });
      expect(id).toMatch(/^toast-/);
      expect(screen.getByText("Fallback id")).toBeInTheDocument();
    } finally {
      if (cryptoDescriptor) Object.defineProperty(globalThis, "crypto", cryptoDescriptor);
    }
  });

  it("renders toast with a message body", () => {
    render(<Toaster />);
    act(() => {
      toast("Title", { message: "Body text" });
    });
    expect(screen.getByText("Title")).toBeInTheDocument();
    expect(screen.getByText("Body text")).toBeInTheDocument();
  });

  it("auto-dismisses after duration", () => {
    render(<Toaster />);
    act(() => {
      toast("Quick", { duration: 1000 });
    });
    expect(screen.getByText("Quick")).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(1000);
    });
    act(() => {
      vi.advanceTimersByTime(250);
    });
    expect(screen.queryByText("Quick")).not.toBeInTheDocument();
  });

  it("does not auto-dismiss error tone without explicit duration", () => {
    render(<Toaster />);
    act(() => {
      toast.error("Error occurred");
    });

    act(() => {
      vi.advanceTimersByTime(10000);
    });
    expect(screen.getByText("Error occurred")).toBeInTheDocument();
  });

  it("auto-dismisses error tone with explicit duration", () => {
    const persistenceNote = toastDoc.notes?.find((note) => note.title === "Error Toasts Persist");
    const toneDescription = toastDoc.props?.["toast (function)"]?.tone?.description;
    const durationDescription = toastDoc.props?.["toast (function)"]?.duration?.description;

    expect(persistenceNote?.content).toContain("persist when duration is omitted");
    expect(persistenceNote?.content).toContain("explicit positive duration");
    expect(toneDescription).toContain("persist when duration is omitted");
    expect(durationDescription).toContain("explicit positive duration");
    expect(compoundComponentsGuide).toContain(
      "Error and loading toasts persist when `duration` is omitted.",
    );
    expect(compoundComponentsGuide).toContain(
      "A positive explicit duration schedules auto-dismissal.",
    );

    render(<Toaster />);
    act(() => {
      toast.error("Error occurred", { duration: 2000 });
    });

    act(() => {
      vi.advanceTimersByTime(2000);
    });
    act(() => {
      vi.advanceTimersByTime(250);
    });
    expect(screen.queryByText("Error occurred")).not.toBeInTheDocument();
  });

  it("creates toast via tone helpers and tags data-tone", () => {
    render(<Toaster />);
    act(() => {
      toast.success("Saved!");
      toast.error("Failed!");
      toast.warning("Caution!");
      toast.info("FYI");
    });
    expect(screen.getByText("Saved!")).toBeInTheDocument();
    expect(screen.getByText("Failed!")).toBeInTheDocument();
    expect(screen.getByText("Caution!")).toBeInTheDocument();
    expect(screen.getByText("FYI")).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent("Failed!");

    const success = document.querySelector('[data-slot="toast"][data-tone="success"]');
    expect(success).not.toBeNull();
    expect(success).toHaveTextContent("Saved!");
  });

  it("renders role=alert for tone=error via the imperative options form", () => {
    render(<Toaster />);
    act(() => {
      toast("Boom", { tone: "error" });
    });
    expect(screen.getByRole("alert")).toHaveTextContent("Boom");
  });

  it("renders the loading toast spinner via the lazy chunk", async () => {
    vi.useRealTimers();
    render(<Toaster />);
    act(() => {
      toast.loading("Working");
    });

    const toastEl = screen.getByText("Working").closest('[role="status"]');
    expect(toastEl).not.toBeNull();
    await waitFor(
      () => {
        expect(toastEl?.querySelector('[role="status"][aria-label="Loading"]')).not.toBeNull();
      },
      { timeout: LAZY_CHUNK_TIMEOUT_MS },
    );
    vi.useFakeTimers();
  });

  it("tracks a resolved promise via toast.promise()", async () => {
    render(<Toaster />);
    let resolve!: (value: string) => void;
    const promise = new Promise<string>((r) => {
      resolve = r;
    });

    act(() => {
      toast.promise(promise, {
        loading: "Loading...",
        success: (data) => `Done: ${data}`,
        error: "Failed",
      });
    });
    expect(screen.getByText("Loading...")).toBeInTheDocument();

    await act(async () => {
      resolve("ok");
    });
    expect(screen.queryByText("Loading...")).not.toBeInTheDocument();
    expect(screen.getByText("Done: ok")).toBeInTheDocument();
  });

  it("tracks a rejected promise via toast.promise()", async () => {
    render(<Toaster />);
    let reject!: (reason: unknown) => void;
    const promise = new Promise<string>((_, r) => {
      reject = r;
    });

    act(() => {
      toast
        .promise(promise, {
          loading: "Loading...",
          success: "Done",
          error: (err) => `Error: ${(err as Error).message}`,
        })
        .catch(() => {});
    });

    await act(async () => {
      reject(new Error("boom"));
    });
    expect(screen.queryByText("Loading...")).not.toBeInTheDocument();
    expect(screen.getByText("Error: boom")).toBeInTheDocument();
  });

  it("evicts oldest toasts when exceeding max 5", () => {
    render(<Toaster />);
    act(() => {
      toast("Toast 1", { id: "ev1" });
      toast("Toast 2", { id: "ev2" });
      toast("Toast 3", { id: "ev3" });
      toast("Toast 4", { id: "ev4" });
      toast("Toast 5", { id: "ev5" });
      toast("Toast 6", { id: "ev6" });
    });

    expect(screen.queryByText("Toast 1")).not.toBeInTheDocument();
    expect(screen.getByText("Toast 2")).toBeInTheDocument();
    expect(screen.getByText("Toast 6")).toBeInTheDocument();
  });

  it("evicts the oldest persistent toast when max persistent toasts exist", () => {
    render(<Toaster />);
    act(() => {
      for (let index = 1; index <= 5; index++) {
        toast(`Persistent ${index}`, {
          id: `persistent-${index}`,
          action: <button type="button">Action {index}</button>,
        });
      }
      toast("Incoming toast", { id: "persistent-incoming" });
    });

    expect(screen.queryByText("Persistent 1")).not.toBeInTheDocument();
    expect(screen.getByText("Persistent 2")).toBeInTheDocument();
    expect(screen.getByText("Persistent 5")).toBeInTheDocument();
    expect(screen.getByText("Incoming toast")).toBeInTheDocument();
  });

  it("dismisses a toast via toast.dismiss(id)", () => {
    render(<Toaster />);
    let id!: string;
    act(() => {
      id = toast("Dismissable");
    });
    expect(screen.getByText("Dismissable")).toBeInTheDocument();

    act(() => {
      toast.dismiss(id);
    });
    act(() => {
      vi.advanceTimersByTime(250);
    });
    expect(screen.queryByText("Dismissable")).not.toBeInTheDocument();
  });

  it("dismisses all toasts via toast.dismiss() without id", () => {
    render(<Toaster />);
    act(() => {
      toast("One");
      toast("Two");
    });
    expect(screen.getByText("One")).toBeInTheDocument();
    expect(screen.getByText("Two")).toBeInTheDocument();

    act(() => {
      toast.dismiss();
    });
    act(() => {
      vi.advanceTimersByTime(250);
    });
    expect(screen.queryByText("One")).not.toBeInTheDocument();
    expect(screen.queryByText("Two")).not.toBeInTheDocument();
  });

  it("updates an existing toast when same id is reused", () => {
    render(<Toaster />);
    act(() => {
      toast("Original", { id: "same" });
    });
    expect(screen.getByText("Original")).toBeInTheDocument();

    act(() => {
      toast("Updated", { id: "same" });
    });
    expect(screen.queryByText("Original")).not.toBeInTheDocument();
    expect(screen.getByText("Updated")).toBeInTheDocument();
  });

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

  it("passes axe accessibility check", async () => {
    // axe runs async internals that conflict with fake timers
    vi.useRealTimers();
    const { container } = render(<Toaster />);
    act(() => {
      toast.info("Info toast");
    });
    expect(await axe(container)).toHaveNoViolations();
    vi.useFakeTimers();
  });

  it("dismisses the last toast on Escape key", () => {
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
    expect(screen.getByText("First")).toBeInTheDocument();
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

  it("does not double-fire a window-level Escape listener when a toast is dismissed", () => {
    const scopeEscape = vi.fn();
    const onWindowKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented) return;
      if (event.key === "Escape") scopeEscape();
    };
    window.addEventListener("keydown", onWindowKeyDown);

    try {
      render(<Toaster />);
      act(() => {
        toast("Dismiss me", { id: "consume-escape" });
      });

      act(() => {
        document.dispatchEvent(
          new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }),
        );
      });
      act(() => {
        vi.advanceTimersByTime(250);
      });
      expect(screen.queryByText("Dismiss me")).not.toBeInTheDocument();
      expect(scopeEscape).not.toHaveBeenCalled();

      // With no toast left, Escape reaches the window scope again.
      act(() => {
        document.dispatchEvent(
          new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }),
        );
      });
      expect(scopeEscape).toHaveBeenCalledTimes(1);
    } finally {
      window.removeEventListener("keydown", onWindowKeyDown);
    }
  });

  it("announces new non-error toasts through a persistent polite live region (F-229)", () => {
    const { container } = render(<Toaster />);
    const announcer = container.querySelector('[data-slot="toast-announcer"]');
    expect(announcer).not.toBeNull();
    expect(announcer).toHaveAttribute("aria-live", "polite");
    expect(announcer?.textContent).toBe("");

    act(() => {
      toast("Saved changes", { message: "All files synced" });
    });
    expect(announcer?.textContent).toBe("Saved changes, All files synced");
  });

  it("queues repeated batched announcements and prunes them", () => {
    const { container } = render(<Toaster />);
    const announcer = container.querySelector('[data-slot="toast-announcer"]');

    act(() => {
      toast("Repeated notice", { id: "repeat-1" });
      toast("Repeated notice", { id: "repeat-2" });
      toast.error("Assertive notice", { id: "repeat-error" });
    });

    const entries = announcer?.querySelectorAll('[data-slot="toast-announcement"]') ?? [];
    expect(Array.from(entries).map((entry) => entry.textContent)).toEqual([
      "Repeated notice",
      "Repeated notice",
    ]);

    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(announcer?.querySelectorAll('[data-slot="toast-announcement"]')).toHaveLength(0);
  });

  it("keeps error toasts on the role=alert path and out of the polite region", () => {
    const { container } = render(<Toaster />);
    const announcer = container.querySelector('[data-slot="toast-announcer"]');

    act(() => {
      toast.error("Failed to load");
    });
    expect(screen.getByRole("alert")).toHaveTextContent("Failed to load");
    expect(announcer?.textContent).toBe("");
  });

  it("focuses the toast region on the hotkey and ignores it inside editable elements (F-154)", () => {
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

  it("ignores the hotkey for an editable target inside an open shadow root (F-064)", () => {
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

      // The MutationObserver re-runs hidePopover+showPopover as a microtask
      // (F-450), so flush one.
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

  it("pauses auto-dismiss on pointer hover and resumes on leave (WCAG 2.2.1)", () => {
    render(<Toaster />);
    act(() => {
      toast("Hovered toast", { duration: 3000 });
    });

    act(() => {
      vi.advanceTimersByTime(1000);
    });

    const region = screen.getByRole("region", { name: "Notifications" });
    act(() => {
      // fireEvent retained: hover under fake timers; userEvent uses real timers internally.
      fireEvent.mouseEnter(region);
    });

    act(() => {
      vi.advanceTimersByTime(10000);
    });
    expect(screen.getByText("Hovered toast")).toBeInTheDocument();

    act(() => {
      // fireEvent retained: hover under fake timers; userEvent uses real timers internally.
      fireEvent.mouseLeave(region);
    });
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    act(() => {
      vi.advanceTimersByTime(250);
    });
    expect(screen.queryByText("Hovered toast")).not.toBeInTheDocument();
  });

  it("pauses auto-dismiss when focus enters the region and resumes on blur (WCAG 2.2.1)", () => {
    render(<Toaster />);
    act(() => {
      toast("Focusable toast", {
        duration: 3000,
        action: <button type="button">Undo</button>,
      });
    });

    act(() => {
      vi.advanceTimersByTime(1000);
    });

    const actionButton = screen.getByRole("button", { name: "Undo" });
    act(() => {
      actionButton.focus();
    });

    act(() => {
      vi.advanceTimersByTime(10000);
    });
    expect(screen.getByText("Focusable toast")).toBeInTheDocument();

    act(() => {
      actionButton.blur();
    });
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    act(() => {
      vi.advanceTimersByTime(250);
    });
    expect(screen.queryByText("Focusable toast")).not.toBeInTheDocument();
  });

  it("resumes auto-dismiss after the last toast is removed (no sticky-paused state)", () => {
    render(<Toaster />);
    act(() => {
      toast("First", { id: "stick-1" });
    });

    const region = screen.getByRole("region", { name: "Notifications" });
    act(() => {
      // fireEvent retained: hover under fake timers; userEvent uses real timers internally.
      fireEvent.mouseEnter(region);
    });

    act(() => {
      toast.dismiss("stick-1");
    });
    act(() => {
      vi.advanceTimersByTime(250);
    });
    expect(screen.queryByText("First")).not.toBeInTheDocument();

    act(() => {
      // fireEvent retained: hover under fake timers; userEvent uses real timers internally.
      fireEvent.mouseLeave(region);
    });

    act(() => {
      toast("Second", { id: "stick-2", duration: 1000 });
    });
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    act(() => {
      vi.advanceTimersByTime(250);
    });
    expect(screen.queryByText("Second")).not.toBeInTheDocument();
  });

  it("documents and renders localized dismiss and tone labels (F-010)", () => {
    const toastProps = toastDoc.props?.["toast (function)"];
    expect(toastProps?.dismissLabel).toEqual({
      type: "string",
      required: false,
      defaultValue: '"Dismiss: " + title',
      description: "Accessible name for the dismiss button.",
    });
    expect(toastProps?.toneLabel).toEqual({
      type: "string",
      required: false,
      defaultValue: "the tone value",
      description: "Screen-reader tone text announced before the toast title.",
    });

    render(<Toaster />);
    act(() => {
      toast("Saved", { dismissLabel: "Zamknij", toneLabel: "Informacja" });
    });
    const status = screen.getByRole("status");
    expect(screen.getByRole("button", { name: "Zamknij" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Dismiss/ })).not.toBeInTheDocument();
    expect(status).toHaveTextContent("Informacja:");
    expect(status).not.toHaveTextContent("info:");
  });

  it("pauses auto-dismiss while document is hidden and resumes on return", () => {
    render(<Toaster />);
    act(() => {
      toast("Paused toast", { duration: 3000 });
    });

    act(() => {
      vi.advanceTimersByTime(1000);
    });

    Object.defineProperty(document, "hidden", { value: true, writable: true, configurable: true });
    act(() => {
      document.dispatchEvent(new Event("visibilitychange"));
    });

    act(() => {
      vi.advanceTimersByTime(10000);
    });
    expect(screen.getByText("Paused toast")).toBeInTheDocument();

    Object.defineProperty(document, "hidden", { value: false, writable: true, configurable: true });
    act(() => {
      document.dispatchEvent(new Event("visibilitychange"));
    });

    act(() => {
      vi.advanceTimersByTime(2000);
    });
    act(() => {
      vi.advanceTimersByTime(250);
    });
    expect(screen.queryByText("Paused toast")).not.toBeInTheDocument();
  });

  it("keeps auto-dismiss paused until hover, focus, and document-hidden causes all clear", () => {
    render(<Toaster />);
    act(() => {
      toast("Multi-paused toast", {
        duration: 3000,
        action: <button type="button">Undo multi pause</button>,
      });
    });

    act(() => {
      vi.advanceTimersByTime(1000);
    });

    const region = screen.getByRole("region", { name: "Notifications" });
    const actionButton = screen.getByRole("button", { name: "Undo multi pause" });
    act(() => {
      actionButton.focus();
    });
    act(() => {
      // fireEvent retained: hover under fake timers; userEvent uses real timers internally.
      fireEvent.mouseEnter(region);
    });
    Object.defineProperty(document, "hidden", { value: true, writable: true, configurable: true });
    act(() => {
      document.dispatchEvent(new Event("visibilitychange"));
    });

    act(() => {
      // fireEvent retained: hover under fake timers; userEvent uses real timers internally.
      fireEvent.mouseLeave(region);
    });
    Object.defineProperty(document, "hidden", { value: false, writable: true, configurable: true });
    act(() => {
      document.dispatchEvent(new Event("visibilitychange"));
    });

    act(() => {
      vi.advanceTimersByTime(10000);
    });
    expect(screen.getByText("Multi-paused toast")).toBeInTheDocument();

    act(() => {
      actionButton.blur();
    });
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    act(() => {
      vi.advanceTimersByTime(250);
    });
    expect(screen.queryByText("Multi-paused toast")).not.toBeInTheDocument();
  });

  it("renders toasts and document handlers from the last mounted Toaster", () => {
    const firstRoot = document.createElement("div");
    const secondRoot = document.createElement("div");
    document.body.append(firstRoot, secondRoot);
    const first = render(<Toaster hotkey="F8" />, { container: firstRoot });
    const second = render(<Toaster hotkey="F9" />, { container: secondRoot });
    let secondMounted = true;

    try {
      act(() => {
        toast("Stacked toast", { id: "stacked-toast" });
      });

      expect(firstRoot).not.toHaveTextContent("Stacked toast");
      expect(firstRoot.querySelector('[data-slot="toast-announcer"]')).toBeNull();
      expect(secondRoot).toHaveTextContent("Stacked toast");
      expect(secondRoot.querySelector('[data-slot="toast-announcer"]')).not.toBeNull();

      const secondRegion = secondRoot.querySelector("[role='region'][aria-label='Notifications']");
      expect(secondRegion).not.toBeNull();
      act(() => {
        document.body.dispatchEvent(
          new KeyboardEvent("keydown", { key: "F8", bubbles: true, cancelable: true }),
        );
      });
      expect(document.activeElement).not.toBe(secondRegion);

      act(() => {
        document.body.dispatchEvent(
          new KeyboardEvent("keydown", { key: "F9", bubbles: true, cancelable: true }),
        );
      });
      expect(document.activeElement).toBe(secondRegion);

      act(() => {
        second.unmount();
      });
      secondMounted = false;

      expect(firstRoot).toHaveTextContent("Stacked toast");
      expect(firstRoot.querySelector('[data-slot="toast-announcer"]')).not.toBeNull();
    } finally {
      if (secondMounted) second.unmount();
      first.unmount();
      firstRoot.remove();
      secondRoot.remove();
    }
  });

  describe("variant layouts", () => {
    function findToast(text: string) {
      return screen.getByText(text).closest('[data-slot="toast"]');
    }

    it('variant="card" is the default', () => {
      render(<Toaster />);
      act(() => {
        toast("Card default");
      });
      const root = findToast("Card default");
      expect(root).toHaveAttribute("data-variant", "card");
    });

    it('variant="hud" omits the close button and action', () => {
      render(<Toaster />);
      act(() => {
        toast("Copied", { variant: "hud" });
      });
      const root = findToast("Copied");
      expect(root).toHaveAttribute("data-variant", "hud");
      expect(root?.querySelector("button")).toBeNull();
      expect(root?.querySelector('[data-slot="toast-action"]')).toBeNull();
    });

    it('variant="hud" auto-dismisses even when an action is supplied (HUD drops the action, so persistence rule does not apply)', () => {
      const durationDescription = toastDoc.props?.["toast (function)"]?.duration?.description;

      expect(durationDescription).toContain("rendered action");
      expect(durationDescription).toContain("`hud` variant does not render actions");

      const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
      try {
        render(<Toaster />);
        act(() => {
          toast("Quick HUD", { variant: "hud", action: <button type="button">Undo</button> });
        });
        expect(screen.getByText("Quick HUD")).toBeInTheDocument();

        act(() => {
          vi.advanceTimersByTime(5000);
        });
        act(() => {
          vi.advanceTimersByTime(250);
        });
        expect(screen.queryByText("Quick HUD")).not.toBeInTheDocument();
      } finally {
        warn.mockRestore();
      }
    });

    it('variant="hud" silently drops the action prop', () => {
      const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
      try {
        render(<Toaster />);
        act(() => {
          toast("Saved", {
            variant: "hud",
            action: <button type="button">Undo</button>,
          });
        });
        const root = findToast("Saved");
        expect(root?.querySelector('[data-slot="toast-action"]')).toBeNull();
        expect(root?.textContent).not.toContain("Undo");
        expect(warn).not.toHaveBeenCalled();
        expect(toastDoc.props?.["toast (function)"]?.action?.description).toContain(
          "silently omits",
        );
      } finally {
        warn.mockRestore();
      }
    });

    it('variant="viewfinder" renders four corner spans', () => {
      render(<Toaster />);
      act(() => {
        toast("Saved", { variant: "viewfinder", message: "All done" });
      });
      const root = findToast("Saved");
      const corners = root?.querySelector('[data-slot="toast-corners"]');
      expect(corners).not.toBeNull();
      expect(corners?.querySelectorAll("span")).toHaveLength(4);
    });

    it('variant="hud" stays role=status even for error tone (informational by definition)', () => {
      render(<Toaster />);
      act(() => {
        toast("Failed to copy", { tone: "error", variant: "hud" });
      });
      const root = findToast("Failed to copy");
      expect(root).toHaveAttribute("role", "status");
      // role="status" implies aria-live="polite" — we intentionally do not set
      // it explicitly to avoid the WAI-ARIA "both role and aria-live" footgun.
      expect(root).not.toHaveAttribute("aria-live");
    });

    it('variant="countdown" renders an aria-hidden countdown slot', () => {
      render(<Toaster />);
      act(() => {
        toast("Synced", { variant: "countdown", message: "12 files", duration: 5000 });
      });
      const root = findToast("Synced");
      const countdown = root?.querySelector('[data-slot="toast-countdown"]');
      expect(countdown).not.toBeNull();
      expect(countdown).toHaveAttribute("aria-hidden", "true");
    });

    it("starts timed countdown dismissal when a persistent toast is updated", () => {
      render(<Toaster />);
      act(() => {
        toast("Waiting", { id: "countdown-update", variant: "countdown", duration: 0 });
      });

      act(() => {
        vi.advanceTimersByTime(5000);
      });
      expect(screen.getByText("Waiting")).toBeInTheDocument();

      act(() => {
        toast("Timed", { id: "countdown-update", variant: "countdown", duration: 1000 });
      });
      expect(screen.queryByText("Waiting")).not.toBeInTheDocument();
      expect(screen.getByText("Timed")).toBeInTheDocument();

      act(() => {
        vi.advanceTimersByTime(400);
      });

      const region = screen.getByRole("region", { name: "Notifications" });
      act(() => {
        // fireEvent retained: hover under fake timers; userEvent uses real timers internally.
        fireEvent.mouseEnter(region);
      });

      act(() => {
        vi.advanceTimersByTime(5000);
      });
      expect(screen.getByText("Timed")).toBeInTheDocument();

      act(() => {
        // fireEvent retained: hover under fake timers; userEvent uses real timers internally.
        fireEvent.mouseLeave(region);
      });

      act(() => {
        vi.advanceTimersByTime(599);
      });
      expect(screen.getByText("Timed")).toBeInTheDocument();

      act(() => {
        vi.advanceTimersByTime(1);
      });
      act(() => {
        vi.advanceTimersByTime(250);
      });
      expect(screen.queryByText("Timed")).not.toBeInTheDocument();
    });

    it('variant="countdown" parks its rAF loop while paused and resumes on unpause (F-187)', () => {
      const rafSpy = vi.spyOn(globalThis, "requestAnimationFrame");
      render(<Toaster />);
      act(() => {
        toast("Synced", { variant: "countdown", duration: 5000 });
      });

      act(() => {
        vi.advanceTimersByTime(64);
      });
      expect(rafSpy.mock.calls.length).toBeGreaterThan(0);

      const region = screen.getByRole("region", { name: "Notifications" });
      act(() => {
        // fireEvent retained: hover under fake timers; userEvent uses real timers internally.
        fireEvent.mouseEnter(region);
      });
      const callsAtPause = rafSpy.mock.calls.length;

      // While paused, time advancing schedules no further frames.
      act(() => {
        vi.advanceTimersByTime(500);
      });
      expect(rafSpy.mock.calls.length).toBe(callsAtPause);

      act(() => {
        // fireEvent retained: hover under fake timers; userEvent uses real timers internally.
        fireEvent.mouseLeave(region);
      });
      act(() => {
        vi.advanceTimersByTime(32);
      });
      expect(rafSpy.mock.calls.length).toBeGreaterThan(callsAtPause);

      rafSpy.mockRestore();
    });
  });
});

describe("Toaster cross-document behavior", () => {
  it("renders the notification region inside the container ownerDocument", () => {
    const iframe = document.createElement("iframe");
    document.body.appendChild(iframe);
    const iframeDoc = iframe.contentDocument;
    if (!iframeDoc) {
      iframe.remove();
      throw new Error("iframe.contentDocument is null; cannot exercise cross-document toaster");
    }
    const container = iframeDoc.createElement("div");
    iframeDoc.body.appendChild(container);

    render(<Toaster />, { container });

    const region = iframeDoc.querySelector("[role='region'][aria-label='Notifications']");
    expect(region).not.toBeNull();
    expect(region?.ownerDocument).toBe(iframeDoc);

    iframe.remove();
  });
});
