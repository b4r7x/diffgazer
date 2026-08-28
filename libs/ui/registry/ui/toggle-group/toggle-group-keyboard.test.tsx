import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ToggleGroup } from "./index";
import { getRadios, renderGroup } from "./toggle-group-test-utils";

describe("ToggleGroup keyboard navigation", () => {
  it("moves focus without changing pressed state when allowDeselect is true", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    renderGroup({ defaultValue: "a", allowDeselect: true, onChange });
    const alpha = screen.getByRole("button", { name: /alpha/i });
    const beta = screen.getByRole("button", { name: /beta/i });

    alpha.focus();
    await user.keyboard("{ArrowRight}");

    expect(beta).toHaveFocus();
    expect(alpha).toHaveAttribute("aria-pressed", "true");
    expect(beta).toHaveAttribute("aria-pressed", "false");
    expect(onChange).not.toHaveBeenCalled();
  });

  it("activates the focused item with Space and Enter when allowDeselect is true", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    renderGroup({ defaultValue: "a", allowDeselect: true, onChange });
    const alpha = screen.getByRole("button", { name: /alpha/i });
    const beta = screen.getByRole("button", { name: /beta/i });

    alpha.focus();
    await user.keyboard("{ArrowRight}");
    await user.keyboard(" ");
    expect(onChange).toHaveBeenCalledWith("b");

    await user.keyboard("{Enter}");
    expect(onChange).toHaveBeenCalledWith(null);
    expect(beta).toHaveAttribute("aria-pressed", "false");
  });

  it("moves focus with ArrowRight", async () => {
    const user = userEvent.setup();
    renderGroup({ defaultValue: "a" });
    const radios = getRadios();
    radios[0]?.focus();
    await user.keyboard("{ArrowRight}");
    expect(radios[1]).toHaveFocus();
  });

  it("skips disabled items while wrapping across vertical and cross-axis arrows", async () => {
    const user = userEvent.setup();
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
    await user.keyboard("{ArrowDown}");
    expect(charlie).toHaveFocus();
    expect(onChange).toHaveBeenLastCalledWith("c");

    await user.keyboard("{ArrowDown}");
    expect(alpha).toHaveFocus();
    expect(onChange).toHaveBeenLastCalledWith("a");

    await user.keyboard("{ArrowUp}");
    expect(charlie).toHaveFocus();
    expect(onChange).toHaveBeenLastCalledWith("c");

    await user.keyboard("{ArrowLeft}");
    expect(alpha).toHaveFocus();
    expect(onChange).toHaveBeenLastCalledWith("a");

    await user.keyboard("{ArrowRight}");
    expect(charlie).toHaveFocus();
    expect(onChange).toHaveBeenLastCalledWith("c");
    expect(beta).not.toHaveFocus();
    expect(beta).toHaveAttribute("aria-checked", "false");
  });

  it("keeps nested toggle group keyboard navigation scoped to the owning group", async () => {
    const user = userEvent.setup();
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
    await user.keyboard("{ArrowRight}");
    expect(outerB).toHaveFocus();
    expect(onOuterChange).toHaveBeenCalledWith("outer-b");
    expect(onInnerChange).not.toHaveBeenCalled();

    onOuterChange.mockClear();
    innerA.focus();
    await user.keyboard("{ArrowRight}");
    expect(innerB).toHaveFocus();
    expect(onInnerChange).toHaveBeenCalledWith("inner-b");
    expect(onOuterChange).not.toHaveBeenCalled();
  });

  it("wraps button-mode focus and selects the focused item with Enter", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    renderGroup({ allowDeselect: true, onChange });
    const alpha = screen.getByRole("button", { name: /alpha/i });
    const charlie = screen.getByRole("button", { name: /charlie/i });

    alpha.focus();
    await user.keyboard("{ArrowLeft}");
    expect(charlie).toHaveFocus();
    expect(onChange).not.toHaveBeenCalled();

    await user.keyboard("{Enter}");
    expect(onChange).toHaveBeenCalledWith("c");
    expect(charlie).toHaveAttribute("aria-pressed", "true");
  });

  it("keeps keyboard highlight when a different enabled item is hovered", async () => {
    const user = userEvent.setup();
    const onHighlightChange = vi.fn();
    renderGroup({ highlighted: "a", onHighlightChange });

    const alpha = screen.getByRole("radio", { name: /alpha/i });
    const beta = screen.getByRole("radio", { name: /beta/i });

    await user.hover(beta);

    expect(onHighlightChange).not.toHaveBeenCalled();
    expect(alpha).toHaveAttribute("data-highlighted");
    expect(beta).not.toHaveAttribute("data-highlighted");
  });

  it("disabled items do not activate on Enter key", async () => {
    const user = userEvent.setup();
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
    await user.keyboard("{Enter}");
    expect(onChange).not.toHaveBeenCalled();
  });

  it("calls onNavigationBoundaryReached when wrap is false and boundary is hit", async () => {
    const user = userEvent.setup();
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
    await user.keyboard("{ArrowRight}");

    expect(onNavigationBoundaryReached).toHaveBeenCalledWith(
      "next",
      expect.any(KeyboardEvent),
      "ArrowRight",
    );
    expect(charlie).toHaveFocus();

    const alpha = screen.getByRole("radio", { name: /alpha/i });
    alpha.focus();
    await user.keyboard("{ArrowLeft}");

    expect(onNavigationBoundaryReached).toHaveBeenCalledWith(
      "previous",
      expect.any(KeyboardEvent),
      "ArrowLeft",
    );
    expect(alpha).toHaveFocus();
  });

  it("honors preventDefault in custom key handlers", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    renderGroup({
      defaultValue: "a",
      onChange: onChange,
      onKeyDown: (event) => event.preventDefault(),
    });

    getRadios()[0]?.focus();
    await user.keyboard("{ArrowRight}");

    expect(getRadios()[0]).toHaveFocus();
    expect(onChange).not.toHaveBeenCalled();
  });
});
