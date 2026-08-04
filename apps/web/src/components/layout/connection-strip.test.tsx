import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ConnectionStrip } from "@/components/layout/connection-strip";

describe("ConnectionStrip", () => {
  it("announces the outage and retries on demand", async () => {
    const user = userEvent.setup();
    const onRetry = vi.fn();
    render(<ConnectionStrip state="offline" onRetry={onRetry} />);

    expect(screen.getByRole("status")).toHaveTextContent(/server not responding/i);

    await user.click(screen.getByRole("button", { name: /retry/i }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("keeps focus on the busy retry button while reconnecting", async () => {
    const user = userEvent.setup();
    const onRetry = vi.fn();
    const { rerender } = render(<ConnectionStrip state="offline" onRetry={onRetry} />);

    const retry = screen.getByRole("button", { name: /retry/i });
    await user.click(retry);
    expect(retry).toHaveFocus();

    rerender(<ConnectionStrip state="retrying" onRetry={onRetry} />);

    // The transient busy state must not blur the keyboard user: the button stays
    // focusable (aria-disabled) instead of turning natively disabled.
    expect(screen.getByRole("status")).toHaveTextContent(/reconnecting/i);
    expect(retry).toHaveFocus();
    expect(retry).not.toBeDisabled();
    expect(retry).toHaveAttribute("aria-disabled", "true");
    expect(retry).toHaveAttribute("aria-busy", "true");

    await user.click(retry);
    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});
