import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { axe } from "../../../testing/axe";
import { NavigationList } from "./index";

describe("NavigationList.Progress", () => {
  it("has aria-valuenow matching value prop", () => {
    render(
      <NavigationList aria-label="Test nav">
        <NavigationList.Item id="one">
          <NavigationList.Title>One</NavigationList.Title>
          <NavigationList.Meta>
            <NavigationList.Progress value={73} />
          </NavigationList.Meta>
        </NavigationList.Item>
      </NavigationList>,
    );
    const bar = screen.getByRole("progressbar");
    expect(bar).toHaveAttribute("aria-valuenow", "73");
  });

  it("has aria-valuemin=0 and aria-valuemax=100", () => {
    render(
      <NavigationList aria-label="Test nav">
        <NavigationList.Item id="one">
          <NavigationList.Title>One</NavigationList.Title>
          <NavigationList.Meta>
            <NavigationList.Progress value={50} />
          </NavigationList.Meta>
        </NavigationList.Item>
      </NavigationList>,
    );
    const bar = screen.getByRole("progressbar");
    expect(bar).toHaveAttribute("aria-valuemin", "0");
    expect(bar).toHaveAttribute("aria-valuemax", "100");
  });

  it("block variant renders █ and ░ characters", () => {
    render(
      <NavigationList aria-label="Test nav">
        <NavigationList.Item id="one">
          <NavigationList.Title>One</NavigationList.Title>
          <NavigationList.Meta>
            <NavigationList.Progress value={50} variant="block" width={10} />
          </NavigationList.Meta>
        </NavigationList.Item>
      </NavigationList>,
    );
    const bar = screen.getByRole("progressbar");
    expect(bar.textContent).toContain("█████");
    expect(bar.textContent).toContain("░░░░░");
  });

  it("bar variant renders = and - characters inside [ ]", () => {
    render(
      <NavigationList aria-label="Test nav">
        <NavigationList.Item id="one">
          <NavigationList.Title>One</NavigationList.Title>
          <NavigationList.Meta>
            <NavigationList.Progress value={50} variant="bar" width={10} />
          </NavigationList.Meta>
        </NavigationList.Item>
      </NavigationList>,
    );
    const bar = screen.getByRole("progressbar");
    expect(bar.textContent).toContain("[=====-----]");
  });

  it.each([
    { width: 4.9, renderedBar: "[==--]" },
    { width: -1, renderedBar: "[]" },
    { width: Number.NaN, renderedBar: "[]" },
    { width: Number.POSITIVE_INFINITY, renderedBar: "[]" },
    { width: Number.NEGATIVE_INFINITY, renderedBar: "[]" },
  ])("normalizes width=$width before rendering", ({ width, renderedBar }) => {
    render(
      <NavigationList aria-label="Test nav">
        <NavigationList.Item id="one">
          <NavigationList.Title>One</NavigationList.Title>
          <NavigationList.Meta>
            <NavigationList.Progress value={50} variant="bar" width={width} />
          </NavigationList.Meta>
        </NavigationList.Item>
      </NavigationList>,
    );

    expect(screen.getByRole("progressbar")).toHaveTextContent(renderedBar);
  });

  it("shows percentage label by default", () => {
    render(
      <NavigationList aria-label="Test nav">
        <NavigationList.Item id="one">
          <NavigationList.Title>One</NavigationList.Title>
          <NavigationList.Meta>
            <NavigationList.Progress value={50} />
          </NavigationList.Meta>
        </NavigationList.Item>
      </NavigationList>,
    );
    expect(screen.getByRole("progressbar").textContent).toContain("50%");
  });

  it("hides percentage label when showLabel=false", () => {
    render(
      <NavigationList aria-label="Test nav">
        <NavigationList.Item id="one">
          <NavigationList.Title>One</NavigationList.Title>
          <NavigationList.Meta>
            <NavigationList.Progress value={50} showLabel={false} />
          </NavigationList.Meta>
        </NavigationList.Item>
      </NavigationList>,
    );
    expect(screen.getByRole("progressbar").textContent).not.toContain("%");
  });

  it("color auto applies correct color based on value thresholds", () => {
    const { rerender } = render(
      <NavigationList aria-label="Test nav">
        <NavigationList.Item id="one">
          <NavigationList.Title>One</NavigationList.Title>
          <NavigationList.Meta>
            <NavigationList.Progress value={0} />
          </NavigationList.Meta>
        </NavigationList.Item>
      </NavigationList>,
    );
    expect(screen.getByRole("progressbar")).toHaveAttribute("data-color", "muted");

    rerender(
      <NavigationList aria-label="Test nav">
        <NavigationList.Item id="one">
          <NavigationList.Title>One</NavigationList.Title>
          <NavigationList.Meta>
            <NavigationList.Progress value={30} />
          </NavigationList.Meta>
        </NavigationList.Item>
      </NavigationList>,
    );
    expect(screen.getByRole("progressbar")).toHaveAttribute("data-color", "error");

    rerender(
      <NavigationList aria-label="Test nav">
        <NavigationList.Item id="one">
          <NavigationList.Title>One</NavigationList.Title>
          <NavigationList.Meta>
            <NavigationList.Progress value={60} />
          </NavigationList.Meta>
        </NavigationList.Item>
      </NavigationList>,
    );
    expect(screen.getByRole("progressbar")).toHaveAttribute("data-color", "warning");

    rerender(
      <NavigationList aria-label="Test nav">
        <NavigationList.Item id="one">
          <NavigationList.Title>One</NavigationList.Title>
          <NavigationList.Meta>
            <NavigationList.Progress value={90} />
          </NavigationList.Meta>
        </NavigationList.Item>
      </NavigationList>,
    );
    expect(screen.getByRole("progressbar")).toHaveAttribute("data-color", "success");
  });

  it("explicit color prop overrides auto", () => {
    render(
      <NavigationList aria-label="Test nav">
        <NavigationList.Item id="one">
          <NavigationList.Title>One</NavigationList.Title>
          <NavigationList.Meta>
            <NavigationList.Progress value={90} color="error" />
          </NavigationList.Meta>
        </NavigationList.Item>
      </NavigationList>,
    );
    expect(screen.getByRole("progressbar")).toHaveAttribute("data-color", "error");
  });

  it("has no a11y violations with progress bars", async () => {
    const { container } = render(
      <NavigationList aria-label="Test nav">
        <NavigationList.Item id="one">
          <NavigationList.Title>Build</NavigationList.Title>
          <NavigationList.Meta>
            <NavigationList.Progress value={80} />
          </NavigationList.Meta>
        </NavigationList.Item>
        <NavigationList.Item id="two">
          <NavigationList.Title>Test</NavigationList.Title>
          <NavigationList.Meta>
            <NavigationList.Progress value={40} variant="bar" />
          </NavigationList.Meta>
        </NavigationList.Item>
      </NavigationList>,
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});
