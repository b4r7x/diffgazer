import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import CheckboxVariants from "./checkbox-variants";

describe("checkbox-variants example", () => {
  it("toggles the variant gallery checkboxes on click and Space", async () => {
    const user = userEvent.setup();
    render(<CheckboxVariants />);

    const xVariant = screen.getByRole("checkbox", { name: "Variant: x (default)" });
    expect(xVariant).toHaveAttribute("aria-checked", "true");
    await user.click(xVariant);
    expect(xVariant).toHaveAttribute("aria-checked", "false");
    xVariant.focus();
    await user.keyboard(" ");
    expect(xVariant).toHaveAttribute("aria-checked", "true");

    const indeterminate = screen.getByRole("checkbox", { name: "Indeterminate state" });
    expect(indeterminate).toHaveAttribute("aria-checked", "mixed");
    await user.click(indeterminate);
    expect(indeterminate).toHaveAttribute("aria-checked", "true");
  });
});
