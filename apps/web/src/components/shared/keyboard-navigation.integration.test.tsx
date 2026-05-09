import { useRef, useState } from "react";
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CheckboxGroup, CheckboxItem } from "@diffgazer/ui/components/checkbox";
import { Menu, MenuItem } from "@diffgazer/ui/components/menu";
import { RadioGroup, RadioGroupItem } from "@diffgazer/ui/components/radio";
import { useNavigation, KeyboardProvider } from "@diffgazer/keys";

function CheckboxGroupWithKeyboard() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [value, setValue] = useState<string[]>([]);
  const [focused, setFocused] = useState<string | null>(null);

  const toggle = (v: string) => {
    setValue((prev) =>
      prev.includes(v) ? prev.filter((x) => x !== v) : [...prev, v]
    );
  };

  const { onKeyDown, highlighted: focusedValue } = useNavigation({
    containerRef,
    role: "checkbox",
    value: focused,
    onValueChange: setFocused,
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
      highlighted={focusedValue}
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

  const { onKeyDown, highlighted: focusedValue } = useNavigation({
    containerRef,
    role: "radio",
    value,
    onValueChange: setValue,
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
      highlighted={focusedValue}
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
  it("moves focus with ArrowDown and toggles focused checkbox with Space", async () => {
    const user = userEvent.setup();
    render(<KeyboardProvider><CheckboxGroupWithKeyboard /></KeyboardProvider>);

    const options = screen.getAllByRole("checkbox");
    expect(options[0]?.getAttribute("aria-checked")).toBe("false");

    await user.tab();
    await user.keyboard("{ArrowDown} ");

    expect(options[0]?.getAttribute("aria-checked")).toBe("true");
  });

  it("moves focus with ArrowDown and selects focused radio with Enter", async () => {
    const user = userEvent.setup();
    render(<KeyboardProvider><RadioGroupWithKeyboard /></KeyboardProvider>);

    const options = screen.getAllByRole("radio");
    expect(options[0]?.getAttribute("aria-checked")).toBe("true");
    expect(options[1]?.getAttribute("aria-checked")).toBe("false");

    await user.tab();
    await user.keyboard("{ArrowDown}{Enter}");

    expect(options[0]?.getAttribute("aria-checked")).toBe("false");
    expect(options[1]?.getAttribute("aria-checked")).toBe("true");
  });

  it("handles ArrowDown and Enter for Menu via onKeyDown", async () => {
    const user = userEvent.setup();
    const activated: string[] = [];

    render(
      <KeyboardProvider><MenuWithKeyboard onActivate={(id) => activated.push(id)} /></KeyboardProvider>
    );

    const listbox = screen.getByRole("menu");

    listbox.focus();
    await user.keyboard("{ArrowDown}{Enter}");

    expect(activated).toEqual(["alpha"]);
    expect(screen.getByText("Alpha").closest('[role="menuitem"]')?.getAttribute("data-active")).toBe("true");
    expect(screen.getByText("Beta").closest('[role="menuitem"]')).not.toHaveAttribute("data-active");
  });

  it("keeps keyboard focus when a different Menu item is hovered", async () => {
    const user = userEvent.setup();
    render(
      <KeyboardProvider><MenuWithKeyboard onActivate={() => {}} /></KeyboardProvider>
    );

    const menu = screen.getByRole("menu");
    const alpha = screen.getByText("Alpha").closest('[role="menuitem"]')!;
    const beta = screen.getByText("Beta").closest('[role="menuitem"]')!;

    menu.focus();
    await user.keyboard("{ArrowDown}");
    expect(menu).toHaveAttribute("aria-activedescendant", alpha.id);

    await user.hover(beta);
    expect(menu).toHaveAttribute("aria-activedescendant", alpha.id);
  });
});
