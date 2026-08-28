import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { axe } from "../../../testing/axe";
import { CommandPalette } from "./index";

describe("CommandPaletteContent embedded mode", () => {
  it("renders the open surface in the document flow without a dialog or focus steal", async () => {
    const user = userEvent.setup();
    render(
      <div>
        <button type="button">Outside</button>
        <CommandPalette open>
          <CommandPalette.Content modal={false} label="Embedded palette" frame="viewfinder">
            <CommandPalette.Input />
            <CommandPalette.List>
              <CommandPalette.Item id="copy">Copy</CommandPalette.Item>
              <CommandPalette.Item id="paste">Paste</CommandPalette.Item>
            </CommandPalette.List>
          </CommandPalette.Content>
        </CommandPalette>
      </div>,
    );

    const region = screen.getByRole("group", { name: "Embedded palette" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(region).toHaveAttribute("data-frame", "viewfinder");
    expect(region).toHaveAttribute("data-state", "open");
    expect(screen.getAllByRole("option")).toHaveLength(2);
    expect(document.body).toHaveFocus();

    // No focus trap: the surrounding page stays reachable.
    await user.tab();
    expect(screen.getByRole("button", { name: "Outside" })).toHaveFocus();
  });

  it("filters embedded items from the search input", async () => {
    const user = userEvent.setup();
    render(
      <CommandPalette open>
        <CommandPalette.Content modal={false} label="Embedded palette">
          <CommandPalette.Input />
          <CommandPalette.List>
            <CommandPalette.Item id="copy">Copy</CommandPalette.Item>
            <CommandPalette.Item id="paste">Paste</CommandPalette.Item>
            <CommandPalette.Empty>No results found</CommandPalette.Empty>
          </CommandPalette.List>
        </CommandPalette.Content>
      </CommandPalette>,
    );

    await user.type(screen.getByRole("combobox", { name: "Command search" }), "past");
    expect(screen.getAllByRole("option")).toHaveLength(1);
    expect(screen.getByRole("option")).toHaveAttribute("data-value", "paste");
  });

  it("unmounts the embedded surface when the consumer closes it", () => {
    const { rerender } = render(
      <CommandPalette open>
        <CommandPalette.Content modal={false} label="Embedded palette">
          <CommandPalette.Input />
          <CommandPalette.List>
            <CommandPalette.Item id="copy">Copy</CommandPalette.Item>
          </CommandPalette.List>
        </CommandPalette.Content>
      </CommandPalette>,
    );
    expect(screen.getByRole("group", { name: "Embedded palette" })).toBeInTheDocument();

    rerender(
      <CommandPalette open={false}>
        <CommandPalette.Content modal={false} label="Embedded palette">
          <CommandPalette.Input />
          <CommandPalette.List>
            <CommandPalette.Item id="copy">Copy</CommandPalette.Item>
          </CommandPalette.List>
        </CommandPalette.Content>
      </CommandPalette>,
    );
    expect(screen.queryByRole("group", { name: "Embedded palette" })).not.toBeInTheDocument();
  });

  it("has no a11y violations as a non-modal in-flow group", async () => {
    const { container } = render(
      <CommandPalette open>
        <CommandPalette.Content modal={false} label="Embedded palette">
          <CommandPalette.Input />
          <CommandPalette.List>
            <CommandPalette.Item id="copy">Copy</CommandPalette.Item>
            <CommandPalette.Item id="paste">Paste</CommandPalette.Item>
          </CommandPalette.List>
        </CommandPalette.Content>
      </CommandPalette>,
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});
