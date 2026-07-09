import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import CalloutControlled from "./callout-controlled";

describe("callout-controlled example", () => {
  it("moves focus to the recovery button when dismissed via keyboard", async () => {
    const user = userEvent.setup();
    render(<CalloutControlled />);

    expect(screen.getByText("Controlled Callout")).toBeInTheDocument();

    await user.tab();
    expect(screen.getByRole("button", { name: "Dismiss" })).toHaveFocus();

    await user.keyboard("{Enter}");

    expect(screen.queryByText("Controlled Callout")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "[ show callout ]" })).toHaveFocus();
  });
});
