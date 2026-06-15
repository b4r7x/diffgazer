// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import type { ComponentType, ReactNode } from "react";
import { describe, expect, it } from "vitest";
import { markdownMdxComponents } from "./markdown-renderers";

function renderComponent(tag: keyof typeof markdownMdxComponents, children: ReactNode) {
  const Component = markdownMdxComponents[tag] as ComponentType<{ children?: ReactNode }>;
  return render(<Component>{children}</Component>);
}

describe("markdownMdxComponents", () => {
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
    expect(region.querySelector("table")).toBeInTheDocument();
  });

  it("exposes an explicit list role on unordered lists", () => {
    renderComponent("ul", <li>item</li>);
    expect(screen.getByRole("list")).toBeInTheDocument();
  });

  it("exposes an explicit list role on ordered lists", () => {
    renderComponent("ol", <li>item</li>);
    expect(screen.getByRole("list")).toBeInTheDocument();
  });
});
