import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { axe } from "../../../testing/axe";
import { Toc } from "./index";

describe("Toc", () => {
  it("renders a named navigation landmark with list semantics", () => {
    render(
      <Toc title="Contents">
        <Toc.List>
          <Toc.Item href="#intro" active>
            Intro
          </Toc.Item>
          <Toc.Item href="#usage">Usage</Toc.Item>
        </Toc.List>
      </Toc>,
    );

    expect(screen.getByRole("navigation", { name: "Contents" })).toBeInTheDocument();
    expect(screen.getByRole("list")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Intro" })).toHaveAttribute("aria-current", "location");
  });

  it("keeps item semantics when children render the anchor", () => {
    render(
      <Toc title="Contents">
        <Toc.List>
          <Toc.Item active>
            {(props) => (
              <a {...props} href="#api">
                API
              </a>
            )}
          </Toc.Item>
        </Toc.List>
      </Toc>,
    );

    const link = screen.getByRole("link", { name: "API" });
    expect(screen.getByRole("listitem")).toContainElement(link);
    expect(link).toHaveAttribute("href", "#api");
    expect(link).toHaveAttribute("aria-current", "location");
  });

  it("has no a11y violations", async () => {
    const { container } = render(
      <Toc title="Contents">
        <Toc.List>
          <Toc.Item href="#intro" active>
            Intro
          </Toc.Item>
          <Toc.Item href="#usage">Usage</Toc.Item>
        </Toc.List>
      </Toc>,
    );

    expect(await axe(container)).toHaveNoViolations();
  });
});
