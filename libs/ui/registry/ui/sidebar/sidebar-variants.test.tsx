import { render, screen } from "@testing-library/react";
import type { Ref } from "react";
import { describe, expect, it } from "vitest";
import { axe } from "../../../testing/axe";
import { Sidebar } from "./index";

describe("Sidebar variants", () => {
  function renderWithVariant(variant: "caret" | "inverted" | "bar" | "terminal" | "tree") {
    return render(
      <Sidebar variant={variant}>
        <Sidebar.Content>
          <Sidebar.Section collapsible defaultOpen>
            <Sidebar.SectionTitle>Section</Sidebar.SectionTitle>
            <Sidebar.SectionContent>
              <Sidebar.Item as="button">Install</Sidebar.Item>
              <Sidebar.Item as="button" active>
                Quickstart
              </Sidebar.Item>
              <Sidebar.Item as="button">Theming</Sidebar.Item>
            </Sidebar.SectionContent>
          </Sidebar.Section>
        </Sidebar.Content>
      </Sidebar>,
    );
  }

  it("defaults to caret variant on the nav root", () => {
    render(
      <Sidebar>
        <Sidebar.Content>
          <Sidebar.Item as="button">Item</Sidebar.Item>
        </Sidebar.Content>
      </Sidebar>,
    );
    expect(screen.getByRole("navigation")).toHaveAttribute("data-variant", "caret");
  });

  it("propagates the variant prop to the nav root", () => {
    render(
      <Sidebar variant="inverted">
        <Sidebar.Content>
          <Sidebar.Item as="button">Item</Sidebar.Item>
        </Sidebar.Content>
      </Sidebar>,
    );
    expect(screen.getByRole("navigation")).toHaveAttribute("data-variant", "inverted");
  });

  it("caret variant marks the active item and reserves the chevron marker slot", () => {
    renderWithVariant("caret");
    const active = screen.getByRole("button", { name: /Quickstart/i });
    expect(active).toHaveAttribute("aria-current", "page");
    expect(active).toHaveAttribute("data-selected");
    expect(active.querySelector("svg")).not.toBeNull();
    const inactive = screen.getByRole("button", { name: /Install/i });
    expect(inactive.querySelector("svg")).not.toBeNull();
    expect(inactive).not.toHaveAttribute("aria-current");
  });

  it("inverted variant marks the active item without a glyph prefix", () => {
    renderWithVariant("inverted");
    const active = screen.getByRole("button", { name: "Quickstart" });
    expect(active).toHaveAttribute("aria-current", "page");
    expect(active).toHaveAttribute("data-selected");
    expect(active.textContent).not.toMatch(/[▸▾[\]*]/);
  });

  it("bar variant marks the active item without a glyph prefix", () => {
    renderWithVariant("bar");
    const active = screen.getByRole("button", { name: "Quickstart" });
    expect(active).toHaveAttribute("aria-current", "page");
    expect(active).toHaveAttribute("data-selected");
    expect(active.textContent).not.toMatch(/[▸▾[\]*]/);
  });

  it("terminal variant reserves the chevron prompt slot and marks the active item", () => {
    renderWithVariant("terminal");
    const active = screen.getByRole("button", { name: /Quickstart/i });
    const inactive = screen.getByRole("button", { name: /Install/i });
    expect(active).toHaveAttribute("aria-current", "page");
    expect(active).toHaveAttribute("data-selected");
    expect(active.querySelector("svg")).not.toBeNull();
    expect(inactive.querySelector("svg")).not.toBeNull();
    expect(inactive).not.toHaveAttribute("data-selected");
  });

  it("tree variant renders a chevron fold handle and no connector glyphs in text", () => {
    renderWithVariant("tree");
    expect(screen.getByRole("navigation")).toHaveAttribute("data-variant", "tree");
    const heading = screen.getByRole("heading", { name: /Section/i });
    expect(heading.querySelector("svg")).not.toBeNull();
    expect(heading.textContent).not.toMatch(/[▼▶]/);

    const quickstart = screen.getByRole("button", { name: /Quickstart/i });
    expect(quickstart.textContent).not.toMatch(/[├└─]/);
    expect(quickstart).toHaveAttribute("aria-current", "page");
    expect(quickstart).toHaveAttribute("data-selected");
  });

  it("tree variant keeps fragment-composed items as direct siblings for the connector corner", () => {
    function FragmentItems() {
      return (
        <>
          <Sidebar.Item as="button">Alpha</Sidebar.Item>
          <Sidebar.Item as="button">Beta</Sidebar.Item>
        </>
      );
    }
    render(
      <Sidebar variant="tree">
        <Sidebar.Content>
          <Sidebar.Section>
            <Sidebar.SectionTitle>Section</Sidebar.SectionTitle>
            <Sidebar.SectionContent>
              <FragmentItems />
            </Sidebar.SectionContent>
          </Sidebar.Section>
        </Sidebar.Content>
      </Sidebar>,
    );

    // The └ corner is :last-child driven, so fragments must keep items siblings.
    expect(screen.getByRole("button", { name: /Beta/i }).matches(":last-child")).toBe(true);
    expect(screen.getByRole("button", { name: /Alpha/i }).matches(":last-child")).toBe(false);
  });

  it("keeps a single Primary nav landmark and h3 section title across variants", () => {
    renderWithVariant("bar");
    const nav = screen.getByRole("navigation");
    expect(nav).toHaveAccessibleName("Primary");
    expect(nav).toHaveAttribute("data-variant", "bar");
    expect(screen.getByRole("heading", { level: 3, name: "Section" })).toBeInTheDocument();
  });

  it("has no a11y violations", async () => {
    const { container } = renderWithVariant("caret");
    expect(await axe(container)).toHaveNoViolations();
  });
});

describe("Sidebar rail-mode naming", () => {
  // jsdom loads no stylesheet, so the Tailwind rail-hide toggle never applies
  // and the visible label would double the sr-only copy in the computed name.
  // Replicate that rule via an attribute selector jsdom can match.
  function applyRailHideStyle() {
    const style = document.createElement("style");
    style.textContent =
      '[data-state="rail"] [class~="group-data-[state=rail]/sidebar:hidden"] { display: none; }';
    document.head.appendChild(style);
    return () => style.remove();
  }

  it("exposes the exact label name for icon-only items in rail state", () => {
    const removeRailHideStyle = applyRailHideStyle();
    render(
      <Sidebar.Provider defaultState="rail">
        <Sidebar>
          <Sidebar.Content>
            <Sidebar.Item as="button">
              <span aria-hidden="true">⚙</span>
              <Sidebar.ItemLabel>Settings</Sidebar.ItemLabel>
            </Sidebar.Item>
            <Sidebar.Item href="#dashboard">
              <span aria-hidden="true">D</span>
              <Sidebar.ItemLabel>Dashboard</Sidebar.ItemLabel>
            </Sidebar.Item>
          </Sidebar.Content>
        </Sidebar>
      </Sidebar.Provider>,
    );

    expect(screen.getByRole("navigation")).toHaveAttribute("data-state", "rail");
    expect(screen.getByRole("button", { name: "Settings" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Dashboard" })).toBeInTheDocument();

    removeRailHideStyle();
  });

  it("does not add a rail name copy for render-prop items", () => {
    render(
      <Sidebar.Provider defaultState="rail">
        <Sidebar>
          <Sidebar.Content>
            <Sidebar.Item>
              {({ itemPrefix, ref, ...itemProps }) => (
                <a {...itemProps} ref={ref as Ref<HTMLAnchorElement>} href="#profile">
                  {itemPrefix}
                  <span aria-hidden="true">P</span>
                  <Sidebar.ItemLabel>Profile</Sidebar.ItemLabel>
                </a>
              )}
            </Sidebar.Item>
          </Sidebar.Content>
        </Sidebar>
      </Sidebar.Provider>,
    );

    expect(screen.getByRole("link", { name: "Profile" })).toBeInTheDocument();
  });
});
