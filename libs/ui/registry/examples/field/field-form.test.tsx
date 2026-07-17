import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import FieldForm from "./field-form";

describe("FieldForm", () => {
  it("uses custom blank-submit validation and recovers after valid input", async () => {
    const user = userEvent.setup();
    const { container } = render(<FieldForm />);
    const form = container.querySelector("form");
    const email = screen.getByRole("textbox", { name: "Email" });

    expect(form).toHaveAttribute("novalidate");

    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(email).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByRole("alert")).toHaveTextContent("Email is required.");

    await user.type(email, "dev@example.com");

    expect(email).not.toHaveAttribute("aria-invalid");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});
