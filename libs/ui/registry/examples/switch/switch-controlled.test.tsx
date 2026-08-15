import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import SwitchControlled from "./switch-controlled";

describe("switch controlled example", () => {
  it("names the switch with its visible label and toggles when that label is clicked", async () => {
    const user = userEvent.setup();
    render(<SwitchControlled />);

    const control = screen.getByRole("switch", { name: "Review notifications" });
    expect(control).toBeChecked();
    expect(screen.getByText("Delivered when a review finishes.")).toBeInTheDocument();

    await user.click(screen.getByText("Review notifications"));

    expect(control).not.toBeChecked();
    expect(screen.getByText("No notifications are sent.")).toBeInTheDocument();
  });
});
