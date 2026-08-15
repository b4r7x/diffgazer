import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import UsePresenceBasicExample from "./use-presence-basic";

describe("use-presence-basic example", () => {
  it("unmounts the panel as soon as it closes when no exit animation runs", async () => {
    const user = userEvent.setup();
    render(<UsePresenceBasicExample />);

    await user.click(screen.getByRole("button", { name: "Show" }));
    expect(screen.getByText("Animated content")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Hide" }));

    // The animated element is passed to usePresence by ref, so an exit with no
    // resolved animation (reduced motion) completes without the fallback timer.
    expect(screen.queryByText("Animated content")).not.toBeInTheDocument();
  });
});
