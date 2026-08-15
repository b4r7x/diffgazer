import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import UsePresenceTooltipExample from "./use-presence-tooltip";

describe("use-presence-tooltip example", () => {
  it("drops the tooltip and its aria-describedby as soon as the trigger blurs", async () => {
    const user = userEvent.setup();
    render(<UsePresenceTooltipExample />);

    const trigger = screen.getByRole("button", { name: "Hover me" });
    await user.tab();
    expect(trigger).toHaveFocus();
    expect(screen.getByRole("tooltip")).toBeInTheDocument();
    expect(trigger).toHaveAttribute("aria-describedby");

    await user.tab();

    // The tooltip is passed to usePresence by ref, so an exit with no resolved
    // animation (reduced motion) completes without the fallback timer.
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
    expect(trigger).not.toHaveAttribute("aria-describedby");
  });
});
