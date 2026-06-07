import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRef } from "react";
import { describe, expect, expectTypeOf, it, vi } from "vitest";
import { axe } from "../../../testing/axe";
import { ToggleGroup, type ToggleGroupItemProps } from "./index";
import type { ToggleGroupProps } from "./toggle-group";

type ToggleGroupSingleComponentProps = Extract<
  React.ComponentProps<typeof ToggleGroup>,
  { selectionMode?: "single" | undefined }
>;

function renderGroup(props: Partial<ToggleGroupSingleComponentProps> = {}) {
  return render(
    <ToggleGroup label="Options" {...props}>
      <ToggleGroup.Item value="a">Alpha</ToggleGroup.Item>
      <ToggleGroup.Item value="b">Beta</ToggleGroup.Item>
      <ToggleGroup.Item value="c">Charlie</ToggleGroup.Item>
    </ToggleGroup>,
  );
}

function getRadios() {
  return screen.getAllByRole("radio");
}

describe("ToggleGroup", () => {
  it("supports direct namespaced items with custom item UI", async () => {
    const onChange = vi.fn();
    render(
      <ToggleGroup label="Options" onChange={onChange}>
        <ToggleGroup.Item value="a">
          <span>Alpha</span>
        </ToggleGroup.Item>
        <ToggleGroup.Item value="b">
          <span>Beta</span>
        </ToggleGroup.Item>
      </ToggleGroup>,
    );

    await userEvent.click(screen.getByRole("radio", { name: /beta/i }));

    expect(onChange).toHaveBeenCalledWith("b");
  });

  it("selects an item on click", async () => {
    renderGroup();
    await userEvent.click(screen.getByText("Beta"));
    expect(getRadios()[1]).toHaveAttribute("aria-checked", "true");
  });

  it("does not deselect when clicking the same item without allowDeselect", async () => {
    renderGroup({ defaultValue: "a" });
    await userEvent.click(screen.getByText("Alpha"));
    expect(getRadios()[0]).toHaveAttribute("aria-checked", "true");
  });

  it("deselects when clicking the same item with allowDeselect", async () => {
    const onChange = vi.fn();
    renderGroup({ defaultValue: "a", allowDeselect: true, onChange: onChange });
    await userEvent.click(screen.getByText("Alpha"));
    expect(onChange).toHaveBeenCalledWith(null);
    expect(screen.getByRole("button", { name: /alpha/i })).toHaveAttribute("aria-pressed", "false");
  });

  it("moves focus without changing pressed state when allowDeselect is true", async () => {
    const onChange = vi.fn();
    renderGroup({ defaultValue: "a", allowDeselect: true, onChange });
    const alpha = screen.getByRole("button", { name: /alpha/i });
    const beta = screen.getByRole("button", { name: /beta/i });

    alpha.focus();
    await userEvent.keyboard("{ArrowRight}");

    expect(beta).toHaveFocus();
    expect(alpha).toHaveAttribute("aria-pressed", "true");
    expect(beta).toHaveAttribute("aria-pressed", "false");
    expect(onChange).not.toHaveBeenCalled();
  });

  it("activates the focused item with Space and Enter when allowDeselect is true", async () => {
    const onChange = vi.fn();
    renderGroup({ defaultValue: "a", allowDeselect: true, onChange });
    const alpha = screen.getByRole("button", { name: /alpha/i });
    const beta = screen.getByRole("button", { name: /beta/i });

    alpha.focus();
    await userEvent.keyboard("{ArrowRight}");
    await userEvent.keyboard(" ");
    expect(onChange).toHaveBeenCalledWith("b");

    await userEvent.keyboard("{Enter}");
    expect(onChange).toHaveBeenCalledWith(null);
    expect(beta).toHaveAttribute("aria-pressed", "false");
  });

  it("uses button pressed semantics when deselection is allowed", () => {
    renderGroup({ defaultValue: "a", allowDeselect: true });

    expect(screen.queryByRole("radiogroup")).not.toBeInTheDocument();
    expect(screen.getByRole("group", { name: /options/i })).toBeInTheDocument();
    expect(screen.getByRole("group", { name: /options/i })).not.toHaveAttribute("aria-orientation");
    expect(screen.getByRole("button", { name: /alpha/i })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: /beta/i })).toHaveAttribute("aria-pressed", "false");
  });

  it("switches selection between items", async () => {
    renderGroup({ defaultValue: "a" });
    const radios = getRadios();
    expect(radios[0]).toHaveAttribute("aria-checked", "true");
    await userEvent.click(screen.getByText("Charlie"));
    expect(radios[0]).toHaveAttribute("aria-checked", "false");
    expect(radios[2]).toHaveAttribute("aria-checked", "true");
  });

  it("does not select disabled items (individual or group-level)", async () => {
    const onChange = vi.fn();
    const { unmount: unmount1 } = render(
      <ToggleGroup label="Options" onChange={onChange}>
        <ToggleGroup.Item value="a">Alpha</ToggleGroup.Item>
        <ToggleGroup.Item value="b" disabled>
          Beta
        </ToggleGroup.Item>
      </ToggleGroup>,
    );
    await userEvent.click(screen.getByText("Beta"));
    expect(onChange).not.toHaveBeenCalled();
    unmount1();
    onChange.mockClear();

    render(
      <ToggleGroup label="Options" disabled onChange={onChange}>
        <ToggleGroup.Item value="a">Alpha</ToggleGroup.Item>
        <ToggleGroup.Item value="b">Beta</ToggleGroup.Item>
        <ToggleGroup.Item value="c">Charlie</ToggleGroup.Item>
      </ToggleGroup>,
    );
    const radios = screen.getAllByRole("radio");
    for (const radio of radios) {
      expect(radio).toHaveAttribute("aria-disabled", "true");
      expect(radio).toBeDisabled();
    }
    await userEvent.click(screen.getByText("Alpha"));
    expect(onChange).not.toHaveBeenCalled();
  });

  it("renders count as a styled span after the label (no literal brackets in default variant)", () => {
    render(
      <ToggleGroup label="Options">
        <ToggleGroup.Item value="a" count={5}>
          Alpha
        </ToggleGroup.Item>
      </ToggleGroup>,
    );
    const item = screen.getByRole("radio");
    expect(item).toHaveTextContent(/^Alpha 5$/);
    expect(item.querySelector('[data-slot="toggle-group-count"]')).toHaveTextContent("5");
  });

  it("works in uncontrolled mode with defaultValue", async () => {
    renderGroup({ defaultValue: "b" });
    const radios = getRadios();
    expect(radios[1]).toHaveAttribute("aria-checked", "true");
    await userEvent.click(screen.getByText("Charlie"));
    expect(radios[1]).toHaveAttribute("aria-checked", "false");
    expect(radios[2]).toHaveAttribute("aria-checked", "true");
  });

  it("respects controlled value", async () => {
    const onChange = vi.fn();
    renderGroup({ value: "a", onChange: onChange });
    await userEvent.click(screen.getByText("Beta"));
    expect(onChange).toHaveBeenCalledWith("b");
    expect(getRadios()[0]).toHaveAttribute("aria-checked", "true");
    expect(getRadios()[1]).toHaveAttribute("aria-checked", "false");
  });

  it("calls onChange as the preferred controlled callback", async () => {
    const onChange = vi.fn();
    renderGroup({ value: "a", onChange });
    await userEvent.click(screen.getByText("Beta"));
    expect(onChange).toHaveBeenCalledWith("b");
  });

  it("forwards item props and refs while honoring preventDefault", async () => {
    const ref = createRef<HTMLButtonElement>();
    const onChange = vi.fn();
    const onClick = vi.fn((event) => event.preventDefault());

    render(
      <ToggleGroup label="Options" onChange={onChange}>
        <ToggleGroup.Item ref={ref} value="a" onClick={onClick}>
          Alpha
        </ToggleGroup.Item>
      </ToggleGroup>,
    );

    const item = screen.getByRole("radio", { name: /alpha/i });
    expect(ref.current).toBe(item);
    await userEvent.click(item);
    expect(onClick).toHaveBeenCalledOnce();
    expect(onChange).not.toHaveBeenCalled();
  });

  it("participates in form data by name and resets to defaultValue", async () => {
    render(
      <form aria-label="Test form">
        <ToggleGroup label="Options" name="option" defaultValue="a">
          <ToggleGroup.Item value="a">Alpha</ToggleGroup.Item>
          <ToggleGroup.Item value="b">Beta</ToggleGroup.Item>
        </ToggleGroup>
      </form>,
    );
    const form = screen.getByRole("form", { name: "Test form" }) as HTMLFormElement;

    expect(new FormData(form).get("option")).toBe("a");
    await userEvent.click(screen.getByRole("radio", { name: /beta/i }));
    expect(new FormData(form).get("option")).toBe("b");

    form.reset();
    await waitFor(() => expect(new FormData(form).get("option")).toBe("a"));
  });

  it("omits form data when disabled or deselected", async () => {
    const { rerender } = render(
      <form aria-label="Test form">
        <ToggleGroup label="Options" name="option" defaultValue="a" disabled>
          <ToggleGroup.Item value="a">Alpha</ToggleGroup.Item>
        </ToggleGroup>
      </form>,
    );
    expect(
      new FormData(screen.getByRole("form", { name: "Test form" }) as HTMLFormElement).has(
        "option",
      ),
    ).toBe(false);

    rerender(
      <form aria-label="Test form">
        <ToggleGroup label="Options" name="option" defaultValue="a" allowDeselect>
          <ToggleGroup.Item value="a">Alpha</ToggleGroup.Item>
        </ToggleGroup>
      </form>,
    );
    await userEvent.click(screen.getByRole("button", { name: /alpha/i }));
    expect(
      new FormData(screen.getByRole("form", { name: "Test form" }) as HTMLFormElement).has(
        "option",
      ),
    ).toBe(false);
  });

  it("has no a11y violations", async () => {
    const { container } = renderGroup();
    expect(await axe(container)).toHaveNoViolations();
  });

  it("has no a11y violations with a selected value", async () => {
    const { container } = renderGroup({ defaultValue: "b" });
    expect(await axe(container)).toHaveNoViolations();
  });

  it("moves focus with ArrowRight", async () => {
    renderGroup({ defaultValue: "a" });
    const radios = getRadios();
    radios[0]?.focus();
    await userEvent.keyboard("{ArrowRight}");
    expect(radios[1]).toHaveFocus();
  });

  it("skips disabled items while wrapping across vertical and cross-axis arrows", async () => {
    const onChange = vi.fn();
    render(
      <ToggleGroup label="Options" orientation="vertical" defaultValue="a" onChange={onChange}>
        <ToggleGroup.Item value="a">Alpha</ToggleGroup.Item>
        <ToggleGroup.Item value="b" disabled>
          Beta
        </ToggleGroup.Item>
        <ToggleGroup.Item value="c">Charlie</ToggleGroup.Item>
      </ToggleGroup>,
    );

    const alpha = screen.getByRole("radio", { name: /alpha/i });
    const beta = screen.getByRole("radio", { name: /beta/i });
    const charlie = screen.getByRole("radio", { name: /charlie/i });

    alpha.focus();
    await userEvent.keyboard("{ArrowDown}");
    expect(charlie).toHaveFocus();
    expect(onChange).toHaveBeenLastCalledWith("c");

    await userEvent.keyboard("{ArrowDown}");
    expect(alpha).toHaveFocus();
    expect(onChange).toHaveBeenLastCalledWith("a");

    await userEvent.keyboard("{ArrowUp}");
    expect(charlie).toHaveFocus();
    expect(onChange).toHaveBeenLastCalledWith("c");

    await userEvent.keyboard("{ArrowLeft}");
    expect(alpha).toHaveFocus();
    expect(onChange).toHaveBeenLastCalledWith("a");

    await userEvent.keyboard("{ArrowRight}");
    expect(charlie).toHaveFocus();
    expect(onChange).toHaveBeenLastCalledWith("c");
    expect(beta).not.toHaveFocus();
    expect(beta).toHaveAttribute("aria-checked", "false");
  });

  it("keeps nested toggle group keyboard navigation scoped to the owning group", async () => {
    const onOuterChange = vi.fn();
    const onInnerChange = vi.fn();
    render(
      <ToggleGroup label="Outer" onChange={onOuterChange}>
        <ToggleGroup.Item value="outer-a">Outer A</ToggleGroup.Item>
        <ToggleGroup label="Inner" onChange={onInnerChange}>
          <ToggleGroup.Item value="inner-a">Inner A</ToggleGroup.Item>
          <ToggleGroup.Item value="inner-b">Inner B</ToggleGroup.Item>
        </ToggleGroup>
        <ToggleGroup.Item value="outer-b">Outer B</ToggleGroup.Item>
      </ToggleGroup>,
    );

    const outerA = screen.getByRole("radio", { name: /outer a/i });
    const outerB = screen.getByRole("radio", { name: /outer b/i });
    const innerA = screen.getByRole("radio", { name: /inner a/i });
    const innerB = screen.getByRole("radio", { name: /inner b/i });

    outerA.focus();
    await userEvent.keyboard("{ArrowRight}");
    expect(outerB).toHaveFocus();
    expect(onOuterChange).toHaveBeenCalledWith("outer-b");
    expect(onInnerChange).not.toHaveBeenCalled();

    onOuterChange.mockClear();
    innerA.focus();
    await userEvent.keyboard("{ArrowRight}");
    expect(innerB).toHaveFocus();
    expect(onInnerChange).toHaveBeenCalledWith("inner-b");
    expect(onOuterChange).not.toHaveBeenCalled();
  });

  it("wraps button-mode focus and selects the focused item with Enter", async () => {
    const onChange = vi.fn();
    renderGroup({ allowDeselect: true, onChange });
    const alpha = screen.getByRole("button", { name: /alpha/i });
    const charlie = screen.getByRole("button", { name: /charlie/i });

    alpha.focus();
    await userEvent.keyboard("{ArrowLeft}");
    expect(charlie).toHaveFocus();
    expect(onChange).not.toHaveBeenCalled();

    await userEvent.keyboard("{Enter}");
    expect(onChange).toHaveBeenCalledWith("c");
    expect(charlie).toHaveAttribute("aria-pressed", "true");
  });

  it("keeps keyboard highlight when a different enabled item is hovered", async () => {
    const onHighlightChange = vi.fn();
    renderGroup({ highlighted: "a", onHighlightChange });

    const alpha = screen.getByRole("radio", { name: /alpha/i });
    const beta = screen.getByRole("radio", { name: /beta/i });

    await userEvent.hover(beta);

    expect(onHighlightChange).not.toHaveBeenCalled();
    expect(alpha).toHaveAttribute("data-highlighted", "true");
    expect(beta).not.toHaveAttribute("data-highlighted");
  });

  it("disabled items do not activate on Enter key", async () => {
    const onChange = vi.fn();
    render(
      <ToggleGroup label="Options" onChange={onChange}>
        <ToggleGroup.Item value="a" disabled>
          Alpha
        </ToggleGroup.Item>
      </ToggleGroup>,
    );
    const alpha = screen.getByRole("radio", { name: /alpha/i });
    alpha.focus();
    await userEvent.keyboard("{Enter}");
    expect(onChange).not.toHaveBeenCalled();
  });

  it("calls onNavigationBoundaryReached when wrap is false and boundary is hit", async () => {
    const onNavigationBoundaryReached = vi.fn();
    render(
      <ToggleGroup
        label="Options"
        defaultValue="c"
        wrap={false}
        onNavigationBoundaryReached={onNavigationBoundaryReached}
      >
        <ToggleGroup.Item value="a">Alpha</ToggleGroup.Item>
        <ToggleGroup.Item value="b">Beta</ToggleGroup.Item>
        <ToggleGroup.Item value="c">Charlie</ToggleGroup.Item>
      </ToggleGroup>,
    );

    const charlie = screen.getByRole("radio", { name: /charlie/i });
    charlie.focus();
    await userEvent.keyboard("{ArrowRight}");

    expect(onNavigationBoundaryReached).toHaveBeenCalledWith(
      "next",
      expect.any(KeyboardEvent),
      "ArrowRight",
    );
    expect(charlie).toHaveFocus();

    const alpha = screen.getByRole("radio", { name: /alpha/i });
    alpha.focus();
    await userEvent.keyboard("{ArrowLeft}");

    expect(onNavigationBoundaryReached).toHaveBeenCalledWith(
      "previous",
      expect.any(KeyboardEvent),
      "ArrowLeft",
    );
    expect(alpha).toHaveFocus();
  });

  it("honors preventDefault in custom key handlers", async () => {
    const onChange = vi.fn();
    renderGroup({
      defaultValue: "a",
      onChange: onChange,
      onKeyDown: (event) => event.preventDefault(),
    });

    getRadios()[0]?.focus();
    await userEvent.keyboard("{ArrowRight}");

    expect(getRadios()[0]).toHaveFocus();
    expect(onChange).not.toHaveBeenCalled();
  });
});

describe("ToggleGroup variants", () => {
  it("propagates variant via data-variant on the root", () => {
    const { rerender } = render(
      <ToggleGroup label="Options" variant="pill" defaultValue="a">
        <ToggleGroup.Item value="a">Alpha</ToggleGroup.Item>
        <ToggleGroup.Item value="b">Beta</ToggleGroup.Item>
      </ToggleGroup>,
    );
    expect(screen.getByRole("radiogroup")).toHaveAttribute("data-variant", "pill");

    rerender(
      <ToggleGroup label="Options" variant="underline" defaultValue="a">
        <ToggleGroup.Item value="a">Alpha</ToggleGroup.Item>
        <ToggleGroup.Item value="b">Beta</ToggleGroup.Item>
      </ToggleGroup>,
    );
    expect(screen.getByRole("radiogroup")).toHaveAttribute("data-variant", "underline");
  });

  it("renders a sliding pill indicator only for variant='pill' single mode", () => {
    const { container, rerender } = render(
      <ToggleGroup label="Options" variant="pill" defaultValue="b">
        <ToggleGroup.Item value="a">Alpha</ToggleGroup.Item>
        <ToggleGroup.Item value="b">Beta</ToggleGroup.Item>
      </ToggleGroup>,
    );
    expect(container.querySelectorAll('[data-slot="toggle-group-pill"]').length).toBe(1);

    rerender(
      <ToggleGroup label="Options" variant="default" defaultValue="b">
        <ToggleGroup.Item value="a">Alpha</ToggleGroup.Item>
        <ToggleGroup.Item value="b">Beta</ToggleGroup.Item>
      </ToggleGroup>,
    );
    expect(container.querySelector('[data-slot="toggle-group-pill"]')).toBeNull();
  });

  it("suppresses the pill indicator in multiple-selection mode", () => {
    const { container } = render(
      <ToggleGroup label="Options" variant="pill" selectionMode="multiple" defaultValue={["a"]}>
        <ToggleGroup.Item value="a">Alpha</ToggleGroup.Item>
        <ToggleGroup.Item value="b">Beta</ToggleGroup.Item>
      </ToggleGroup>,
    );
    expect(container.querySelector('[data-slot="toggle-group-pill"]')).toBeNull();
  });

  it("renders a floating underline indicator for variant='underline' in single mode", () => {
    render(
      <ToggleGroup label="Options" variant="underline" defaultValue="b">
        <ToggleGroup.Item value="a">Alpha</ToggleGroup.Item>
        <ToggleGroup.Item value="b">Beta</ToggleGroup.Item>
      </ToggleGroup>,
    );
    expect(
      screen.getByRole("radiogroup").querySelector('[data-slot="toggle-group-underline"]'),
    ).not.toBeNull();
  });

  it("suppresses the underline indicator in multiple-selection mode", () => {
    const { container } = render(
      <ToggleGroup
        label="Options"
        variant="underline"
        selectionMode="multiple"
        defaultValue={["a"]}
      >
        <ToggleGroup.Item value="a">Alpha</ToggleGroup.Item>
        <ToggleGroup.Item value="b">Beta</ToggleGroup.Item>
      </ToggleGroup>,
    );
    expect(container.querySelector('[data-slot="toggle-group-underline"]')).toBeNull();
  });

  it("does not render underline indicator for other variants", () => {
    const { container } = render(
      <ToggleGroup label="Options" variant="default" defaultValue="b">
        <ToggleGroup.Item value="a">Alpha</ToggleGroup.Item>
        <ToggleGroup.Item value="b">Beta</ToggleGroup.Item>
      </ToggleGroup>,
    );
    expect(container.querySelector('[data-slot="toggle-group-underline"]')).toBeNull();
  });

  it("keeps bracket markers around the label and renders count outside the brackets", () => {
    render(
      <ToggleGroup label="Options" variant="bracket" defaultValue="a">
        <ToggleGroup.Item value="a" count={5}>
          Alpha
        </ToggleGroup.Item>
      </ToggleGroup>,
    );
    const item = screen.getByRole("radio", { name: /alpha/i });
    // Brackets wrap the label only; count is a separate styled span after.
    expect(item).toHaveTextContent(/^\[Alpha\] 5$/);
    expect(item.querySelector('[data-slot="toggle-group-count"]')).toHaveTextContent("5");
  });

  it("marks the active item via data-active in underline variant", () => {
    render(
      <ToggleGroup label="Options" variant="underline" defaultValue="b">
        <ToggleGroup.Item value="a">Alpha</ToggleGroup.Item>
        <ToggleGroup.Item value="b">Beta</ToggleGroup.Item>
      </ToggleGroup>,
    );
    expect(screen.getByRole("radio", { name: /alpha/i })).not.toHaveAttribute("data-active");
    expect(screen.getByRole("radio", { name: /beta/i })).toHaveAttribute("data-active", "true");
  });
});

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
    const onChange = vi.fn();
    renderMultiple(onChange);

    await userEvent.click(screen.getByRole("button", { name: /alpha/i }));
    expect(onChange).toHaveBeenLastCalledWith(["a"]);

    await userEvent.click(screen.getByRole("button", { name: /charlie/i }));
    expect(onChange).toHaveBeenLastCalledWith(["a", "c"]);

    expect(screen.getByRole("button", { name: /alpha/i })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: /beta/i })).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByRole("button", { name: /charlie/i })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("deselects an active item on second activation", async () => {
    const onChange = vi.fn();
    renderMultiple(onChange, ["a", "b"]);

    await userEvent.click(screen.getByRole("button", { name: /alpha/i }));

    expect(onChange).toHaveBeenLastCalledWith(["b"]);
    expect(screen.getByRole("button", { name: /alpha/i })).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByRole("button", { name: /beta/i })).toHaveAttribute("aria-pressed", "true");
  });

  it("moves keyboard highlight without changing pressed state", async () => {
    const onChange = vi.fn();
    renderMultiple(onChange, ["a"]);

    const alpha = screen.getByRole("button", { name: /alpha/i });
    const beta = screen.getByRole("button", { name: /beta/i });

    alpha.focus();
    await userEvent.keyboard("{ArrowRight}");

    expect(beta).toHaveFocus();
    expect(alpha).toHaveAttribute("aria-pressed", "true");
    expect(beta).toHaveAttribute("aria-pressed", "false");
    expect(onChange).not.toHaveBeenCalled();
  });

  it("toggles the focused item with Enter and Space", async () => {
    const onChange = vi.fn();
    renderMultiple(onChange);

    const alpha = screen.getByRole("button", { name: /alpha/i });
    const beta = screen.getByRole("button", { name: /beta/i });

    alpha.focus();
    await userEvent.keyboard(" ");
    expect(onChange).toHaveBeenLastCalledWith(["a"]);
    expect(alpha).toHaveAttribute("aria-pressed", "true");

    await userEvent.keyboard("{ArrowRight}");
    expect(beta).toHaveFocus();

    await userEvent.keyboard("{Enter}");
    expect(onChange).toHaveBeenLastCalledWith(["a", "b"]);
    expect(beta).toHaveAttribute("aria-pressed", "true");

    await userEvent.keyboard("{Enter}");
    expect(onChange).toHaveBeenLastCalledWith(["a"]);
    expect(beta).toHaveAttribute("aria-pressed", "false");
  });

  it("respects controlled multiple value", async () => {
    const onChange = vi.fn();
    render(
      <ToggleGroup label="Options" selectionMode="multiple" value={["a"]} onChange={onChange}>
        <ToggleGroup.Item value="a">Alpha</ToggleGroup.Item>
        <ToggleGroup.Item value="b">Beta</ToggleGroup.Item>
      </ToggleGroup>,
    );

    await userEvent.click(screen.getByRole("button", { name: /beta/i }));

    expect(onChange).toHaveBeenCalledWith(["a", "b"]);
    expect(screen.getByRole("button", { name: /alpha/i })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: /beta/i })).toHaveAttribute("aria-pressed", "false");
  });

  it("does not render a hidden input in multiple mode", () => {
    const { container } = render(
      <ToggleGroup label="Options" selectionMode="multiple" name="severities" defaultValue={["a"]}>
        <ToggleGroup.Item value="a">Alpha</ToggleGroup.Item>
      </ToggleGroup>,
    );

    // querySelector retained: hidden input has no accessible role; structural assertion is the contract (asserting absence by negative role query is impossible)
    expect(container.querySelector('input[type="hidden"]')).toBeNull();
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
  it("narrows single-mode value/onChange to the supplied union", () => {
    type Single = Extract<ToggleGroupProps<"a" | "b">, { selectionMode?: "single" | undefined }>;

    expectTypeOf<Single["value"]>().toEqualTypeOf<"a" | "b" | null | undefined>();
    expectTypeOf<Single["defaultValue"]>().toEqualTypeOf<"a" | "b" | null | undefined>();
    expectTypeOf<NonNullable<Single["onChange"]>>().parameter(0).toEqualTypeOf<"a" | "b" | null>();
  });

  it("narrows multiple-mode value/onChange to the supplied union", () => {
    type Multi = Extract<ToggleGroupProps<"a" | "b">, { selectionMode: "multiple" }>;

    expectTypeOf<Multi["value"]>().toEqualTypeOf<readonly ("a" | "b")[] | undefined>();
    expectTypeOf<NonNullable<Multi["onChange"]>>()
      .parameter(0)
      .toEqualTypeOf<readonly ("a" | "b")[]>();
  });

  it("rejects ToggleGroupItem values outside the literal union", () => {
    expectTypeOf<"c">().not.toMatchTypeOf<ToggleGroupItemProps<"a" | "b">["value"]>();
    expectTypeOf<"a">().toMatchTypeOf<ToggleGroupItemProps<"a" | "b">["value"]>();
  });

  it("keeps the loose default contract when no generic is supplied", () => {
    type Single = Extract<ToggleGroupProps, { selectionMode?: "single" | undefined }>;
    expectTypeOf<Single["value"]>().toEqualTypeOf<string | null | undefined>();
    expectTypeOf<ToggleGroupItemProps["value"]>().toEqualTypeOf<string>();
  });
});
