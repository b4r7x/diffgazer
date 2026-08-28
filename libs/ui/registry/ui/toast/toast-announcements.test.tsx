import { act, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Toaster, toast } from "./index";
import { applyToastTestEnvironment } from "./toast-test-utils";

describe("Toast announcements", () => {
  applyToastTestEnvironment();

  it("renders role=alert for tone=error via the imperative options form", () => {
    render(<Toaster />);
    act(() => {
      toast("Boom", { tone: "error" });
    });
    expect(screen.getByRole("alert")).toHaveTextContent("Boom");
  });

  it("announces new non-error toasts through a persistent polite live region", () => {
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

  it("announces an error hud toast politely because it renders no role=alert", () => {
    const { container } = render(<Toaster />);
    const announcer = container.querySelector('[data-slot="toast-announcer"]');

    act(() => {
      toast("Failed to copy", { tone: "error", variant: "hud" });
    });

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(announcer?.textContent).toBe("Failed to copy");
  });

  it("renders localized dismiss and tone labels", () => {
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

  it("names the toast region with a localized label", () => {
    render(<Toaster label="Benachrichtigungen" />);

    expect(screen.getByRole("region", { name: "Benachrichtigungen" })).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Notifications" })).not.toBeInTheDocument();
  });
});
