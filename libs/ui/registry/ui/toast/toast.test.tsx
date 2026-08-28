import { act, render, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { axe } from "../../../testing/axe";
import { Toaster, toast } from "./index";
import { useHasPersistentToast } from "./toast-store";
import { applyToastTestEnvironment } from "./toast-test-utils";

describe("Toast", () => {
  applyToastTestEnvironment();

  it("creates a toast via toast() API and renders in Toaster", () => {
    render(<Toaster />);
    act(() => {
      toast("Hello world");
    });
    expect(screen.getByText("Hello world")).toBeInTheDocument();
  });

  it("hands the toasts to a scoped Toaster mounted after the app-wide one", () => {
    render(
      <>
        <Toaster label="App notifications" />
        <div>
          <Toaster label="Demo notifications" position="top-left" />
        </div>
      </>,
    );
    act(() => {
      toast("Scoped corner");
    });

    const scoped = screen.getByRole("region", { name: "Demo notifications" });
    expect(within(scoped).getByText("Scoped corner")).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "App notifications" })).not.toBeInTheDocument();
  });

  it("creates distinct, independently controllable fallback ids when randomUUID is unavailable", () => {
    const cryptoDescriptor = Object.getOwnPropertyDescriptor(globalThis, "crypto");
    Object.defineProperty(globalThis, "crypto", { configurable: true, value: undefined });

    try {
      render(<Toaster />);
      let firstId!: string;
      let secondId!: string;
      act(() => {
        firstId = toast("Fallback one");
        secondId = toast("Fallback two");
      });
      expect(firstId).not.toBe("");
      expect(secondId).not.toBe("");
      expect(firstId).not.toBe(secondId);
      expect(screen.getByText("Fallback one")).toBeInTheDocument();
      expect(screen.getByText("Fallback two")).toBeInTheDocument();

      act(() => {
        toast("Fallback one updated", { id: firstId });
      });
      expect(screen.queryByText("Fallback one")).not.toBeInTheDocument();
      expect(screen.getByText("Fallback one updated")).toBeInTheDocument();
      expect(screen.getByText("Fallback two")).toBeInTheDocument();

      act(() => {
        toast.dismiss(secondId);
      });
      act(() => {
        vi.advanceTimersByTime(250);
      });
      expect(screen.queryByText("Fallback two")).not.toBeInTheDocument();
      expect(screen.getByText("Fallback one updated")).toBeInTheDocument();
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

  it("renders the loading toast spinner via the lazy chunk", async () => {
    // Resolve the dynamic import up front so the assertion waits on React flushing
    // the already-loaded chunk, not on the loader itself.
    await import("../spinner/spinner");
    vi.useRealTimers();
    render(<Toaster />);
    act(() => {
      toast.loading("Working");
    });

    const toastEl = screen.getByText("Working").closest('[role="status"]');
    expect(toastEl).not.toBeNull();
    await waitFor(() => {
      expect(toastEl?.querySelector('[role="status"][aria-label="Loading"]')).not.toBeNull();
    });
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

  it("treats a duration: Infinity toast as persistent", () => {
    let hasPersistent = false;
    function PersistentReader() {
      hasPersistent = useHasPersistentToast();
      return null;
    }
    render(
      <>
        <Toaster />
        <PersistentReader />
      </>,
    );
    act(() => {
      toast("Sticky", { id: "sticky", duration: Number.POSITIVE_INFINITY });
      for (let index = 1; index <= 5; index++) {
        toast(`Transient ${index}`, { id: `transient-${index}` });
      }
    });

    expect(hasPersistent).toBe(true);
    expect(screen.getByText("Sticky")).toBeInTheDocument();
    expect(screen.queryByText("Transient 1")).not.toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(10_000);
    });
    expect(screen.getByText("Sticky")).toBeInTheDocument();
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

    render(<Toaster hotkey="F8" />, { container });

    const region = iframeDoc.querySelector<HTMLElement>(
      "[role='region'][aria-label='Notifications']",
    );
    expect(region).not.toBeNull();
    expect(region?.ownerDocument).toBe(iframeDoc);

    vi.useFakeTimers();
    try {
      act(() => {
        toast("Cross-document toast", { duration: 3000 });
      });
      expect(iframeDoc.querySelector('[data-slot="toast"]')).not.toBeNull();

      act(() => {
        iframeDoc.body.dispatchEvent(new KeyboardEvent("keydown", { key: "F8", bubbles: true }));
      });
      expect(region?.contains(iframeDoc.activeElement)).toBe(true);

      act(() => {
        region?.blur();
      });

      act(() => {
        vi.advanceTimersByTime(1000);
      });

      Object.defineProperty(iframeDoc, "hidden", {
        value: true,
        writable: true,
        configurable: true,
      });
      act(() => {
        iframeDoc.dispatchEvent(new Event("visibilitychange"));
      });
      act(() => {
        vi.advanceTimersByTime(10000);
      });
      expect(iframeDoc.querySelector('[data-slot="toast"]')).not.toBeNull();

      Object.defineProperty(iframeDoc, "hidden", {
        value: false,
        writable: true,
        configurable: true,
      });
      act(() => {
        iframeDoc.dispatchEvent(new Event("visibilitychange"));
      });
      act(() => {
        vi.advanceTimersByTime(2000);
      });
      act(() => {
        vi.advanceTimersByTime(250);
      });
      expect(iframeDoc.querySelector('[data-slot="toast"]')).toBeNull();
    } finally {
      vi.useRealTimers();
    }

    iframe.remove();
  });
});
