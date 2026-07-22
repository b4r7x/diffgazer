import { readFileSync } from "node:fs";
import { join } from "node:path";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import SearchInputKeyboard from "./search-input-keyboard";

const source = readFileSync(join(import.meta.dirname, "search-input-keyboard.tsx"), "utf-8");

describe("search-input-keyboard example copy contract", () => {
  it("imports keys helpers from the local copy-mode hook path, not the unpublished package", () => {
    expect(source).not.toContain('from "@diffgazer/keys"');
    expect(source).toContain('from "@/hooks/use-navigation"');
  });
});

describe("search-input-keyboard example", () => {
  it("clears the active descendant and selection on typing and on an empty-query Escape", async () => {
    const user = userEvent.setup();
    render(<SearchInputKeyboard />);
    const input = screen.getByRole("combobox", { name: "Search items..." });
    input.focus();

    await user.keyboard("{ArrowDown}");
    const componentsOption = screen.getByRole("option", { name: "Components" });
    expect(input).toHaveAttribute("aria-activedescendant", componentsOption.id);
    expect(componentsOption).toHaveAttribute("aria-selected", "true");

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
