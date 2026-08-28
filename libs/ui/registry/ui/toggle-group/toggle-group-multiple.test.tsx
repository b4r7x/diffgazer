import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, expectTypeOf, it, vi } from "vitest";
import { axe } from "../../../testing/axe";
import { ToggleGroup, type ToggleGroupItemProps } from "./index";
import type { ToggleGroupProps } from "./toggle-group";

describe("ToggleGroup multiple mode", () => {
  function renderMultiple(
    onChange: (value: readonly string[]) => void = vi.fn(),
    initial: readonly string[] = [],
  ) {
    return render(
      <ToggleGroup
        label="Options"
        selectionMode="multiple"
        defaultValue={initial}
        onChange={onChange}
      >
        <ToggleGroup.Item value="a">Alpha</ToggleGroup.Item>
        <ToggleGroup.Item value="b">Beta</ToggleGroup.Item>
        <ToggleGroup.Item value="c">Charlie</ToggleGroup.Item>
      </ToggleGroup>,
    );
  }

  it("uses button semantics with aria-pressed per item", () => {
    renderMultiple(vi.fn(), ["a"]);

    expect(screen.queryByRole("radiogroup")).not.toBeInTheDocument();
    expect(screen.getByRole("group", { name: /options/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /alpha/i })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: /beta/i })).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByRole("button", { name: /charlie/i })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  });

  it("toggles multiple items independently on click", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    renderMultiple(onChange);

    await user.click(screen.getByRole("button", { name: /alpha/i }));
    expect(onChange).toHaveBeenLastCalledWith(["a"]);

    await user.click(screen.getByRole("button", { name: /charlie/i }));
    expect(onChange).toHaveBeenLastCalledWith(["a", "c"]);

    expect(screen.getByRole("button", { name: /alpha/i })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: /beta/i })).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByRole("button", { name: /charlie/i })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("deselects an active item on second activation", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    renderMultiple(onChange, ["a", "b"]);

    await user.click(screen.getByRole("button", { name: /alpha/i }));

    expect(onChange).toHaveBeenLastCalledWith(["b"]);
    expect(screen.getByRole("button", { name: /alpha/i })).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByRole("button", { name: /beta/i })).toHaveAttribute("aria-pressed", "true");
  });

  it("moves keyboard highlight without changing pressed state", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    renderMultiple(onChange, ["a"]);

    const alpha = screen.getByRole("button", { name: /alpha/i });
    const beta = screen.getByRole("button", { name: /beta/i });

    alpha.focus();
    await user.keyboard("{ArrowRight}");

    expect(beta).toHaveFocus();
    expect(alpha).toHaveAttribute("aria-pressed", "true");
    expect(beta).toHaveAttribute("aria-pressed", "false");
    expect(onChange).not.toHaveBeenCalled();
  });

  it("toggles the focused item with Enter and Space", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    renderMultiple(onChange);

    const alpha = screen.getByRole("button", { name: /alpha/i });
    const beta = screen.getByRole("button", { name: /beta/i });

    alpha.focus();
    await user.keyboard(" ");
    expect(onChange).toHaveBeenLastCalledWith(["a"]);
    expect(alpha).toHaveAttribute("aria-pressed", "true");

    await user.keyboard("{ArrowRight}");
    expect(beta).toHaveFocus();

    await user.keyboard("{Enter}");
    expect(onChange).toHaveBeenLastCalledWith(["a", "b"]);
    expect(beta).toHaveAttribute("aria-pressed", "true");

    await user.keyboard("{Enter}");
    expect(onChange).toHaveBeenLastCalledWith(["a"]);
    expect(beta).toHaveAttribute("aria-pressed", "false");
  });

  it("keeps explicit multiple value undefined controlled instead of adopting internal selection", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <ToggleGroup label="Options" selectionMode="multiple" value={undefined} onChange={onChange}>
        <ToggleGroup.Item value="a">Alpha</ToggleGroup.Item>
        <ToggleGroup.Item value="b">Beta</ToggleGroup.Item>
      </ToggleGroup>,
    );

    const alpha = screen.getByRole("button", { name: /alpha/i });
    const beta = screen.getByRole("button", { name: /beta/i });
    expect(alpha).toHaveAttribute("aria-pressed", "false");
    expect(beta).toHaveAttribute("aria-pressed", "false");

    await user.click(beta);
    expect(onChange).toHaveBeenCalledWith(["b"]);
    expect(alpha).toHaveAttribute("aria-pressed", "false");
    expect(beta).toHaveAttribute("aria-pressed", "false");
  });

  it("respects controlled multiple value", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <ToggleGroup label="Options" selectionMode="multiple" value={["a"]} onChange={onChange}>
        <ToggleGroup.Item value="a">Alpha</ToggleGroup.Item>
        <ToggleGroup.Item value="b">Beta</ToggleGroup.Item>
      </ToggleGroup>,
    );

    await user.click(screen.getByRole("button", { name: /beta/i }));

    expect(onChange).toHaveBeenCalledWith(["a", "b"]);
    expect(screen.getByRole("button", { name: /alpha/i })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: /beta/i })).toHaveAttribute("aria-pressed", "false");
  });

  it("has no a11y violations with multiple selected", async () => {
    const { container } = render(
      <ToggleGroup label="Options" selectionMode="multiple" defaultValue={["a", "b"]}>
        <ToggleGroup.Item value="a">Alpha</ToggleGroup.Item>
        <ToggleGroup.Item value="b">Beta</ToggleGroup.Item>
        <ToggleGroup.Item value="c">Charlie</ToggleGroup.Item>
      </ToggleGroup>,
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});

describe("ToggleGroup types", () => {
  it("exposes honest string callbacks on the root API", () => {
    type Single = Extract<ToggleGroupProps, { selectionMode?: "single" | undefined }>;

    expectTypeOf<Single["value"]>().toEqualTypeOf<string | null | undefined>();
    expectTypeOf<Single["defaultValue"]>().toEqualTypeOf<string | null | undefined>();
    expectTypeOf<NonNullable<Single["onChange"]>>().parameter(0).toEqualTypeOf<string | null>();
    expectTypeOf<ToggleGroupItemProps["value"]>().toEqualTypeOf<string>();
  });

  it("exposes honest string-array callbacks in multiple mode", () => {
    type Multi = Extract<ToggleGroupProps, { selectionMode: "multiple" }>;

    expectTypeOf<Multi["value"]>().toEqualTypeOf<readonly string[] | undefined>();
    expectTypeOf<NonNullable<Multi["onChange"]>>().parameter(0).toEqualTypeOf<readonly string[]>();
  });
});
