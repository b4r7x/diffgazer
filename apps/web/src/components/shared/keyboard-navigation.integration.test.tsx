import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import type { ReactNode } from "react";
import {
  CheckboxGroup,
  CheckboxItem,
  Menu,
  MenuItem,
  RadioGroup,
  RadioGroupItem,
} from "@stargazer/ui";
import { KeyboardProvider, useScope } from "@stargazer/keyboard";

function ScopedKeyboard({ children }: { children: ReactNode }) {
  useScope("test-scope");
  return <>{children}</>;
}

describe("UI keyboard navigation integration", () => {
  it("moves focus with ArrowDown and toggles focused checkbox with Space", () => {
    render(
      <KeyboardProvider>
        <ScopedKeyboard>
          <CheckboxGroup defaultValue={[]}>
            <CheckboxItem value="alpha" label="Alpha" />
            <CheckboxItem value="beta" label="Beta" />
            <CheckboxItem value="gamma" label="Gamma" />
          </CheckboxGroup>
        </ScopedKeyboard>
      </KeyboardProvider>
    );

    const options = screen.getAllByRole("checkbox");
    expect(options[1]?.getAttribute("aria-checked")).toBe("false");

    fireEvent.keyDown(window, { key: "ArrowDown" });
    fireEvent.keyDown(window, { key: " " });

    expect(options[1]?.getAttribute("aria-checked")).toBe("true");
  });

  it("moves focus with ArrowDown and selects focused radio with Enter", () => {
    render(
      <KeyboardProvider>
        <ScopedKeyboard>
          <RadioGroup defaultValue="alpha">
            <RadioGroupItem value="alpha" label="Alpha" />
            <RadioGroupItem value="beta" label="Beta" />
            <RadioGroupItem value="gamma" label="Gamma" />
          </RadioGroup>
        </ScopedKeyboard>
      </KeyboardProvider>
    );

    const options = screen.getAllByRole("radio");
    expect(options[0]?.getAttribute("aria-checked")).toBe("true");
    expect(options[1]?.getAttribute("aria-checked")).toBe("false");

    fireEvent.keyDown(window, { key: "ArrowDown" });
    fireEvent.keyDown(window, { key: "Enter" });

    expect(options[0]?.getAttribute("aria-checked")).toBe("false");
    expect(options[1]?.getAttribute("aria-checked")).toBe("true");
  });

  it("handles ArrowDown and Enter for Menu via scoped keyboard without focusing the listbox", () => {
    const activated: string[] = [];

    render(
      <KeyboardProvider>
        <ScopedKeyboard>
          <Menu
            defaultIndex={0}
            onActivate={(item) => activated.push(item.id)}
          >
            <MenuItem id="alpha">Alpha</MenuItem>
            <MenuItem id="beta">Beta</MenuItem>
            <MenuItem id="gamma">Gamma</MenuItem>
          </Menu>
        </ScopedKeyboard>
      </KeyboardProvider>
    );

    fireEvent.keyDown(window, { key: "ArrowDown" });
    fireEvent.keyDown(window, { key: "Enter" });

    expect(activated).toEqual(["beta"]);
    expect(screen.getByText("Beta").closest('[role="option"]')?.getAttribute("aria-selected")).toBe("true");
  });
});
