import { render, screen } from "@testing-library/react";
import { Fragment } from "react";
import { describe, expect, it, vi } from "vitest";
import { axe } from "../../../testing/axe";
import { Breadcrumbs } from "./index";

describe("Breadcrumbs", () => {
  it("renders as navigation with correct aria-label", () => {
    render(
      <Breadcrumbs>
        <Breadcrumbs.Item>
          <Breadcrumbs.Link href="/">Home</Breadcrumbs.Link>
        </Breadcrumbs.Item>
        <Breadcrumbs.Item>
          <Breadcrumbs.Link href="/about">About</Breadcrumbs.Link>
        </Breadcrumbs.Item>
      </Breadcrumbs>,
    );
    const nav = screen.getByRole("navigation");
    expect(nav).toHaveAttribute("aria-label", "Breadcrumb");
  });

  it("renders items in a list", () => {
    render(
      <Breadcrumbs>
        <Breadcrumbs.Item>
          <Breadcrumbs.Link href="/">Home</Breadcrumbs.Link>
        </Breadcrumbs.Item>
        <Breadcrumbs.Item>
          <Breadcrumbs.Link href="/about">About</Breadcrumbs.Link>
        </Breadcrumbs.Item>
      </Breadcrumbs>,
    );
    const list = screen.getByRole("list");
    const items = screen.getAllByRole("listitem");

    expect(list.tagName).toBe("OL");
    expect(items).toHaveLength(2);
    expect(screen.getByRole("link", { name: "Home" })).toHaveAttribute("href", "/");
    expect(screen.getByRole("link", { name: "About" })).toHaveAttribute("href", "/about");
  });

  it("marks the final item as the current page by default", () => {
    render(
      <Breadcrumbs>
        <Breadcrumbs.Item>
          <Breadcrumbs.Link href="/">Home</Breadcrumbs.Link>
        </Breadcrumbs.Item>
        <Breadcrumbs.Item>About</Breadcrumbs.Item>
      </Breadcrumbs>,
    );
    const items = screen.getAllByRole("listitem");
    expect(items[1]).toHaveAttribute("aria-current", "page");
    expect(items[1]?.querySelector("[aria-current]")).toBeNull();
  });

  it("uses the explicit current item when provided", () => {
    render(
      <Breadcrumbs>
        <Breadcrumbs.Item>
          <Breadcrumbs.Link href="/">Home</Breadcrumbs.Link>
        </Breadcrumbs.Item>
        <Breadcrumbs.Item current>About</Breadcrumbs.Item>
        <Breadcrumbs.Item>Details</Breadcrumbs.Item>
      </Breadcrumbs>,
    );
    const items = screen.getAllByRole("listitem");
    expect(items[1]).toHaveAttribute("aria-current", "page");
    expect(items[1]?.querySelector("[aria-current]")).toBeNull();
    expect(items[2]).not.toHaveAttribute("aria-current");
  });

  it("marks a current item whose label is an element", () => {
    render(
      <Breadcrumbs>
        <Breadcrumbs.Item>
          <Breadcrumbs.Link href="/">Home</Breadcrumbs.Link>
        </Breadcrumbs.Item>
        <Breadcrumbs.Item current>
          <strong>About</strong>
        </Breadcrumbs.Item>
      </Breadcrumbs>,
    );

    const currentItem = screen.getByText("About").closest("li");
    expect(currentItem).toHaveAttribute("aria-current", "page");
    expect(screen.getByText("About")).not.toHaveAttribute("aria-current");
  });

  it("auto-marks the final item inside a Fragment", () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    try {
      render(
        <Breadcrumbs>
          <Breadcrumbs.Item>
            <Breadcrumbs.Link href="/">Home</Breadcrumbs.Link>
          </Breadcrumbs.Item>
          {/* biome-ignore lint/complexity/noUselessFragments: the Fragment is the regression input for automatic current-item selection. */}
          <>
            <Breadcrumbs.Item>
              <span>About</span>
            </Breadcrumbs.Item>
          </>
        </Breadcrumbs>,
      );

      expect(screen.getByText("About").closest("li")).toHaveAttribute("aria-current", "page");
      expect(consoleError).not.toHaveBeenCalled();
    } finally {
      consoleError.mockRestore();
    }
  });

  it("preserves keyed item identity across nested Fragment reordering", () => {
    const entries = [
      { id: "first", label: "First" },
      { id: "second", label: "Second" },
    ];

    function KeyedBreadcrumbs({ reversed }: { reversed: boolean }) {
      const orderedEntries = reversed ? [...entries].reverse() : entries;
      return (
        <Breadcrumbs>
          {orderedEntries.map((entry) => (
            <Fragment key={`group-${entry.id}`}>
              {/* biome-ignore lint/complexity/noUselessFragments: nested Fragment key namespaces are the regression input. */}
              <>
                <Breadcrumbs.Item key="item">
                  <span>{entry.label}</span>
                </Breadcrumbs.Item>
              </>
            </Fragment>
          ))}
        </Breadcrumbs>
      );
    }

    const { rerender } = render(<KeyedBreadcrumbs reversed={false} />);
    const firstItem = screen.getByText("First").closest("li");
    const secondItem = screen.getByText("Second").closest("li");

    rerender(<KeyedBreadcrumbs reversed />);

    expect(screen.getByText("First").closest("li")).toBe(firstItem);
    expect(screen.getByText("Second").closest("li")).toBe(secondItem);
    expect(firstItem).toHaveAttribute("aria-current", "page");
    expect(secondItem).not.toHaveAttribute("aria-current");
  });

  it("marks the current breadcrumb link instead of the list item", () => {
    render(
      <Breadcrumbs>
        <Breadcrumbs.Item>
          <Breadcrumbs.Link href="/">Home</Breadcrumbs.Link>
        </Breadcrumbs.Item>
        <Breadcrumbs.Item current>
          <Breadcrumbs.Link href="/about">About</Breadcrumbs.Link>
        </Breadcrumbs.Item>
      </Breadcrumbs>,
    );

    expect(screen.getByRole("link", { name: "About" })).toHaveAttribute("aria-current", "page");
    expect(screen.getAllByRole("listitem")[1]).not.toHaveAttribute("aria-current");
  });

  it("uses custom separator", () => {
    const { container } = render(
      <Breadcrumbs separator="|">
        <Breadcrumbs.Item>
          <Breadcrumbs.Link href="/">Home</Breadcrumbs.Link>
        </Breadcrumbs.Item>
        <Breadcrumbs.Item>
          <Breadcrumbs.Link href="/about">About</Breadcrumbs.Link>
        </Breadcrumbs.Item>
      </Breadcrumbs>,
    );
    expect(container.textContent).toContain("|");
  });

  it("has no a11y violations", async () => {
    const { container } = render(
      <Breadcrumbs>
        <Breadcrumbs.Item>
          <Breadcrumbs.Link href="/">Home</Breadcrumbs.Link>
        </Breadcrumbs.Item>
        <Breadcrumbs.Item>
          <Breadcrumbs.Link href="/products">Products</Breadcrumbs.Link>
        </Breadcrumbs.Item>
        <Breadcrumbs.Item current>Widget</Breadcrumbs.Item>
      </Breadcrumbs>,
    );
    expect(await axe(container)).toHaveNoViolations();
  });

  it("supports render props for custom item rendering", () => {
    render(
      <Breadcrumbs>
        <Breadcrumbs.Item>
          <Breadcrumbs.Link href="/">{(props) => <a {...props}>Custom Home</a>}</Breadcrumbs.Link>
        </Breadcrumbs.Item>
      </Breadcrumbs>,
    );
    expect(screen.getByText("Custom Home")).toBeInTheDocument();
  });

  it("exposes sr-only 'More' on the ellipsis while keeping the glyph decorative", () => {
    render(
      <Breadcrumbs>
        <Breadcrumbs.Item>
          <Breadcrumbs.Link href="/">Home</Breadcrumbs.Link>
        </Breadcrumbs.Item>
        <Breadcrumbs.Item>
          <Breadcrumbs.Ellipsis />
        </Breadcrumbs.Item>
        <Breadcrumbs.Item>
          <Breadcrumbs.Link href="/now">Now</Breadcrumbs.Link>
        </Breadcrumbs.Item>
      </Breadcrumbs>,
    );
    const more = screen.getByText("More");
    expect(more.closest('[aria-hidden="true"]')).toBeNull();
    expect(screen.getByText("...")).toHaveAttribute("aria-hidden", "true");
  });
});
