import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import SidebarVariants from "./sidebar-variants";

describe("sidebar-variants example", () => {
  it("applies the variant picked in the toggle group to the rendered sidebar", async () => {
    const user = userEvent.setup();
    render(<SidebarVariants />);

    expect(screen.getByRole("navigation")).toHaveAttribute("data-variant", "caret");

    await user.click(screen.getByRole("radio", { name: "tree" }));

    expect(screen.getByRole("navigation")).toHaveAttribute("data-variant", "tree");
  });
});
