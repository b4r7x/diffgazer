import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import SelectSearchable from "./select-searchable";

describe("SelectSearchable", () => {
  it("shows the empty state when the bottom search has no matches", async () => {
    const user = userEvent.setup();
    render(<SelectSearchable />);

    await user.click(screen.getByRole("button", { name: "Command" }));
    await user.type(screen.getByRole("combobox", { name: "Search options" }), "checkout");

    expect(screen.queryAllByRole("option")).toHaveLength(0);
    expect(screen.getByText("> no results.")).toBeVisible();
  });
});
