import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type React from "react";
import { describe, expect, it, vi } from "vitest";
import TooltipInteractiveExample from "./tooltip-interactive";

describe("TooltipInteractiveExample", () => {
  it("does not submit a surrounding form when the Save render-prop button is clicked", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn((event: React.FormEvent<HTMLFormElement>) => event.preventDefault());

    render(
      <form onSubmit={onSubmit}>
        <TooltipInteractiveExample />
      </form>,
    );

    await user.click(screen.getByRole("button", { name: "save" }));

    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("reveals the tooltip on Tab and dismisses it with Escape without losing focus", async () => {
    const user = userEvent.setup();
    render(<TooltipInteractiveExample />);

    const save = screen.getByRole("button", { name: "save" });

    await user.tab();
    expect(save).toHaveFocus();
    expect(await screen.findByRole("tooltip", { name: "Save changes to disk" })).toBeVisible();

    await user.keyboard("{Escape}");

    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
    expect(save).toHaveFocus();
  });
});
