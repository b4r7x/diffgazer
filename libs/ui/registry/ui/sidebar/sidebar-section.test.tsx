import { render, screen } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { axe } from "../../../testing/axe";
import { Sidebar } from "./index";

function OpaqueSectionTitle({ id }: { id?: string }) {
  return <Sidebar.SectionTitle id={id}>Workspace</Sidebar.SectionTitle>;
}

describe("Sidebar.Section", () => {
  it("keeps an accessible name when an opaque wrapper renders the title", async () => {
    const { container } = render(
      <Sidebar embedded>
        <Sidebar.Content>
          <Sidebar.Section>
            <OpaqueSectionTitle />
            <Sidebar.Item href="/files">Files</Sidebar.Item>
          </Sidebar.Section>
        </Sidebar.Content>
      </Sidebar>,
    );

    const title = screen.getByRole("heading", { name: "Workspace" });
    expect(screen.getByRole("group", { name: "Workspace" })).toHaveAttribute(
      "aria-labelledby",
      title.id,
    );
    expect(await axe(container)).toHaveNoViolations();
  });

  it("removes an opaque title id when that title unmounts", () => {
    function Fixture({ showTitle }: { showTitle: boolean }) {
      return (
        <Sidebar.Section>
          {showTitle ? <OpaqueSectionTitle /> : null}
          <span>Files</span>
        </Sidebar.Section>
      );
    }

    const { rerender } = render(<Fixture showTitle />);
    const group = screen.getByRole("group", { name: "Workspace" });
    const titleId = screen.getByRole("heading", { name: "Workspace" }).id;
    expect(group).toHaveAttribute("aria-labelledby", titleId);

    rerender(<Fixture showTitle={false} />);

    expect(screen.getByRole("group")).not.toHaveAttribute("aria-labelledby");
  });

  it("keeps an explicit opaque title id wired during server rendering", () => {
    const html = renderToString(
      <Sidebar.Section aria-labelledby="workspace-title">
        <OpaqueSectionTitle id="workspace-title" />
      </Sidebar.Section>,
    );

    expect(html).toContain('aria-labelledby="workspace-title"');
    expect(html).toContain('id="workspace-title"');
  });

  it("does not claim a nested section title as the outer section label", () => {
    const { container } = render(
      <Sidebar.Section>
        <Sidebar.Section>
          <Sidebar.SectionTitle>Nested</Sidebar.SectionTitle>
        </Sidebar.Section>
      </Sidebar.Section>,
    );

    const groups = container.querySelectorAll('[role="group"]');
    expect(groups[0]).not.toHaveAttribute("aria-labelledby");
    expect(groups[1]).toHaveAttribute(
      "aria-labelledby",
      screen.getByRole("heading", { name: "Nested" }).id,
    );
  });
});
