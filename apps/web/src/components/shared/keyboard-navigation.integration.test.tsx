import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import {
  CheckboxGroup,
  CheckboxItem,
  Menu,
  MenuItem,
  RadioGroup,
  RadioGroupItem,
} from "@stargazer/ui";

describe("UI keyboard navigation integration", () => {
  it("moves focus with ArrowDown and toggles focused checkbox with Space", () => {
    render(
      <CheckboxGroup defaultValue={[]}>
        <CheckboxItem value="alpha" label="Alpha" />
        <CheckboxItem value="beta" label="Beta" />
        <CheckboxItem value="gamma" label="Gamma" />
      </CheckboxGroup>
    );

    const group = screen.getByRole("group");
    const options = screen.getAllByRole("checkbox");
    expect(options[1]?.getAttribute("aria-checked")).toBe("false");

    fireEvent.keyDown(group, { key: "ArrowDown" });
    fireEvent.keyDown(group, { key: " " });

    expect(options[1]?.getAttribute("aria-checked")).toBe("true");
  });

  it("moves focus with ArrowDown and selects focused radio with Enter", () => {
    render(
      <RadioGroup defaultValue="alpha">
        <RadioGroupItem value="alpha" label="Alpha" />
        <RadioGroupItem value="beta" label="Beta" />
        <RadioGroupItem value="gamma" label="Gamma" />
      </RadioGroup>
    );

    const group = screen.getByRole("radiogroup");
    const options = screen.getAllByRole("radio");
    expect(options[0]?.getAttribute("aria-checked")).toBe("true");
    expect(options[1]?.getAttribute("aria-checked")).toBe("false");

    fireEvent.keyDown(group, { key: "ArrowDown" });
    fireEvent.keyDown(group, { key: "Enter" });

    expect(options[0]?.getAttribute("aria-checked")).toBe("false");
    expect(options[1]?.getAttribute("aria-checked")).toBe("true");
  });

  it("handles ArrowDown and Enter for Menu via local onKeyDown", () => {
    const activated: string[] = [];

    render(
      <Menu
        defaultIndex={0}
        onActivate={(item) => activated.push(item.id)}
      >
        <MenuItem id="alpha">Alpha</MenuItem>
        <MenuItem id="beta">Beta</MenuItem>
        <MenuItem id="gamma">Gamma</MenuItem>
      </Menu>
    );

    const listbox = screen.getByRole("listbox");

    fireEvent.keyDown(listbox, { key: "ArrowDown" });
    fireEvent.keyDown(listbox, { key: "Enter" });

    expect(activated).toEqual(["beta"]);
    expect(screen.getByText("Beta").closest('[role="option"]')?.getAttribute("aria-selected")).toBe("true");
  });
});
