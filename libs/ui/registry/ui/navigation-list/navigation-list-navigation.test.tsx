import { testNavigationBehavior } from "@diffgazer/keys/testing/navigation-behavior";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { axe } from "../../../testing/axe";
import { NavigationList } from "./index";

describe("NavigationList keyboard navigation", () => {
  testNavigationBehavior({
    setup: () => {
      const rendered = render(
        <NavigationList aria-label="Test nav" defaultHighlighted="one">
          <NavigationList.Item id="one">
            <NavigationList.Title>One</NavigationList.Title>
          </NavigationList.Item>
          <NavigationList.Item id="two">
            <NavigationList.Title>Two</NavigationList.Title>
          </NavigationList.Item>
          <NavigationList.Item id="three">
            <NavigationList.Title>Three</NavigationList.Title>
          </NavigationList.Item>
        </NavigationList>,
      );
      screen.getByRole("listbox").focus();
      return rendered;
    },
    items: ["one", "two", "three"],
    initialActive: 0,
    cases: [
      { key: "{ArrowDown}", expectedActiveIndex: 1, label: "ArrowDown" },
      { key: "{ArrowDown}{ArrowDown}", expectedActiveIndex: 2, label: "ArrowDown ArrowDown" },
      {
        key: "{ArrowDown}{ArrowDown}{ArrowDown}",
        expectedActiveIndex: 0,
        label: "ArrowDown wraps to start",
      },
      { key: "{ArrowUp}", expectedActiveIndex: 2, label: "ArrowUp wraps to end" },
      { key: "{End}", expectedActiveIndex: 2, label: "End jumps to last" },
      { key: "{Home}", expectedActiveIndex: 0, label: "Home stays at first" },
    ],
  });

  it("has no a11y violations", async () => {
    const { container } = render(
      <NavigationList aria-label="Test nav" defaultHighlighted="one">
        <NavigationList.Item id="one">
          <NavigationList.Title>One</NavigationList.Title>
        </NavigationList.Item>
        <NavigationList.Item id="two">
          <NavigationList.Title>Two</NavigationList.Title>
        </NavigationList.Item>
        <NavigationList.Item id="three">
          <NavigationList.Title>Three</NavigationList.Title>
        </NavigationList.Item>
      </NavigationList>,
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});
