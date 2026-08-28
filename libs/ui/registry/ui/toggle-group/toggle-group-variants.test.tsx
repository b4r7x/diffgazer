import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ToggleGroup } from "./index";

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

  it("renders a sliding pill indicator for a non-wrapping pill single mode", () => {
    const { container, rerender } = render(
      <ToggleGroup label="Options" variant="pill" defaultValue="b" wrap={false}>
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

  it("uses selected items instead of a one-row indicator when pill items can wrap", () => {
    const { container } = render(
      <ToggleGroup label="Options" variant="pill" defaultValue="b">
        <ToggleGroup.Item value="a">Alpha</ToggleGroup.Item>
        <ToggleGroup.Item value="b">Beta</ToggleGroup.Item>
      </ToggleGroup>,
    );

    expect(container.querySelector('[data-slot="toggle-group-pill"]')).toBeNull();
    expect(screen.getByRole("radio", { name: "Beta" })).toHaveAttribute("data-state", "on");
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

  it("marks the active item via data-state in underline variant", () => {
    render(
      <ToggleGroup label="Options" variant="underline" defaultValue="b">
        <ToggleGroup.Item value="a">Alpha</ToggleGroup.Item>
        <ToggleGroup.Item value="b">Beta</ToggleGroup.Item>
      </ToggleGroup>,
    );
    expect(screen.getByRole("radio", { name: /alpha/i })).toHaveAttribute("data-state", "off");
    expect(screen.getByRole("radio", { name: /beta/i })).toHaveAttribute("data-state", "on");
  });
});
