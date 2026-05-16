import { createRef } from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { axe } from "../../../testing/utils.js";
import { Panel } from "./index.js";

describe("Panel", () => {
  it("forwards refs to the selected element", () => {
    const ref = createRef<HTMLElement>();

    render(
      <Panel as="section" ref={ref} aria-label="Release">
        Notes
      </Panel>,
    );

    expect(ref.current).toBe(screen.getByRole("region", { name: "Release" }));
  });

  it("renders a floating legend as a composable panel part", () => {
    render(
      <Panel>
        <Panel.Legend tone="success">Settings Hub</Panel.Legend>
        <Panel.Content>Body</Panel.Content>
      </Panel>,
    );

    expect(screen.getByText("Settings Hub")).toBeInTheDocument();
    expect(screen.getByText("Body")).toBeInTheDocument();
  });

  it("has no a11y violations", async () => {
    const { container } = render(
      <Panel as="section" aria-label="Release">
        <Panel.Legend tone="success">Settings Hub</Panel.Legend>
        <Panel.Content>Body</Panel.Content>
      </Panel>,
    );

    expect(await axe(container)).toHaveNoViolations();
  });
});
