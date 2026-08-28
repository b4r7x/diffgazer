import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRef } from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { axe } from "../../../testing/axe";
import { toggleGroupDoc } from "../../component-docs/toggle-group";
import { SEGMENTED_VARIANTS } from "../../lib/segmented-variants";
import { ToggleGroup } from "./index";
import { getRadios, renderGroup } from "./toggle-group-test-utils";

describe("ToggleGroup", () => {
  it("documents and renders the optional initial selection in single mode", () => {
    const roleNote = toggleGroupDoc.notes?.find((note) => note.title === "Role semantics");

    expect(roleNote?.content).toContain("at most one active choice");
    expect(roleNote?.content).toContain("defaultValue=null starts with no radio checked");
    expect(toggleGroupDoc.props?.ToggleGroup?.defaultValue?.defaultValue).toBe(
      "null (single) | [] (multiple)",
    );

    renderGroup({ defaultValue: null });

    expect(screen.getByRole("radiogroup", { name: "Options" })).toBeInTheDocument();
    expect(getRadios()).toHaveLength(3);
    for (const radio of getRadios()) {
      expect(radio).toHaveAttribute("aria-checked", "false");
    }
  });

  it("keeps variant metadata aligned with the shared runtime variants", () => {
    const variant = toggleGroupDoc.props?.ToggleGroup?.variant;
    const documentedDefault = variant?.defaultValue?.replaceAll('"', "");

    expect(variant).toMatchObject({
      defaultValue: '"default"',
      required: false,
      type: SEGMENTED_VARIANTS.map((value) => `"${value}"`).join(" | "),
    });

    renderGroup();
    expect(screen.getByRole("radiogroup")).toHaveAttribute("data-variant", documentedDefault);
  });

  it.each([
    { defaultValue: "b", expected: "Beta", label: "default-selected item" },
    { defaultValue: undefined, expected: "Beta", label: "first enabled fallback" },
  ])("renders the $label as the only server Tab stop", ({ defaultValue, expected }) => {
    const markup = renderToString(
      <ToggleGroup label="Options" defaultValue={defaultValue}>
        <ToggleGroup.Item value="a" disabled>
          Alpha
        </ToggleGroup.Item>
        <ToggleGroup.Item value="b">Beta</ToggleGroup.Item>
        <ToggleGroup.Item value="c">Charlie</ToggleGroup.Item>
      </ToggleGroup>,
    );
    const container = document.createElement("div");
    container.innerHTML = markup;
    const radios = within(container).getAllByRole("radio");
    const tabbable = radios.filter((radio) => radio.getAttribute("tabindex") === "0");

    expect(tabbable).toHaveLength(1);
    expect(tabbable[0]).toHaveTextContent(expected);
  });

  it("supports direct namespaced items with custom item UI", async () => {
    const user = userEvent.setup();
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

    await user.click(screen.getByRole("radio", { name: /beta/i }));

    expect(onChange).toHaveBeenCalledWith("b");
  });

  it("selects an item on click", async () => {
    const user = userEvent.setup();
    renderGroup();
    await user.click(screen.getByText("Beta"));
    expect(getRadios()[1]).toHaveAttribute("aria-checked", "true");
  });

  it("does not deselect when clicking the same item without allowDeselect", async () => {
    const user = userEvent.setup();
    renderGroup({ defaultValue: "a" });
    await user.click(screen.getByText("Alpha"));
    expect(getRadios()[0]).toHaveAttribute("aria-checked", "true");
  });

  it("deselects when clicking the same item with allowDeselect", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    renderGroup({ defaultValue: "a", allowDeselect: true, onChange: onChange });
    await user.click(screen.getByText("Alpha"));
    expect(onChange).toHaveBeenCalledWith(null);
    expect(screen.getByRole("button", { name: /alpha/i })).toHaveAttribute("aria-pressed", "false");
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
    const user = userEvent.setup();
    renderGroup({ defaultValue: "a" });
    const radios = getRadios();
    expect(radios[0]).toHaveAttribute("aria-checked", "true");
    await user.click(screen.getByText("Charlie"));
    expect(radios[0]).toHaveAttribute("aria-checked", "false");
    expect(radios[2]).toHaveAttribute("aria-checked", "true");
  });

  it("does not select disabled items (individual or group-level)", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const { unmount: unmount1 } = render(
      <ToggleGroup label="Options" onChange={onChange}>
        <ToggleGroup.Item value="a">Alpha</ToggleGroup.Item>
        <ToggleGroup.Item value="b" disabled>
          Beta
        </ToggleGroup.Item>
      </ToggleGroup>,
    );
    await user.click(screen.getByText("Beta"));
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
    await user.click(screen.getByText("Alpha"));
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

  it("respects controlled value", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    renderGroup({ value: "a", onChange: onChange });
    await user.click(screen.getByText("Beta"));
    expect(onChange).toHaveBeenCalledWith("b");
    expect(getRadios()[0]).toHaveAttribute("aria-checked", "true");
    expect(getRadios()[1]).toHaveAttribute("aria-checked", "false");
  });

  it("keeps explicit value undefined controlled instead of adopting internal selection", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    renderGroup({ value: undefined, onChange });
    const radios = getRadios();
    expect(radios[0]).toHaveAttribute("aria-checked", "false");
    expect(radios[1]).toHaveAttribute("aria-checked", "false");

    await user.click(screen.getByText("Beta"));
    expect(onChange).toHaveBeenCalledWith("b");
    expect(radios[0]).toHaveAttribute("aria-checked", "false");
    expect(radios[1]).toHaveAttribute("aria-checked", "false");
  });

  it("forwards item props and refs while honoring preventDefault", async () => {
    const user = userEvent.setup();
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
    await user.click(item);
    expect(onClick).toHaveBeenCalledOnce();
    expect(onChange).not.toHaveBeenCalled();
  });

  // touch-target contract: pointer-coarse hit-area is the public contract; jsdom
  // cannot measure layout.
  it("sm items reserve a 44px coarse-pointer touch target", () => {
    renderGroup({ size: "sm" });
    for (const item of getRadios()) {
      expect(item).toHaveClass("pointer-coarse:min-h-11");
    }
  });

  it("has no a11y violations", async () => {
    const { container } = renderGroup();
    expect(await axe(container)).toHaveNoViolations();
  });

  it("has no a11y violations with a selected value", async () => {
    const { container } = renderGroup({ defaultValue: "b" });
    expect(await axe(container)).toHaveNoViolations();
  });
});
