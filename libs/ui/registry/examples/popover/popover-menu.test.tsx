import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import PopoverMenu from "./popover-menu";

async function openMenu(user: ReturnType<typeof userEvent.setup>) {
  const trigger = screen.getByRole("button", { name: "Actions" });
  await user.click(trigger);
  const menu = await screen.findByRole("menu", { name: "Actions" });
  await waitFor(() => expect(menu).toHaveFocus());
  return { trigger, menu };
}

describe("popover-menu example", () => {
  it("runs an entry from its advertised hotkey, closes and returns focus to the trigger", async () => {
    const user = userEvent.setup();
    render(<PopoverMenu />);

    const { trigger } = await openMenu(user);
    expect(trigger).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("menuitem", { name: /Copy link/ })).toHaveTextContent("[c]");

    await user.keyboard("c");

    await waitFor(() => expect(screen.queryByRole("menu")).not.toBeInTheDocument());
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(trigger).toHaveFocus();
    expect(screen.getByText("Ran: Copy link")).toBeInTheDocument();
  });

  it("keeps a disabled entry listed with its reason and lets its key do nothing", async () => {
    const user = userEvent.setup();
    render(<PopoverMenu />);

    const { menu } = await openMenu(user);
    const archive = screen.getByRole("menuitem", { name: /Archive/ });
    expect(archive).toHaveAttribute("aria-disabled", "true");
    expect(archive).toHaveTextContent("Already archived");
    expect(archive).not.toHaveTextContent("[a]");

    await user.keyboard("a");
    await user.click(archive);

    expect(menu).toBeInTheDocument();
    expect(screen.getByText("Nothing run yet")).toBeInTheDocument();
  });

  it("puts the destructive entry last behind a divider and closes on Escape", async () => {
    const user = userEvent.setup();
    render(<PopoverMenu />);

    const { trigger } = await openMenu(user);
    const items = screen.getAllByRole("menuitem");
    const separator = screen.getByRole("separator");
    expect(items.at(-1)).toHaveAccessibleName("Delete");
    expect(items.at(-1)?.compareDocumentPosition(separator)).toBe(Node.DOCUMENT_POSITION_PRECEDING);

    await user.keyboard("{Escape}");

    await waitFor(() => expect(screen.queryByRole("menu")).not.toBeInTheDocument());
    expect(trigger).toHaveFocus();
  });
});
