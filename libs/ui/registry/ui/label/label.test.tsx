import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { axe } from "../../../testing/axe";
import { Input } from "../input/index";
import { Label } from "./index";

describe("Label", () => {
  it("labels and focuses an external control through htmlFor", async () => {
    render(
      <>
        <Label htmlFor="email">Email</Label>
        <Input id="email" />
      </>,
    );

    await userEvent.click(screen.getByText("Email"));

    expect(screen.getByLabelText("Email")).toHaveFocus();
  });

  it("labels a wrapped control without adding the required marker to its accessible name", () => {
    render(
      <Label label="Name" required>
        <Input />
      </Label>,
    );

    expect(screen.getByRole("textbox", { name: "Name" })).toBeInTheDocument();
  });

  it("has no a11y violations", async () => {
    const { container } = render(
      <Label label="Name" required>
        <Input />
      </Label>,
    );

    expect(await axe(container)).toHaveNoViolations();
  });
});
