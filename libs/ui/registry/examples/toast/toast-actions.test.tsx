import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Toaster, toast } from "@/components/ui/toast";
import ToastActions from "./toast-actions";

function renderToastActionsExample() {
  return render(
    <>
      <ToastActions />
      <Toaster />
    </>,
  );
}

describe("ToastActions", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    act(() => {
      toast.dismiss();
      vi.advanceTimersByTime(250);
    });
    vi.useRealTimers();
  });

  it("dismisses the action toast when its action is activated", () => {
    renderToastActionsExample();

    // fireEvent retained: fake timers drive toast removal; userEvent waits on the same timer queue.
    fireEvent.click(screen.getByRole("button", { name: "Show with Action" }));
    expect(screen.getByText("Review Submitted")).toBeInTheDocument();

    act(() => vi.advanceTimersByTime(5000));
    expect(screen.getByText("Review Submitted")).toBeInTheDocument();
    const dismiss = screen.getByRole("button", { name: "Dismiss" });
    dismiss.focus();
    expect(dismiss).toHaveFocus();

    // fireEvent retained: fake timers drive toast removal; userEvent waits on the same timer queue.
    fireEvent.click(dismiss);
    act(() => vi.advanceTimersByTime(250));

    expect(screen.queryByText("Review Submitted")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Dismiss" })).not.toBeInTheDocument();
  });

  it("keeps the custom-duration toast past the five-second default and dismisses it at eight seconds", () => {
    renderToastActionsExample();

    // fireEvent retained: fake timers drive toast removal; userEvent waits on the same timer queue.
    fireEvent.click(screen.getByRole("button", { name: "Show with Custom Duration (8s)" }));
    expect(screen.getByText("Analysis Complete")).toBeInTheDocument();

    act(() => vi.advanceTimersByTime(5000));
    expect(screen.getByText("Analysis Complete")).toBeInTheDocument();

    act(() => vi.advanceTimersByTime(3000));
    act(() => vi.advanceTimersByTime(250));
    expect(screen.queryByText("Analysis Complete")).not.toBeInTheDocument();
  });
});
