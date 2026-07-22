import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { axe } from "../../../testing/axe";
import { Select } from "./index";
import { getSelectTrigger, PICK_FRUIT } from "./select.test-utils";

describe("Select indirect composition (registration)", () => {
  function WrappedItem({ value, children }: { value: string; children: ReactNode }) {
    return <Select.Item value={value}>{children}</Select.Item>;
  }

  function WrappedSearch() {
    return <Select.Search />;
  }

  it("makes a SelectItem rendered inside a consumer wrapper selectable", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <Select defaultOpen onChange={onChange}>
        <Select.Trigger>
          <Select.Value placeholder={PICK_FRUIT} />
        </Select.Trigger>
        <Select.Content>
          <WrappedItem value="apple">Apple</WrappedItem>
          <WrappedItem value="banana">Banana</WrappedItem>
        </Select.Content>
      </Select>,
    );

    await user.click(screen.getByRole("option", { name: /banana/i }));
    expect(onChange).toHaveBeenCalledWith("banana");
  });

  it("exposes a mounted wrapper-rendered item's label in the value display metadata", () => {
    render(
      <Select defaultOpen defaultValue="banana">
        <Select.Trigger>
          <Select.Value placeholder={PICK_FRUIT} />
        </Select.Trigger>
        <Select.Content>
          <WrappedItem value="apple">Apple</WrappedItem>
          <WrappedItem value="banana">Banana</WrappedItem>
        </Select.Content>
      </Select>,
    );

    expect(getSelectTrigger().textContent).toContain("Banana");
  });

  it("detects a SelectSearch rendered through a wrapper component", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    try {
      render(
        <Select defaultOpen>
          <Select.Trigger>
            <Select.Value placeholder={PICK_FRUIT} />
          </Select.Trigger>
          <Select.Content>
            <WrappedSearch />
            <Select.Item value="apple">Apple</Select.Item>
          </Select.Content>
        </Select>,
      );

      expect(warn).toHaveBeenCalledWith(expect.stringContaining("Select.Search rendered through"));
    } finally {
      warn.mockRestore();
    }
  });

  it("has no a11y violations when items render through a wrapper component", async () => {
    const { container } = render(
      <Select defaultOpen>
        <Select.Trigger aria-label="Fruit">
          <Select.Value placeholder={PICK_FRUIT} />
        </Select.Trigger>
        <Select.Content>
          <WrappedItem value="apple">Apple</WrappedItem>
          <WrappedItem value="banana">Banana</WrappedItem>
        </Select.Content>
      </Select>,
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});
