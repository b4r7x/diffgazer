import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { axe } from "../../../testing/axe";
import { navigationListDoc } from "../../component-docs/navigation-list";
import { NavigationList } from "./index";

describe("NavigationListGroup", () => {
  function expectDocumentedGroupKey(key: string) {
    const documentedKeys = navigationListDoc.keyboard?.keys ?? [];
    expect(documentedKeys.some((entry) => entry.keys.includes(key))).toBe(true);
  }

  it("section variant renders header with label text", () => {
    render(
      <NavigationList aria-label="Test nav">
        <NavigationList.Group label="Pull Requests">
          <NavigationList.Item id="one">
            <NavigationList.Title>One</NavigationList.Title>
          </NavigationList.Item>
        </NavigationList.Group>
      </NavigationList>,
    );

    expect(screen.getByText("Pull Requests")).toBeInTheDocument();
  });

  it("section header shows count when provided", () => {
    render(
      <NavigationList aria-label="Test nav">
        <NavigationList.Group label="Issues" count={4}>
          <NavigationList.Item id="one">
            <NavigationList.Title>One</NavigationList.Title>
          </NavigationList.Item>
        </NavigationList.Group>
      </NavigationList>,
    );

    expect(screen.getByText("(4)")).toBeInTheDocument();
  });

  it("section group exposes a labelled collapse control and options", () => {
    render(
      <NavigationList aria-label="Test nav">
        <NavigationList.Group label="Section">
          <NavigationList.Item id="one">
            <NavigationList.Title>One</NavigationList.Title>
          </NavigationList.Item>
        </NavigationList.Group>
      </NavigationList>,
    );

    expect(screen.getByRole("option", { name: /Section, collapse section/i })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "One" })).toBeInTheDocument();
  });

  it("click on header toggles expanded/collapsed", async () => {
    const user = userEvent.setup();
    render(
      <NavigationList aria-label="Test nav">
        <NavigationList.Group label="Section">
          <NavigationList.Item id="one">
            <NavigationList.Title>One</NavigationList.Title>
          </NavigationList.Item>
        </NavigationList.Group>
      </NavigationList>,
    );

    const header = screen.getByRole("option", { name: /Section/i });
    expect(screen.getByRole("option", { name: "One" })).toBeInTheDocument();

    await user.click(header);
    expect(screen.queryByRole("option", { name: "One" })).not.toBeInTheDocument();

    await user.click(header);
    expect(screen.getByRole("option", { name: "One" })).toBeInTheDocument();
  });

  it("exposes section headers as keyboard-accessible collapse controls", async () => {
    const user = userEvent.setup();
    render(
      <NavigationList aria-label="Test nav" defaultHighlighted="section-header">
        <NavigationList.Group label="Section" count={2} headerId="section-header">
          <NavigationList.Item id="one">
            <NavigationList.Title>One</NavigationList.Title>
          </NavigationList.Item>
        </NavigationList.Group>
      </NavigationList>,
    );

    const listbox = screen.getByRole("listbox");
    const header = screen.getByRole("option", { name: /Section \(2\), collapse section/i });
    expect(header).toHaveAttribute("data-value", "section-header");
    expect(header).toHaveAttribute("data-expanded", "true");

    listbox.focus();
    await user.keyboard("{Enter}");
    expect(header).toHaveAttribute("data-expanded", "false");
    expect(screen.queryByRole("option", { name: "One" })).not.toBeInTheDocument();

    await user.keyboard("{Enter}");
    expect(header).toHaveAttribute("data-expanded", "true");
    expect(screen.getByRole("option", { name: "One" })).toBeInTheDocument();
  });

  it("gives duplicate labels independent identity, navigation, and keyboard toggles", async () => {
    const user = userEvent.setup();
    render(
      <NavigationList aria-label="Test nav">
        <NavigationList.Group label="Repeated">
          <NavigationList.Item id="first-item">
            <NavigationList.Title>First item</NavigationList.Title>
          </NavigationList.Item>
        </NavigationList.Group>
        <NavigationList.Group label="Repeated">
          <NavigationList.Item id="second-item">
            <NavigationList.Title>Second item</NavigationList.Title>
          </NavigationList.Item>
        </NavigationList.Group>
      </NavigationList>,
    );

    const listbox = screen.getByRole("listbox");
    const headers = screen.getAllByRole("option", { name: /Repeated, collapse section/i });
    expect(headers).toHaveLength(2);
    const [firstHeader, secondHeader] = headers;
    if (!firstHeader || !secondHeader) throw new Error("Expected two duplicate-label headers");
    expect(firstHeader.id).not.toBe(secondHeader.id);
    expect(firstHeader.dataset.value).not.toBe(secondHeader.dataset.value);

    await user.click(firstHeader);
    expect(listbox).toHaveAttribute("aria-activedescendant", firstHeader.id);
    expect(firstHeader).toHaveAttribute("data-expanded", "false");
    expect(secondHeader).toHaveAttribute("data-expanded", "true");

    await user.keyboard("{ArrowDown}{Enter}");
    expect(listbox).toHaveAttribute("aria-activedescendant", secondHeader.id);
    expect(firstHeader).toHaveAttribute("data-expanded", "false");
    expect(secondHeader).toHaveAttribute("data-expanded", "false");

    await user.keyboard("{ArrowUp}{Enter}");
    expect(listbox).toHaveAttribute("aria-activedescendant", firstHeader.id);
    expect(firstHeader).toHaveAttribute("data-expanded", "true");
    expect(secondHeader).toHaveAttribute("data-expanded", "false");
  });

  it("collapsed group hides children", () => {
    render(
      <NavigationList aria-label="Test nav">
        <NavigationList.Group label="Section" defaultExpanded={false}>
          <NavigationList.Item id="one">
            <NavigationList.Title>One</NavigationList.Title>
          </NavigationList.Item>
        </NavigationList.Group>
      </NavigationList>,
    );

    expect(screen.queryByRole("option", { name: "One" })).not.toBeInTheDocument();
  });

  it("preserves a keyed nested group's disclosure state when siblings reorder", async () => {
    const user = userEvent.setup();

    function ReorderableGroups() {
      const [groups, setGroups] = useState(["Alpha", "Beta"]);

      return (
        <>
          <button type="button" onClick={() => setGroups((current) => current.toReversed())}>
            Reverse groups
          </button>
          <NavigationList aria-label="Test nav">
            <NavigationList.Group label="Root" variant="tree">
              {groups.map((group) => (
                <NavigationList.Group key={group} label={group} variant="tree">
                  <NavigationList.Item id={`${group}-item`}>
                    <NavigationList.Title>{group} item</NavigationList.Title>
                  </NavigationList.Item>
                </NavigationList.Group>
              ))}
            </NavigationList.Group>
          </NavigationList>
        </>
      );
    }

    render(<ReorderableGroups />);
    await user.click(screen.getByRole("option", { name: "Alpha, collapse section" }));
    expect(screen.queryByRole("option", { name: "Alpha item" })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Reverse groups" }));

    expect(screen.getByRole("option", { name: "Alpha, expand section" })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "Alpha item" })).not.toBeInTheDocument();
  });

  it("keyboard navigation skips items in a collapsed uncontrolled group", async () => {
    const user = userEvent.setup();
    render(
      <NavigationList aria-label="Test nav" defaultHighlighted="before">
        <NavigationList.Item id="before">
          <NavigationList.Title>Before</NavigationList.Title>
        </NavigationList.Item>
        <NavigationList.Group label="Collapsible">
          <NavigationList.Item id="inside">
            <NavigationList.Title>Inside</NavigationList.Title>
          </NavigationList.Item>
        </NavigationList.Group>
        <NavigationList.Item id="after">
          <NavigationList.Title>After</NavigationList.Title>
        </NavigationList.Item>
      </NavigationList>,
    );

    const listbox = screen.getByRole("listbox");
    listbox.focus();

    await user.click(screen.getByRole("option", { name: /Collapsible/i }));
    expect(screen.queryByRole("option", { name: "Inside" })).not.toBeInTheDocument();

    await user.keyboard("{ArrowDown}");
    expect(listbox).toHaveAttribute("aria-activedescendant", expect.stringContaining("-after"));
  });

  it("keyboard navigation moves through section headers between items", async () => {
    const user = userEvent.setup();
    render(
      <NavigationList aria-label="Test nav" defaultHighlighted="one">
        <NavigationList.Group label="Section A">
          <NavigationList.Item id="one">
            <NavigationList.Title>One</NavigationList.Title>
          </NavigationList.Item>
        </NavigationList.Group>
        <NavigationList.Group label="Section B">
          <NavigationList.Item id="two">
            <NavigationList.Title>Two</NavigationList.Title>
          </NavigationList.Item>
        </NavigationList.Group>
      </NavigationList>,
    );

    const listbox = screen.getByRole("listbox");
    const sectionB = screen.getByRole("option", { name: /Section B, collapse section/i });
    listbox.focus();

    await user.keyboard("{ArrowDown}");
    expect(listbox).toHaveAttribute("aria-activedescendant", sectionB.id);

    await user.keyboard("{ArrowDown}");
    expect(listbox).toHaveAttribute("aria-activedescendant", expect.stringContaining("-two"));
  });

  it("tree variant renders with connectors", () => {
    render(
      <NavigationList aria-label="Test nav">
        <NavigationList.Group label="src" variant="tree">
          <NavigationList.Item id="one">
            <NavigationList.Title>Button.tsx</NavigationList.Title>
          </NavigationList.Item>
          <NavigationList.Item id="two">
            <NavigationList.Title>Input.tsx</NavigationList.Title>
          </NavigationList.Item>
        </NavigationList.Group>
      </NavigationList>,
    );

    expect(screen.getByRole("group", { name: /src/ })).toBeInTheDocument();

    const firstItem = screen.getByRole("option", { name: "Button.tsx" });
    const lastItem = screen.getByRole("option", { name: "Input.tsx" });
    expect(firstItem.textContent).toContain("├──");
    expect(lastItem.textContent).toContain("└──");
  });

  it("tree group header exposes its expansion state in the accessible name and flips on toggle", async () => {
    const user = userEvent.setup();
    render(
      <NavigationList aria-label="Test nav">
        <NavigationList.Group label="src" variant="tree" headerId="src-group" defaultExpanded>
          <NavigationList.Item id="one">
            <NavigationList.Title>Button.tsx</NavigationList.Title>
          </NavigationList.Item>
        </NavigationList.Group>
      </NavigationList>,
    );

    expect(screen.getByRole("option", { name: "src, collapse section" })).toBeInTheDocument();

    await user.click(screen.getByRole("option", { name: "src, collapse section" }));
    expect(screen.getByRole("option", { name: "src, expand section" })).toBeInTheDocument();
  });

  it("nested tree groups increment depth", () => {
    render(
      <NavigationList aria-label="Test nav">
        <NavigationList.Group label="src" variant="tree">
          <NavigationList.Group label="components" variant="tree">
            <NavigationList.Item id="one">
              <NavigationList.Title>Button.tsx</NavigationList.Title>
            </NavigationList.Item>
          </NavigationList.Group>
        </NavigationList.Group>
      </NavigationList>,
    );

    const item = screen.getByRole("option", { name: "Button.tsx" });
    expect(item.textContent).toContain("└──");

    expect(screen.getByRole("group", { name: /components/ })).toBeInTheDocument();
  });

  it("controlled expanded prop works", async () => {
    const user = userEvent.setup();
    const onExpandedChange = vi.fn();
    const { rerender } = render(
      <NavigationList aria-label="Test nav">
        <NavigationList.Group label="Section" expanded={true} onExpandedChange={onExpandedChange}>
          <NavigationList.Item id="one">
            <NavigationList.Title>One</NavigationList.Title>
          </NavigationList.Item>
        </NavigationList.Group>
      </NavigationList>,
    );

    expect(screen.getByRole("option", { name: "One" })).toBeInTheDocument();

    await user.click(screen.getByRole("option", { name: /Section/i }));
    expect(onExpandedChange).toHaveBeenCalledWith(false);
    expect(screen.getByRole("option", { name: "One" })).toBeInTheDocument();

    rerender(
      <NavigationList aria-label="Test nav">
        <NavigationList.Group label="Section" expanded={false} onExpandedChange={onExpandedChange}>
          <NavigationList.Item id="one">
            <NavigationList.Title>One</NavigationList.Title>
          </NavigationList.Item>
        </NavigationList.Group>
      </NavigationList>,
    );
    expect(screen.queryByRole("option", { name: "One" })).not.toBeInTheDocument();
  });

  it("has no a11y violations with tree groups", async () => {
    const { container } = render(
      <NavigationList aria-label="Test nav">
        <NavigationList.Group label="src" variant="tree">
          <NavigationList.Item id="one">
            <NavigationList.Title>Button.tsx</NavigationList.Title>
          </NavigationList.Item>
        </NavigationList.Group>
      </NavigationList>,
    );
    expect(await axe(container)).toHaveNoViolations();
  });

  it("ArrowRight expands a collapsed tree group header", async () => {
    expectDocumentedGroupKey("ArrowRight");
    const user = userEvent.setup();
    render(
      <NavigationList aria-label="Test nav">
        <NavigationList.Group
          label="src"
          variant="tree"
          headerId="src-group"
          defaultExpanded={false}
        >
          <NavigationList.Item id="one">
            <NavigationList.Title>Button.tsx</NavigationList.Title>
          </NavigationList.Item>
        </NavigationList.Group>
      </NavigationList>,
    );

    const listbox = screen.getByRole("listbox");
    listbox.focus();

    expect(screen.queryByText("Button.tsx")).not.toBeInTheDocument();

    await user.keyboard("{ArrowDown}");
    expect(listbox).toHaveAttribute("aria-activedescendant", expect.stringContaining("src-group"));

    await user.keyboard("{ArrowRight}");
    expect(screen.getByText("Button.tsx")).toBeInTheDocument();
  });

  it("ArrowLeft collapses an expanded tree group header", async () => {
    expectDocumentedGroupKey("ArrowLeft");
    const user = userEvent.setup();
    render(
      <NavigationList aria-label="Test nav">
        <NavigationList.Group
          label="src"
          variant="tree"
          headerId="src-group"
          defaultExpanded={true}
        >
          <NavigationList.Item id="one">
            <NavigationList.Title>Button.tsx</NavigationList.Title>
          </NavigationList.Item>
        </NavigationList.Group>
      </NavigationList>,
    );

    const listbox = screen.getByRole("listbox");
    listbox.focus();

    expect(screen.getByText("Button.tsx")).toBeInTheDocument();

    await user.keyboard("{ArrowDown}");
    expect(listbox).toHaveAttribute("aria-activedescendant", expect.stringContaining("src-group"));

    await user.keyboard("{ArrowLeft}");
    expect(screen.queryByText("Button.tsx")).not.toBeInTheDocument();
  });

  it("ArrowLeft on a non-group item does nothing special", async () => {
    const user = userEvent.setup();
    render(
      <NavigationList aria-label="Test nav" defaultHighlighted="one">
        <NavigationList.Group label="src" variant="tree" headerId="src-group">
          <NavigationList.Item id="one">
            <NavigationList.Title>Button.tsx</NavigationList.Title>
          </NavigationList.Item>
        </NavigationList.Group>
      </NavigationList>,
    );

    const listbox = screen.getByRole("listbox");
    listbox.focus();

    expect(listbox).toHaveAttribute("aria-activedescendant", expect.stringContaining("-one"));

    await user.keyboard("{ArrowLeft}");
    expect(listbox).toHaveAttribute("aria-activedescendant", expect.stringContaining("-one"));
    expect(screen.getByText("Button.tsx")).toBeInTheDocument();
  });

  it("Enter toggles tree group header expansion", async () => {
    expectDocumentedGroupKey("Enter");
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(
      <NavigationList aria-label="Test nav" onSelect={onSelect}>
        <NavigationList.Group
          label="src"
          variant="tree"
          headerId="src-group"
          defaultExpanded={true}
        >
          <NavigationList.Item id="one">
            <NavigationList.Title>Button.tsx</NavigationList.Title>
          </NavigationList.Item>
        </NavigationList.Group>
      </NavigationList>,
    );

    const listbox = screen.getByRole("listbox");
    listbox.focus();

    await user.keyboard("{ArrowDown}");
    expect(listbox).toHaveAttribute("aria-activedescendant", expect.stringContaining("src-group"));

    await user.keyboard("{Enter}");
    expect(screen.queryByText("Button.tsx")).not.toBeInTheDocument();
    expect(onSelect).not.toHaveBeenCalled();
  });

  it("Space toggles tree group header expansion", async () => {
    expectDocumentedGroupKey("Space");
    const user = userEvent.setup();
    render(
      <NavigationList aria-label="Test nav">
        <NavigationList.Group label="src" variant="tree" headerId="src-group" defaultExpanded>
          <NavigationList.Item id="one">
            <NavigationList.Title>Button.tsx</NavigationList.Title>
          </NavigationList.Item>
        </NavigationList.Group>
      </NavigationList>,
    );

    const listbox = screen.getByRole("listbox");
    listbox.focus();
    await user.keyboard("{ArrowDown} ");

    expect(screen.queryByText("Button.tsx")).not.toBeInTheDocument();
  });

  it("tree group header is navigable with ArrowDown/ArrowUp", async () => {
    const user = userEvent.setup();
    render(
      <NavigationList aria-label="Test nav">
        <NavigationList.Item id="before">
          <NavigationList.Title>Before</NavigationList.Title>
        </NavigationList.Item>
        <NavigationList.Group label="src" variant="tree" headerId="src-group">
          <NavigationList.Item id="one">
            <NavigationList.Title>Button.tsx</NavigationList.Title>
          </NavigationList.Item>
        </NavigationList.Group>
      </NavigationList>,
    );

    const listbox = screen.getByRole("listbox");
    listbox.focus();

    await user.keyboard("{ArrowDown}");
    expect(listbox).toHaveAttribute("aria-activedescendant", expect.stringContaining("-before"));

    await user.keyboard("{ArrowDown}");
    expect(listbox).toHaveAttribute("aria-activedescendant", expect.stringContaining("src-group"));

    await user.keyboard("{ArrowDown}");
    expect(listbox).toHaveAttribute("aria-activedescendant", expect.stringContaining("-one"));
  });
});
