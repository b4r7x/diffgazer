import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { axe } from "../../../testing/axe";
import ControllableStateToggle from "./controllable-state-toggle";

describe("ControllableStateToggle", () => {
  it("keeps each switch name stable while aria-checked reflects state", async () => {
    const user = userEvent.setup();
    const { container } = render(<ControllableStateToggle />);

    const notifications = screen.getByRole("switch", { name: "Notifications" });
    const darkMode = screen.getByRole("switch", { name: "Dark mode" });

    expect(notifications).toHaveAttribute("aria-checked", "false");
    expect(darkMode).toHaveAttribute("aria-checked", "false");

    await user.click(notifications);
    expect(notifications).toHaveAttribute("aria-checked", "true");
    expect(screen.getByRole("switch", { name: "Notifications" })).toBe(notifications);

    await user.click(darkMode);
    expect(darkMode).toHaveAttribute("aria-checked", "true");
    expect(screen.getByRole("switch", { name: "Dark mode" })).toBe(darkMode);
    expect(screen.getByText("Controlled: on")).toBeInTheDocument();

    expect(await axe(container)).toHaveNoViolations();
  });
});
