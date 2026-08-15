import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { describe, expect, it } from "vitest";
import { axe } from "../../../testing/axe";
import { CommandPalette } from "./index";

function getCount(): HTMLElement {
  const node = document.querySelector('[data-slot="command-palette-count"]');
  if (node === null) throw new Error("count readout not rendered");
  return node as HTMLElement;
}

function renderPalette(props: { suffix?: ReactNode } = {}) {
  return render(
    <CommandPalette open>
      <CommandPalette.Content>
        <CommandPalette.Input suffix={props.suffix} />
        <CommandPalette.List>
          <CommandPalette.Item id="copy">Copy</CommandPalette.Item>
          <CommandPalette.Item id="paste">Paste</CommandPalette.Item>
          <CommandPalette.Item id="delete">Delete</CommandPalette.Item>
        </CommandPalette.List>
        <CommandPalette.Empty>No results found</CommandPalette.Empty>
      </CommandPalette.Content>
    </CommandPalette>,
  );
}

describe("CommandPalette.Count", () => {
  it("shows the highlighted position over the filtered total", async () => {
    const user = userEvent.setup();
    renderPalette();

    expect(getCount()).toHaveTextContent("[1/3]");

    await user.keyboard("{ArrowDown}");
    expect(getCount()).toHaveTextContent("[2/3]");

    await user.keyboard("{ArrowUp}");
    expect(getCount()).toHaveTextContent("[1/3]");
  });

  it("tracks the filtered total as the user types", async () => {
    const user = userEvent.setup();
    renderPalette();

    await user.type(screen.getByRole("combobox"), "p");
    await waitFor(() => expect(getCount()).toHaveTextContent("[1/2]"));
  });

  it("marks a zero-match filter and reports no results", async () => {
    const user = userEvent.setup();
    renderPalette();

    await user.type(screen.getByRole("combobox"), "zzz");

    await waitFor(() => expect(getCount()).toHaveTextContent("[0]"));
    expect(getCount()).toHaveAttribute("data-empty");
    expect(screen.getByText("No results found")).toBeInTheDocument();
  });

  it("leaves the announcement to the existing live region", async () => {
    const user = userEvent.setup();
    const { container } = renderPalette();

    await user.type(screen.getByRole("combobox"), "p");

    expect(getCount()).toHaveAttribute("aria-hidden", "true");
    // Exactly one announcement: the polite status region, never the readout.
    const announcements = container.ownerDocument.querySelectorAll('[aria-live="polite"]');
    expect(announcements).toHaveLength(1);
    expect(announcements[0]).toHaveTextContent("2 results available");
  });

  it("updates a re-registered item in place instead of dropping or duplicating it", async () => {
    function Palette({ label }: { label: string }) {
      return (
        <CommandPalette open>
          <CommandPalette.Content>
            <CommandPalette.Input />
            <CommandPalette.List>
              <CommandPalette.Item id="copy" value={label}>
                {label}
              </CommandPalette.Item>
              <CommandPalette.Item id="paste">Paste</CommandPalette.Item>
            </CommandPalette.List>
            <CommandPalette.Empty>No results found</CommandPalette.Empty>
          </CommandPalette.Content>
        </CommandPalette>
      );
    }

    const user = userEvent.setup();
    const { rerender } = render(<Palette label="Copy" />);
    await waitFor(() => expect(getCount()).toHaveTextContent("[1/2]"));

    rerender(<Palette label="Duplicate" />);

    // Same registration id, new searchable value: the row keeps its single slot
    // and the new value is what the filter matches.
    await waitFor(() => expect(getCount()).toHaveTextContent("[1/2]"));
    await user.type(screen.getByRole("combobox"), "Dup");
    await waitFor(() => expect(getCount()).toHaveTextContent("[1/1]"));
    expect(screen.getByRole("option", { name: "Duplicate" })).toBeInTheDocument();
  });

  it("counts disabled visible rows and reads their position in the rendered list", () => {
    render(
      <CommandPalette open>
        <CommandPalette.Content>
          <CommandPalette.Input />
          <CommandPalette.List>
            <CommandPalette.Item id="nope" disabled>
              Nope
            </CommandPalette.Item>
            <CommandPalette.Item id="paste">Paste</CommandPalette.Item>
          </CommandPalette.List>
          <CommandPalette.Empty>No results found</CommandPalette.Empty>
        </CommandPalette.Content>
      </CommandPalette>,
    );

    // Both rows are on screen; the highlight lands on the second one because the
    // first is disabled, so the readout names it as row two of two.
    expect(screen.getAllByRole("option")).toHaveLength(2);
    expect(screen.getByRole("option", { name: "Paste" })).toHaveAttribute("aria-selected", "true");
    expect(getCount()).toHaveTextContent("[2/2]");
  });

  it("keeps the empty state and the announcement away from a visible disabled match", async () => {
    const user = userEvent.setup();
    render(
      <CommandPalette open>
        <CommandPalette.Content>
          <CommandPalette.Input />
          <CommandPalette.List>
            <CommandPalette.Item id="nope" disabled>
              Nope
            </CommandPalette.Item>
            <CommandPalette.Item id="paste">Paste</CommandPalette.Item>
          </CommandPalette.List>
          <CommandPalette.Empty>No results found</CommandPalette.Empty>
        </CommandPalette.Content>
      </CommandPalette>,
    );

    await user.type(screen.getByRole("combobox"), "nope");

    await waitFor(() => expect(screen.getAllByRole("option")).toHaveLength(1));
    expect(screen.queryByText("No results found")).not.toBeInTheDocument();
    expect(document.querySelector('[aria-live="polite"]')).toHaveTextContent("1 result available");
    expect(getCount()).toHaveTextContent("[1]");
  });

  it("steps aside for a consumer-supplied input suffix", () => {
    renderPalette({ suffix: <span>custom</span> });

    expect(document.querySelector('[data-slot="command-palette-count"]')).toBeNull();
    expect(screen.getByText("custom")).toBeInTheDocument();
  });

  it("has no axe violations alongside the readout", async () => {
    const { container } = renderPalette();
    expect(await axe(container)).toHaveNoViolations();
  });
});
