import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { toast } from "@/components/ui/toast";
import ToastActions from "./toast-actions";

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
    render(<ToastActions />);

    // fireEvent retained: fake timers drive toast removal; userEvent waits on the same timer queue.
    fireEvent.click(screen.getByRole("button", { name: "Show with Action" }));
    expect(screen.getByText("Review Submitted")).toBeInTheDocument();

    // fireEvent retained: fake timers drive toast removal; userEvent waits on the same timer queue.
    fireEvent.click(screen.getByRole("button", { name: "Dismiss" }));
    act(() => vi.advanceTimersByTime(250));

    expect(screen.queryByText("Review Submitted")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Dismiss" })).not.toBeInTheDocument();
  });

  it("keeps the custom-duration toast past the five-second default and dismisses it at eight seconds", () => {
    render(<ToastActions />);

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
