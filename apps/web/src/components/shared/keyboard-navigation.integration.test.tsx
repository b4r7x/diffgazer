import { useRef, useState } from "react";
import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import {
  CheckboxGroup,
  CheckboxItem,
  Menu,
  MenuItem,
  RadioGroup,
  RadioGroupItem,
} from "@diffgazer/ui";
import { useNavigation, KeyboardProvider } from "@diffgazer/keyboard";

function CheckboxGroupWithKeyboard() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [value, setValue] = useState<string[]>([]);
  const [focused, setFocused] = useState<string | null>(null);

  const toggle = (v: string) => {
    setValue((prev) =>
      prev.includes(v) ? prev.filter((x) => x !== v) : [...prev, v]
    );
  };

  const { onKeyDown, focusedValue } = useNavigation({
    mode: "local",
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
      onValueChange={setValue}
      onKeyDown={onKeyDown}
      focusedValue={focusedValue}
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

  const { onKeyDown, focusedValue } = useNavigation({
    mode: "local",
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
      onValueChange={setValue}
      onKeyDown={onKeyDown}
      focusedValue={focusedValue}
    >
      <RadioGroupItem value="alpha" label="Alpha" />
      <RadioGroupItem value="beta" label="Beta" />
      <RadioGroupItem value="gamma" label="Gamma" />
    </RadioGroup>
  );
}

function MenuWithKeyboard({ onActivate }: { onActivate: (id: string) => void }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const handleActivate = (id: string) => {
    setSelectedId(id);
    onActivate(id);
  };

  const { onKeyDown, focusedValue } = useNavigation({
    mode: "local",
    containerRef,
    role: "option",
    value: selectedId,
    onValueChange: setSelectedId,
    onEnter: handleActivate,
  });

  return (
    <Menu
      ref={containerRef}
      selectedId={selectedId}
      focusedValue={focusedValue}
      onSelect={setSelectedId}
      onActivate={handleActivate}
      onKeyDown={onKeyDown}
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

    const listbox = screen.getByRole("listbox");

    fireEvent.keyDown(listbox, { key: "ArrowDown" });
    fireEvent.keyDown(listbox, { key: "Enter" });

    expect(activated).toEqual(["beta"]);
    expect(screen.getByText("Beta").closest('[role="option"]')?.getAttribute("aria-selected")).toBe("true");
  });
});
