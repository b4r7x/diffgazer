import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Toaster, toast } from "./index";
import { applyToastTestEnvironment } from "./toast-test-utils";

describe("Toast variant layouts", () => {
  applyToastTestEnvironment();

  function findToast(text: string) {
    return screen.getByText(text).closest('[data-slot="toast"]');
  }

  it("dismiss button reserves a 44px coarse-pointer target", () => {
    render(<Toaster />);
    act(() => {
      toast("Touchable");
    });
    // touch-target contract: pointer-coarse hit-area is the public contract; jsdom cannot measure layout.
    const dismiss = screen.getByRole("button", { name: "Dismiss: Touchable" });
    expect(dismiss).toHaveClass("pointer-coarse:min-h-11");
    expect(dismiss).toHaveClass("pointer-coarse:min-w-11");
  });

  it('variant="card" is the default', () => {
    render(<Toaster />);
    act(() => {
      toast("Card default");
    });
    const root = findToast("Card default");
    expect(root).toHaveAttribute("data-variant", "card");
  });

  it('variant="hud" omits the close button', () => {
    render(<Toaster />);
    act(() => {
      toast("Copied", { variant: "hud" });
    });
    const root = findToast("Copied");
    expect(root).toHaveAttribute("data-variant", "hud");
    expect(root?.querySelector("button")).toBeNull();
  });

  it('variant="hud" auto-dismisses even when an action is supplied (HUD drops the action, so persistence rule does not apply)', () => {
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

  it('variant="hud" auto-dismisses error tone on the default duration', () => {
    render(<Toaster />);
    act(() => {
      toast("Failed to copy", { tone: "error", variant: "hud" });
    });
    expect(screen.getByText("Failed to copy")).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(5000);
    });
    act(() => {
      vi.advanceTimersByTime(250);
    });
    expect(screen.queryByText("Failed to copy")).not.toBeInTheDocument();
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

  it('variant="countdown" parks its rAF loop while paused and resumes on unpause', () => {
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
