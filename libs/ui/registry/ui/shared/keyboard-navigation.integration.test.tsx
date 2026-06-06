import { KeyboardProvider, useNavigation } from "@diffgazer/keys";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useRef, useState } from "react";
import { describe, expect, it } from "vitest";
import { axe } from "../../../testing/axe";
import { CheckboxGroup, CheckboxItem } from "../checkbox";

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
      label="Choices"
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

describe("UI keyboard navigation integration", () => {
  it("wires keys navigation into Checkbox.Group through public props", async () => {
    const user = userEvent.setup();
    render(<KeyboardProvider><CheckboxGroupWithKeyboard /></KeyboardProvider>);

    const group = screen.getByRole("group", { name: "Choices" });
    const alpha = screen.getByRole("checkbox", { name: "Alpha" });
    expect(alpha).toHaveAttribute("aria-checked", "false");

    group.focus();
    await user.keyboard("{ArrowDown} ");

    expect(alpha).toHaveAttribute("aria-checked", "true");
  });

  it("has no a11y violations", async () => {
    const { container } = render(
      <KeyboardProvider><CheckboxGroupWithKeyboard /></KeyboardProvider>
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});
