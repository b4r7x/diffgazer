import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Toaster, toast } from "./index";
import { applyToastTestEnvironment } from "./toast-test-utils";

describe("Toast auto-dismiss timing", () => {
  applyToastTestEnvironment();

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

  it("re-derives the focus pause after removing a focused toast from a stack", () => {
    render(<Toaster />);
    act(() => {
      toast("Focused first", {
        id: "focus-freeze-1",
        duration: 3000,
        action: <button type="button">Undo focus freeze</button>,
      });
      toast("Timed second", { id: "focus-freeze-2", duration: 3000 });
    });

    act(() => {
      vi.advanceTimersByTime(1000);
    });

    const actionButton = screen.getByRole("button", { name: "Undo focus freeze" });
    act(() => {
      actionButton.focus();
    });
    expect(actionButton).toHaveFocus();

    act(() => {
      toast.dismiss("focus-freeze-1");
    });
    act(() => {
      vi.advanceTimersByTime(250);
    });
    expect(screen.queryByText("Focused first")).not.toBeInTheDocument();
    expect(document.activeElement).toBe(document.body);

    act(() => {
      vi.advanceTimersByTime(2000);
    });
    act(() => {
      vi.advanceTimersByTime(250);
    });
    expect(screen.queryByText("Timed second")).not.toBeInTheDocument();
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

  it("keeps a toast created after the list emptied paused while region focus persists (WCAG 2.2.1)", () => {
    render(<Toaster />);
    act(() => {
      toast("Focused first", { id: "gap-1", duration: 3000 });
    });

    const region = screen.getByRole("region", { name: "Notifications" });
    act(() => {
      region.focus();
    });
    expect(region).toHaveFocus();

    act(() => {
      toast.dismiss("gap-1");
    });
    act(() => {
      vi.advanceTimersByTime(250);
    });
    expect(screen.queryByText("Focused first")).not.toBeInTheDocument();
    expect(region).toHaveFocus();

    act(() => {
      toast("Focused second", { id: "gap-2", duration: 3000 });
    });
    act(() => {
      vi.advanceTimersByTime(10000);
    });
    act(() => {
      vi.advanceTimersByTime(250);
    });
    expect(screen.getByText("Focused second")).toBeInTheDocument();

    act(() => {
      region.blur();
    });
    act(() => {
      vi.advanceTimersByTime(3000);
    });
    act(() => {
      vi.advanceTimersByTime(250);
    });
    expect(screen.queryByText("Focused second")).not.toBeInTheDocument();
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
});
