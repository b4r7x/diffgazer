import { useRef, useState } from "react";
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { KeyboardProvider, useNavigation } from "@diffgazer/keys";
import { CheckboxGroup, CheckboxItem } from "./checkbox";
import { Menu, MenuItem } from "./menu";
import { RadioGroup, RadioGroupItem } from "./radio";

function CheckboxGroupWithKeyboard() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [value, setValue] = useState<string[]>([]);
  const [focused, setFocused] = useState<string | null>(null);

  const toggle = (nextValue: string) => {
    setValue((current) =>
      current.includes(nextValue)
        ? current.filter((item) => item !== nextValue)
        : [...current, nextValue]
    );
  };

  const { onKeyDown, highlighted } = useNavigation({
    containerRef,
    role: "checkbox",
    highlighted: focused,
    onHighlightChange: setFocused,
    onSelect: toggle,
    onEnter: toggle,
  });

  return (
    <CheckboxGroup
      ref={containerRef}
      tabIndex={0}
      value={value}
      onChange={setValue}
      onKeyDown={onKeyDown}
      highlighted={highlighted}
    >
      <CheckboxItem value="alpha" label="Alpha" />
      <CheckboxItem value="beta" label="Beta" />
      <CheckboxItem value="gamma" label="Gamma" />
    </CheckboxGroup>
  );
}

function RadioGroupWithKeyboard() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [value, setValue] = useState("alpha");

  const { onKeyDown, highlighted } = useNavigation({
    containerRef,
    role: "radio",
    highlighted: value,
    onHighlightChange: setValue,
    onSelect: setValue,
    onEnter: setValue,
  });

  return (
    <RadioGroup
      ref={containerRef}
      tabIndex={0}
      value={value}
      onChange={setValue}
      onKeyDown={onKeyDown}
      highlighted={highlighted}
    >
      <RadioGroupItem value="alpha" label="Alpha" />
      <RadioGroupItem value="beta" label="Beta" />
      <RadioGroupItem value="gamma" label="Gamma" />
    </RadioGroup>
  );
}

function MenuWithKeyboard({ onActivate }: { onActivate: (id: string) => void }) {
  return (
    <Menu onSelect={onActivate}>
      <MenuItem id="alpha">Alpha</MenuItem>
      <MenuItem id="beta">Beta</MenuItem>
      <MenuItem id="gamma">Gamma</MenuItem>
    </Menu>
  );
}

describe("UI keyboard navigation integration", () => {
  it("moves focus with ArrowDown and toggles the focused checkbox with Space", async () => {
    const user = userEvent.setup();
    render(<KeyboardProvider><CheckboxGroupWithKeyboard /></KeyboardProvider>);

    const options = screen.getAllByRole("checkbox");
    expect(options[0]).toHaveAttribute("aria-checked", "false");

    await user.tab();
    await user.keyboard("{ArrowDown} ");

    expect(options[0]).toHaveAttribute("aria-checked", "true");
  });

  it("moves focus with ArrowDown and selects the focused radio with Enter", async () => {
    const user = userEvent.setup();
    render(<KeyboardProvider><RadioGroupWithKeyboard /></KeyboardProvider>);

    const options = screen.getAllByRole("radio");
    expect(options[0]).toHaveAttribute("aria-checked", "true");
    expect(options[1]).toHaveAttribute("aria-checked", "false");

    await user.tab();
    await user.keyboard("{ArrowDown}{Enter}");

    expect(options[0]).toHaveAttribute("aria-checked", "false");
    expect(options[1]).toHaveAttribute("aria-checked", "true");
  });

  it("handles ArrowDown and Enter for menu activation", async () => {
    const user = userEvent.setup();
    const activated: string[] = [];

    render(
      <KeyboardProvider>
        <MenuWithKeyboard onActivate={(id) => activated.push(id)} />
      </KeyboardProvider>
    );

    const menu = screen.getByRole("menu");
    menu.focus();
    await user.keyboard("{ArrowDown}{Enter}");

    expect(activated).toEqual(["alpha"]);
    expect(screen.getByRole("menuitem", { name: "Alpha" })).toHaveAttribute("data-active", "true");
    expect(screen.getByRole("menuitem", { name: "Beta" })).not.toHaveAttribute("data-active");
  });

  it("keeps keyboard focus when a different menu item is hovered", async () => {
    const user = userEvent.setup();
    render(
      <KeyboardProvider>
        <MenuWithKeyboard onActivate={() => {}} />
      </KeyboardProvider>
    );

    const menu = screen.getByRole("menu");
    const alpha = screen.getByRole("menuitem", { name: "Alpha" });
    const beta = screen.getByRole("menuitem", { name: "Beta" });

    menu.focus();
    await user.keyboard("{ArrowDown}");
    expect(menu).toHaveAttribute("aria-activedescendant", alpha.id);

    await user.hover(beta);
    expect(menu).toHaveAttribute("aria-activedescendant", alpha.id);
  });
});
