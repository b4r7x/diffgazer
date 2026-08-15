import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import ButtonHighlightedExample from "./button-highlighted";

describe("button highlighted example", () => {
  it("moves the highlight to whichever button owns focus", async () => {
    const user = userEvent.setup();
    render(<ButtonHighlightedExample />);

    const review = screen.getByRole("button", { name: "Review" });
    const rerun = screen.getByRole("button", { name: "Rerun" });
    const discard = screen.getByRole("button", { name: "Discard" });

    expect(rerun).toHaveAttribute("data-highlighted");

    await user.tab();
    expect(review).toHaveFocus();
    expect(review).toHaveAttribute("data-highlighted");
    expect(rerun).not.toHaveAttribute("data-highlighted");

    await user.tab();
    expect(rerun).toHaveFocus();
    expect(rerun).toHaveAttribute("data-highlighted");
    expect(review).not.toHaveAttribute("data-highlighted");

    await user.tab();
    expect(discard).toHaveFocus();
    expect(discard).toHaveAttribute("data-highlighted");
    expect(rerun).not.toHaveAttribute("data-highlighted");
  });
});
