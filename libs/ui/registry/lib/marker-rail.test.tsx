import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Checkbox } from "../ui/checkbox";
import { NavigationList } from "../ui/navigation-list";
import { Sidebar } from "../ui/sidebar";
import { Toc } from "../ui/toc";
import { MARKER_RAIL_BASE, MARKER_RAIL_ON_INVERTED, MARKER_RAIL_SELECTED } from "./marker-rail";

/**
 * The rail's public contract is geometric, not decorative: marking a row must
 * never move its label. The base recipe reserves the rail in EVERY state, so
 * these assertions check that each primitive carries it whether or not the row
 * is the current location.
 */
const RAIL_BASE_CLASSES = MARKER_RAIL_BASE.split(" ");

describe("marker rail", () => {
  it("reserves the rail in the resting state so marking a row cannot shift it", () => {
    expect(MARKER_RAIL_BASE).toContain("border-transparent");
    expect(MARKER_RAIL_BASE).toContain("border-l-2");
    expect(MARKER_RAIL_BASE).toContain("-ml-[2px]");
  });

  it("draws the persistent mark in one token", () => {
    expect(MARKER_RAIL_SELECTED).toBe("border-l-primary");
  });

  it("keeps Toc's label geometry identical between states", () => {
    render(
      <Toc aria-label="On this page">
        <Toc.List>
          <Toc.Item href="#one" active>
            One
          </Toc.Item>
          <Toc.Item href="#two">Two</Toc.Item>
        </Toc.List>
      </Toc>,
    );

    expect(screen.getByRole("link", { name: "One" })).toHaveClass(...RAIL_BASE_CLASSES);
    expect(screen.getByRole("link", { name: "Two" })).toHaveClass(...RAIL_BASE_CLASSES);
  });

  it("keeps NavigationList's label geometry identical between states", () => {
    render(
      <NavigationList aria-label="Runs" defaultSelectedId="a">
        <NavigationList.Item id="a">
          <NavigationList.Title>Run A</NavigationList.Title>
        </NavigationList.Item>
        <NavigationList.Item id="b">
          <NavigationList.Title>Run B</NavigationList.Title>
        </NavigationList.Item>
      </NavigationList>,
    );

    for (const name of ["Run A", "Run B"]) {
      expect(screen.getByRole("option", { name })).toHaveClass(...RAIL_BASE_CLASSES);
    }
  });

  it("marks the current NavigationList row with a rail in exactly one token", () => {
    render(
      <NavigationList aria-label="Runs" defaultSelectedId="a">
        <NavigationList.Item id="a">
          <NavigationList.Title>Run A</NavigationList.Title>
        </NavigationList.Item>
      </NavigationList>,
    );

    const selected = screen.getByRole("option", { name: "Run A" });
    expect(selected).toHaveAttribute("data-selected");
    // Inverted while the row is also the transient highlight, plain otherwise —
    // never a second near-black, and never no mark at all. The expected token
    // comes from the rendered state, not from the class under assertion.
    const inverted = selected.hasAttribute("data-highlighted");
    expect(selected).toHaveClass(inverted ? MARKER_RAIL_ON_INVERTED : MARKER_RAIL_SELECTED);
    expect(selected).not.toHaveClass(inverted ? MARKER_RAIL_SELECTED : MARKER_RAIL_ON_INVERTED);
  });

  it("keeps selectable row label geometry identical between states", () => {
    render(
      <>
        <Checkbox label="Apple" highlighted />
        <Checkbox label="Banana" />
      </>,
    );

    const highlighted = screen.getByRole("checkbox", { name: "Apple" });
    const resting = screen.getByRole("checkbox", { name: "Banana" });
    for (const row of [highlighted, resting]) {
      expect(row).toHaveClass(...RAIL_BASE_CLASSES);
    }
    // The collection highlight wears the shared rail, not a private left bar.
    expect(highlighted).toHaveClass(MARKER_RAIL_SELECTED);
    expect(resting).not.toHaveClass(MARKER_RAIL_SELECTED);
  });

  it("keeps Sidebar bar-mode label geometry identical between states", () => {
    render(
      <Sidebar variant="bar">
        <Sidebar.Content>
          <Sidebar.Item as="button" active>
            Alpha
          </Sidebar.Item>
          <Sidebar.Item as="button">Beta</Sidebar.Item>
        </Sidebar.Content>
      </Sidebar>,
    );

    for (const name of ["Alpha", "Beta"]) {
      expect(screen.getByRole("button", { name })).toHaveClass(...RAIL_BASE_CLASSES);
    }
  });
});
