import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import FloatingPanelCollisionExample from "./floating-panel-collision";

describe("FloatingPanelCollisionExample", () => {
  it.each([
    "left",
    "right",
  ])("moves focus into the %s-edge dialog and restores it after Escape", async (side) => {
    const user = userEvent.setup();
    render(<FloatingPanelCollisionExample />);

    const trigger = screen.getByRole("button", { name: `open ${side}-edge panel` });
    await user.click(trigger);

    expect(await screen.findByRole("dialog", { name: "Collision handling" })).toBeVisible();
    const closeButton = screen.getByRole("button", { name: "close panel" });
    await waitFor(() => expect(closeButton).toHaveFocus());

    await user.keyboard("{Escape}");

    expect(screen.queryByRole("dialog", { name: "Collision handling" })).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
    expect(trigger).toHaveAttribute("aria-expanded", "false");
  });

  it("returns focus to the close control when reopened during retained exit", async () => {
    const user = userEvent.setup();
    render(<FloatingPanelCollisionExample />);

    const trigger = screen.getByRole("button", { name: "open left-edge panel" });
    await user.click(trigger);

    const dialog = await screen.findByRole("dialog", { name: "Collision handling" });
    const closeButton = screen.getByRole("button", { name: "close panel" });
    await waitFor(() => expect(closeButton).toHaveFocus());

    const originalGetComputedStyle = window.getComputedStyle;
    const getComputedStyle = vi.spyOn(window, "getComputedStyle").mockImplementation((element) => {
      const style = originalGetComputedStyle(element);
      if (element !== dialog) return style;
      return new Proxy(style, {
        get(current, property, receiver) {
          if (property === "animationName") return "panel-exit";
          return Reflect.get(current, property, receiver);
        },
      });
    });

    try {
      await user.keyboard("{Escape}");
      expect(dialog).toHaveAttribute("data-state", "closed");
      expect(dialog).toBeInTheDocument();
      expect(trigger).toHaveFocus();

      await user.click(trigger);

      expect(dialog).toHaveAttribute("data-state", "open");
      expect(closeButton).toBeVisible();
      await waitFor(() => expect(closeButton).toHaveFocus());
    } finally {
      getComputedStyle.mockRestore();
    }
  });
});
