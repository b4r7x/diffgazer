// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { render, screen, within } from "@testing-library/react";
import type { ComponentType, ReactNode } from "react";
import { describe, expect, it } from "vitest";
import { markdownMdxComponents } from "./markdown-renderers";

function renderComponent(tag: keyof typeof markdownMdxComponents, children: ReactNode) {
  const Component = markdownMdxComponents[tag] as ComponentType<{ children?: ReactNode }>;
  return render(<Component>{children}</Component>);
}

describe("markdownMdxComponents", () => {
  it("renders h2 as a section heading that keeps its anchor id and accessible name", () => {
    const H2 = markdownMdxComponents.h2 as ComponentType<{ id?: string; children?: ReactNode }>;
    render(<H2 id="usage">Usage</H2>);

    const heading = screen.getByRole("heading", { level: 2, name: "Usage" });
    expect(heading).toHaveAttribute("id", "usage");
  });

  it("wraps tables in a focusable named scroll region", () => {
    renderComponent(
      "table",
      <tbody>
        <tr>
          <td>cell</td>
        </tr>
      </tbody>,
    );

    const region = screen.getByRole("region", { name: "Scrollable table" });
    expect(region).toHaveAttribute("tabindex", "0");
    expect(within(region).getByRole("table")).toBeInTheDocument();
  });

  it("exposes an explicit list role on unordered lists", () => {
    renderComponent("ul", <li>item</li>);
    expect(screen.getByRole("list")).toBeInTheDocument();
  });

  it("exposes an explicit list role on ordered lists", () => {
    renderComponent("ol", <li>item</li>);
    expect(screen.getByRole("list")).toBeInTheDocument();
  });

  it("opens external links in a new tab with a safe rel", () => {
    const A = markdownMdxComponents.a as ComponentType<{ href?: string; children?: ReactNode }>;
    render(<A href="https://example.com/guide">Guide</A>);

    const link = screen.getByRole("link", { name: "Guide" });
    expect(link).toHaveAttribute("href", "https://example.com/guide");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link.getAttribute("rel")).toContain("noopener");
    expect(link.getAttribute("rel")).toContain("noreferrer");
  });

  it("keeps internal links in the same tab without a rel attribute", () => {
    const A = markdownMdxComponents.a as ComponentType<{ href?: string; children?: ReactNode }>;
    render(<A href="/docs/components/button">Button</A>);

    const link = screen.getByRole("link", { name: "Button" });
    expect(link).toHaveAttribute("href", "/docs/components/button");
    expect(link).not.toHaveAttribute("target");
    expect(link).not.toHaveAttribute("rel");
  });
});
