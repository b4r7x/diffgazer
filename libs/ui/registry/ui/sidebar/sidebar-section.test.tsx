import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRef } from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { axe } from "../../../testing/axe";
import { requireAttribute, requireElement } from "../../testing/assertions";
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

  it("keeps the aria-labelledby value from an external label after a direct title registers", () => {
    render(
      <Sidebar.Section aria-labelledby="external-label">
        <span id="external-label">Workspace</span>
        <Sidebar.SectionTitle id="section-title">Files</Sidebar.SectionTitle>
      </Sidebar.Section>,
    );

    expect(screen.getByRole("group", { name: "Workspace" })).toHaveAttribute(
      "aria-labelledby",
      "external-label",
    );
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

describe("SidebarSection collapsible", () => {
  it("forwards native div props to the section content panel", () => {
    const ref = createRef<HTMLDivElement>();
    render(
      <Sidebar.Provider>
        <Sidebar>
          <Sidebar.Content>
            <Sidebar.Section>
              <Sidebar.SectionContent
                ref={ref}
                className="consumer-panel"
                data-testid="section-panel"
              >
                Content
              </Sidebar.SectionContent>
            </Sidebar.Section>
          </Sidebar.Content>
        </Sidebar>
      </Sidebar.Provider>,
    );

    const panel = screen.getByTestId("section-panel");
    expect(ref.current).toBe(panel);
    expect(panel).toHaveClass("consumer-panel");
    expect(panel.querySelector('[data-slot="sidebar-section-content-inner"]')).not.toHaveClass(
      "consumer-panel",
    );
  });

  it("does not reference a missing section title", () => {
    render(
      <Sidebar.Provider>
        <Sidebar>
          <Sidebar.Content>
            <Sidebar.Section>
              <Sidebar.Item>Item</Sidebar.Item>
            </Sidebar.Section>
          </Sidebar.Content>
        </Sidebar>
      </Sidebar.Provider>,
    );

    expect(screen.getByRole("group")).not.toHaveAttribute("aria-labelledby");
  });

  it("toggles section open/closed with aria-expanded", async () => {
    const user = userEvent.setup();
    render(
      <Sidebar.Provider>
        <Sidebar>
          <Sidebar.Content>
            <Sidebar.Section collapsible>
              <Sidebar.SectionTitle>Files</Sidebar.SectionTitle>
              <Sidebar.Item>file.txt</Sidebar.Item>
            </Sidebar.Section>
          </Sidebar.Content>
        </Sidebar>
      </Sidebar.Provider>,
    );
    const title = screen.getByRole("button", { name: "Files" });
    expect(title).toHaveAttribute("aria-expanded", "true");

    await user.click(title);
    expect(title).toHaveAttribute("aria-expanded", "false");
  });

  it("toggles aria-hidden and inert on the section panel when collapsed", async () => {
    const user = userEvent.setup();
    render(
      <Sidebar.Provider>
        <Sidebar>
          <Sidebar.Content>
            <Sidebar.Section collapsible>
              <Sidebar.SectionTitle>Files</Sidebar.SectionTitle>
              <Sidebar.SectionContent>
                <Sidebar.Item>file.txt</Sidebar.Item>
              </Sidebar.SectionContent>
            </Sidebar.Section>
          </Sidebar.Content>
        </Sidebar>
      </Sidebar.Provider>,
    );
    const title = screen.getByRole("button", { name: "Files" });
    const panelId = requireAttribute(title, "aria-controls");
    const panel = requireElement(document.getElementById(panelId), "sidebar panel");

    expect(panel).not.toHaveAttribute("aria-hidden");
    expect(panel).not.toHaveAttribute("inert");

    await user.click(title);

    // Collapsed: panel stays in DOM for the transition but leaves the a11y tree
    // and tab order.
    expect(panel).toHaveAttribute("aria-hidden", "true");
    expect(panel).toHaveAttribute("inert");
  });

  it("keeps a collapsible section open when title click is prevented", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn((event: { preventDefault: () => void }) => event.preventDefault());
    render(
      <Sidebar.Provider>
        <Sidebar>
          <Sidebar.Content>
            <Sidebar.Section collapsible>
              <Sidebar.SectionTitle onClick={onClick}>Files</Sidebar.SectionTitle>
              <Sidebar.Item>file.txt</Sidebar.Item>
            </Sidebar.Section>
          </Sidebar.Content>
        </Sidebar>
      </Sidebar.Provider>,
    );
    const title = screen.getByRole("button", { name: "Files" });

    await user.click(title);

    expect(onClick).toHaveBeenCalled();
    expect(title).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText("file.txt")).toBeInTheDocument();
  });

  it("uses a single navigation landmark by default", async () => {
    render(
      <Sidebar.Provider>
        <Sidebar>
          <Sidebar.Content>
            <Sidebar.Item>Item</Sidebar.Item>
          </Sidebar.Content>
        </Sidebar>
      </Sidebar.Provider>,
    );
    const navs = screen.getAllByRole("navigation");
    expect(navs).toHaveLength(1);
    expect(navs[0]).toHaveAccessibleName("Primary");
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });

  it("renders the section title as a real h3 heading", () => {
    render(
      <Sidebar.Provider>
        <Sidebar>
          <Sidebar.Content>
            <Sidebar.Section>
              <Sidebar.SectionTitle>Components</Sidebar.SectionTitle>
              <Sidebar.Item>Button</Sidebar.Item>
            </Sidebar.Section>
          </Sidebar.Content>
        </Sidebar>
      </Sidebar.Provider>,
    );
    expect(screen.getByRole("heading", { level: 3, name: "Components" })).toBeInTheDocument();
  });

  it("renders the section title at a custom heading level", () => {
    render(
      <Sidebar.Provider>
        <Sidebar>
          <Sidebar.Content>
            <Sidebar.Section>
              <Sidebar.SectionTitle headingLevel="h2">Top</Sidebar.SectionTitle>
              <Sidebar.Item>Item</Sidebar.Item>
            </Sidebar.Section>
          </Sidebar.Content>
        </Sidebar>
      </Sidebar.Provider>,
    );
    expect(screen.getByRole("heading", { level: 2, name: "Top" })).toBeInTheDocument();
  });
});
