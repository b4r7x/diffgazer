import { useRef, useState } from "react";
import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
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
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const handleSelect = (id: string) => {
    setSelectedId(id);
    onActivate(id);
  };

  return (
    <Menu
      selectedId={selectedId}
      onSelect={handleSelect}
    >
      <MenuItem id="alpha">Alpha</MenuItem>
      <MenuItem id="beta">Beta</MenuItem>
      <MenuItem id="gamma">Gamma</MenuItem>
    </Menu>
  );
}

describe("UI keyboard navigation integration", () => {
  it("moves focus with ArrowDown and toggles focused checkbox with Space", () => {
    render(<KeyboardProvider><CheckboxGroupWithKeyboard /></KeyboardProvider>);

    const group = screen.getByRole("group");
    const options = screen.getAllByRole("checkbox");
    expect(options[1]?.getAttribute("aria-checked")).toBe("false");

    fireEvent.keyDown(group, { key: "ArrowDown" });
    fireEvent.keyDown(group, { key: " " });

    expect(options[1]?.getAttribute("aria-checked")).toBe("true");
  });

  it("moves focus with ArrowDown and selects focused radio with Enter", () => {
    render(<KeyboardProvider><RadioGroupWithKeyboard /></KeyboardProvider>);

    const group = screen.getByRole("radiogroup");
    const options = screen.getAllByRole("radio");
    expect(options[0]?.getAttribute("aria-checked")).toBe("true");
    expect(options[1]?.getAttribute("aria-checked")).toBe("false");

    fireEvent.keyDown(group, { key: "ArrowDown" });
    fireEvent.keyDown(group, { key: "Enter" });

    expect(options[0]?.getAttribute("aria-checked")).toBe("false");
    expect(options[1]?.getAttribute("aria-checked")).toBe("true");
  });

  it("handles ArrowDown and Enter for Menu via onKeyDown", () => {
    const activated: string[] = [];

    render(
      <KeyboardProvider><MenuWithKeyboard onActivate={(id) => activated.push(id)} /></KeyboardProvider>
    );

    const listbox = screen.getByRole("menu");

    fireEvent.keyDown(listbox, { key: "ArrowDown" });
    fireEvent.keyDown(listbox, { key: "Enter" });

    expect(activated).toEqual(["beta"]);
    expect(screen.getByText("Beta").closest('[role="menuitem"]')?.getAttribute("aria-current")).toBe("true");
  });
});
