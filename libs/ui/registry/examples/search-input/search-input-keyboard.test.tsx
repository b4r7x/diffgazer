import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import SearchInputKeyboard from "./search-input-keyboard";

describe("search-input-keyboard example", () => {
  it("starts on the seeded highlight so the keyboard state is visible before any key press", () => {
    render(<SearchInputKeyboard />);
    const input = screen.getByRole("combobox", { name: "Search items..." });
    const hooksOption = screen.getByRole("option", { name: "Hooks" });

    expect(input).toHaveAttribute("aria-activedescendant", hooksOption.id);
    expect(hooksOption).toHaveAttribute("aria-selected", "true");
  });

  it("keeps unique listbox and option ids when two instances mount", () => {
    render(
      <>
        <SearchInputKeyboard />
        <SearchInputKeyboard />
      </>,
    );

    const inputs = screen.getAllByRole("combobox", { name: "Search items..." });
    const listboxes = screen.getAllByRole("listbox");
    const hooksOptions = screen.getAllByRole("option", { name: "Hooks" });

    expect(inputs).toHaveLength(2);
    expect(listboxes).toHaveLength(2);
    expect(hooksOptions).toHaveLength(2);

    const [firstInput, secondInput] = inputs;
    const [firstListbox, secondListbox] = listboxes;
    const [firstHooksOption, secondHooksOption] = hooksOptions;
    if (
      !firstInput ||
      !secondInput ||
      !firstListbox ||
      !secondListbox ||
      !firstHooksOption ||
      !secondHooksOption
    ) {
      throw new Error("expected two mounted instances");
    }

    expect(firstListbox.id).not.toBe(secondListbox.id);
    expect(firstInput).toHaveAttribute("aria-controls", firstListbox.id);
    expect(secondInput).toHaveAttribute("aria-controls", secondListbox.id);
    expect(firstHooksOption.id).not.toBe(secondHooksOption.id);
    expect(firstInput).toHaveAttribute("aria-activedescendant", firstHooksOption.id);
    expect(secondInput).toHaveAttribute("aria-activedescendant", secondHooksOption.id);
  });

  it("inserts a space character on Space instead of selecting the highlight", async () => {
    const user = userEvent.setup();
    render(<SearchInputKeyboard />);
    const input = screen.getByRole("combobox", { name: "Search items..." });
    input.focus();

    await user.keyboard(" ");
    expect(input).toHaveValue(" ");
  });

  it("commits the seeded highlight on Enter", async () => {
    const user = userEvent.setup();
    render(<SearchInputKeyboard />);
    const input = screen.getByRole("combobox", { name: "Search items..." });
    input.focus();

    await user.keyboard("{Enter}");
    expect(input).toHaveValue("Hooks");
  });

  it("clears the active descendant and selection on typing and on an empty-query Escape", async () => {
    const user = userEvent.setup();
    render(<SearchInputKeyboard />);
    const input = screen.getByRole("combobox", { name: "Search items..." });
    const componentsOption = screen.getByRole("option", { name: "Components" });
    input.focus();

    await user.keyboard("{ArrowDown}");
    const utilitiesOption = screen.getByRole("option", { name: "Utilities" });
    expect(input).toHaveAttribute("aria-activedescendant", utilitiesOption.id);
    expect(utilitiesOption).toHaveAttribute("aria-selected", "true");

    await user.keyboard("o");
    expect(input).not.toHaveAttribute("aria-activedescendant");
    expect(componentsOption).toHaveAttribute("aria-selected", "false");

    await user.clear(input);
    await user.keyboard("{ArrowDown}");
    expect(input).toHaveAttribute("aria-activedescendant", componentsOption.id);

    await user.keyboard("{Escape}");
    expect(input).not.toHaveAttribute("aria-activedescendant");
    expect(componentsOption).toHaveAttribute("aria-selected", "false");
  });
});
