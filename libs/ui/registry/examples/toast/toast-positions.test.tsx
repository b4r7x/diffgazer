import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import ToastPositions from "./toast-positions";

describe("ToastPositions", () => {
  it("gives the Toast positions example an accessible group name", () => {
    render(<ToastPositions />);

    expect(screen.getByRole("radiogroup", { name: "Toast position" })).toBeInTheDocument();
  });

  it("raises a toast into the example's own toaster after the corner changes", async () => {
    const user = userEvent.setup();
    render(<ToastPositions />);

    await user.click(screen.getByRole("radio", { name: "Top Left" }));
    await user.click(screen.getByRole("button", { name: "Show Toast" }));

    const region = screen.getByRole("region", { name: "Notifications" });
    expect(await within(region).findByText("Notification")).toBeInTheDocument();
  });
});
