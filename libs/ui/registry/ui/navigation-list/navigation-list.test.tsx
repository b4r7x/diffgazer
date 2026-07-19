import { testNavigationBehavior } from "@diffgazer/keys/testing/navigation-behavior";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRef, useState } from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { axe } from "../../../testing/axe";
import { navigationListDoc } from "../../component-docs/navigation-list";
import { closestElement } from "../../testing/assertions";
import { NavigationList, type NavigationListProps } from "./index";
import { useNavigationListContext } from "./navigation-list-context";

type NavigationListRenderProps = Partial<NavigationListProps> &
  Partial<Record<`data-${string}`, string>>;

function renderList(props: NavigationListRenderProps = {}) {
  return render(
    <NavigationList aria-label="Test nav" {...props}>
      <NavigationList.Item id="one">
        <NavigationList.Title>One</NavigationList.Title>
      </NavigationList.Item>
      <NavigationList.Item id="two">
        <NavigationList.Title>Two</NavigationList.Title>
      </NavigationList.Item>
      <NavigationList.Item id="three" disabled>
        <NavigationList.Title>Three</NavigationList.Title>
      </NavigationList.Item>
    </NavigationList>,
  );
}

describe("NavigationList", () => {
  function expectServerActiveDescendant(markup: string): string {
    const activeDescendant = markup.match(/aria-activedescendant="([^"]+)"/)?.[1];
    expect(activeDescendant).toBeDefined();
    expect(markup).toContain(`id="${activeDescendant}"`);
    return activeDescendant ?? "";
  }

  it("renders direct selected and grouped highlighted options as active descendants on the server", () => {
    const selected = renderToString(
      <NavigationList aria-label="Selected" defaultSelectedId="one">
        <NavigationList.Item id="one">
          <NavigationList.Title>One</NavigationList.Title>
        </NavigationList.Item>
      </NavigationList>,
    );
    const highlighted = renderToString(
      <NavigationList aria-label="Highlighted" defaultHighlighted="two">
        <NavigationList.Group label="Group">
          <NavigationList.Item id="two">
            <NavigationList.Title>Two</NavigationList.Title>
          </NavigationList.Item>
        </NavigationList.Group>
      </NavigationList>,
    );

    expect(expectServerActiveDescendant(selected)).toContain("-one");
    expect(expectServerActiveDescendant(highlighted)).toContain("-two");
  });

  it("omits disabled, wrapper-rendered, and absent active descendants on the server", () => {
    function WrappedItem() {
      return (
        <NavigationList.Item id="wrapped">
          <NavigationList.Title>Wrapped</NavigationList.Title>
        </NavigationList.Item>
      );
    }

    const disabled = renderToString(
      <NavigationList aria-label="Disabled" defaultSelectedId="disabled">
        <NavigationList.Item id="disabled" disabled>
          <NavigationList.Title>Disabled</NavigationList.Title>
        </NavigationList.Item>
      </NavigationList>,
    );
    const wrapped = renderToString(
      <NavigationList aria-label="Wrapped" defaultHighlighted="wrapped">
        <WrappedItem />
      </NavigationList>,
    );
    const noSelection = renderToString(
      <NavigationList aria-label="Idle">
        <NavigationList.Item id="idle">
          <NavigationList.Title>Idle</NavigationList.Title>
        </NavigationList.Item>
      </NavigationList>,
    );
    const collapsed = renderToString(
      <NavigationList aria-label="Collapsed" defaultHighlighted="nested">
        <NavigationList.Group label="Group" defaultExpanded={false}>
          <NavigationList.Item id="nested">
            <NavigationList.Title>Nested</NavigationList.Title>
          </NavigationList.Item>
        </NavigationList.Group>
      </NavigationList>,
    );

    expect(disabled).not.toContain("aria-activedescendant");
    expect(wrapped).not.toContain("aria-activedescendant");
    expect(noSelection).not.toContain("aria-activedescendant");
    expect(collapsed).not.toContain("aria-activedescendant");
    expect(collapsed).not.toContain("Nested");
  });

  it("uses live registration for a wrapper-rendered option after mount", async () => {
    function WrappedItem() {
      return (
        <NavigationList.Item id="wrapped">
          <NavigationList.Title>Wrapped</NavigationList.Title>
        </NavigationList.Item>
      );
    }

    render(
      <NavigationList aria-label="Wrapped" defaultHighlighted="wrapped">
        <WrappedItem />
      </NavigationList>,
    );

    await waitFor(() =>
      expect(screen.getByRole("listbox", { name: "Wrapped" })).toHaveAttribute(
        "aria-activedescendant",
        expect.stringContaining("-wrapped"),
      ),
    );
  });

  it("supports direct namespaced item parts with rich item UI", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(
      <NavigationList aria-label="Test nav" onSelect={onSelect}>
        <NavigationList.Item id="one">
          <NavigationList.Title>One</NavigationList.Title>
          <NavigationList.Status>Live</NavigationList.Status>
          <NavigationList.Meta>
            <NavigationList.Badge>new</NavigationList.Badge>
          </NavigationList.Meta>
          <NavigationList.Subtitle>First item</NavigationList.Subtitle>
        </NavigationList.Item>
      </NavigationList>,
    );

    await user.click(screen.getByRole("option", { name: /One/ }));

    expect(onSelect).toHaveBeenCalledWith("one");
    expect(screen.getByText("new")).toBeInTheDocument();
  });

  it("keeps aria-activedescendant in sync for items rendered by a consumer wrapper", async () => {
    const user = userEvent.setup();
    function WrappedItem({ id, label }: { id: string; label: string }) {
      return (
        <NavigationList.Item id={id}>
          <NavigationList.Title>{label}</NavigationList.Title>
        </NavigationList.Item>
      );
    }

    render(
      <NavigationList aria-label="Test nav" defaultHighlighted="one">
        <WrappedItem id="one" label="One" />
        <WrappedItem id="two" label="Two" />
      </NavigationList>,
    );

    const list = screen.getByRole("listbox");
    list.focus();
    await user.keyboard("{ArrowDown}");
    expect(list).toHaveAttribute(
      "aria-activedescendant",
      screen.getByRole("option", { name: "Two" }).id,
    );
  });

  it("warns in development when an unregistered item id is activated", async () => {
    const user = userEvent.setup();
    function GhostActivator() {
      const { activate } = useNavigationListContext();
      return (
        <button type="button" onClick={() => activate("ghost")}>
          activate ghost
        </button>
      );
    }
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    render(
      <NavigationList aria-label="Test nav">
        <NavigationList.Item id="one">
          <NavigationList.Title>One</NavigationList.Title>
        </NavigationList.Item>
        <GhostActivator />
      </NavigationList>,
    );

    await user.click(screen.getByRole("button", { name: "activate ghost" }));

    expect(warn).toHaveBeenCalled();
    expect(warn.mock.calls[0]?.[0]).toContain("ghost");
    expect(warn.mock.calls[0]?.[0]).toContain("NavigationList");
    warn.mockRestore();
  });

  it("does not warn when a registered item is activated", async () => {
    const user = userEvent.setup();
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    renderList();

    await user.click(screen.getByRole("option", { name: /One/ }));

    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });

  it("passes native root props and composes key handling with list navigation", async () => {
    const user = userEvent.setup();
    const ref = createRef<HTMLDivElement>();
    const onClick = vi.fn();
    const onKeyDown = vi.fn();

    renderList({
      ref,
      id: "nav-root",
      "data-state": "ready",
      "aria-describedby": "nav-help",
      style: { maxWidth: "12px" },
      defaultHighlighted: "one",
      onClick,
      onKeyDown,
    });

    const list = screen.getByRole("listbox");
    await user.click(list);
    await user.keyboard("{ArrowDown}");

    expect(list).toHaveAttribute("id", "nav-root");
    expect(list).toHaveAttribute("data-state", "ready");
    expect(list).toHaveAttribute("aria-describedby", "nav-help");
    expect(list).toHaveStyle({ maxWidth: "12px" });
    expect(list).toHaveAttribute("tabindex", "0");
    expect(onClick).toHaveBeenCalled();
    expect(onKeyDown).toHaveBeenCalled();
    expect(list).toHaveAttribute("aria-activedescendant", expect.stringContaining("-two"));
    expect(ref.current).toBe(list);
  });

  it("fires onSelect when an item is clicked", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    renderList({ onSelect });
    await user.click(screen.getByText("One"));
    expect(onSelect).toHaveBeenCalledWith("one");
  });

  it("fires onSelect when the already-selected item is clicked again", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    renderList({ selectedId: "one", onSelect });

    await user.click(screen.getByText("One"));

    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith("one");
  });

  it("passes item root props and composes item click handlers", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(
      <NavigationList aria-label="Test nav">
        <NavigationList.Item
          id="one"
          data-state="external"
          style={{ maxWidth: "14px" }}
          onClick={onClick}
        >
          <NavigationList.Title>One</NavigationList.Title>
        </NavigationList.Item>
      </NavigationList>,
    );

    await user.click(screen.getByRole("option", { name: "One" }));

    const item = screen.getByRole("option", { name: "One" });
    expect(onClick).toHaveBeenCalledOnce();
    expect(item).toHaveAttribute("data-selected");
    expect(item).toHaveStyle({ maxWidth: "14px" });
  });

  it("lets item click handlers prevent selection", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(
      <NavigationList aria-label="Test nav" onSelect={onSelect}>
        <NavigationList.Item id="one" onClick={(event) => event.preventDefault()}>
          <NavigationList.Title>One</NavigationList.Title>
        </NavigationList.Item>
      </NavigationList>,
    );

    await user.click(screen.getByRole("option", { name: "One" }));

    expect(onSelect).not.toHaveBeenCalled();
    expect(screen.getByRole("option", { name: "One" })).toHaveAttribute("aria-selected", "false");
  });

  it("lets item focus handlers prevent highlight changes", async () => {
    render(
      <NavigationList aria-label="Test nav">
        <NavigationList.Item id="one" onFocus={(event) => event.preventDefault()}>
          <NavigationList.Title>One</NavigationList.Title>
        </NavigationList.Item>
      </NavigationList>,
    );

    screen.getByRole("option", { name: "One" }).focus();

    expect(screen.getByRole("listbox")).not.toHaveAttribute(
      "aria-activedescendant",
      screen.getByRole("option", { name: "One" }).id,
    );
  });

  it("composes item mouse down handlers", async () => {
    const user = userEvent.setup();
    const onMouseDown = vi.fn();
    render(
      <NavigationList aria-label="Test nav">
        <NavigationList.Item id="one" onMouseDown={onMouseDown}>
          <NavigationList.Title>One</NavigationList.Title>
        </NavigationList.Item>
      </NavigationList>,
    );

    await user.pointer({
      target: screen.getByRole("option", { name: "One" }),
      keys: "[MouseLeft]",
    });

    expect(onMouseDown).toHaveBeenCalled();
  });

  it("does not fire onSelect when a disabled item is clicked", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    renderList({ onSelect });
    await user.click(screen.getByText("Three"));
    expect(onSelect).not.toHaveBeenCalled();
  });

  it("focuses the listbox after clicking an enabled item so keyboard navigation continues", async () => {
    const user = userEvent.setup();
    renderList();
    const listbox = screen.getByRole("listbox");

    await user.click(screen.getByText("One"));
    expect(listbox).toHaveFocus();

    await user.keyboard("{ArrowDown}");
    expect(listbox).toHaveAttribute("aria-activedescendant", expect.stringContaining("-two"));
  });

  it("does not focus or select when a disabled item is clicked", async () => {
    const onSelect = vi.fn();
    const user = userEvent.setup();
    renderList({ onSelect });
    const listbox = screen.getByRole("listbox");

    await user.click(screen.getByText("Three"));

    expect(onSelect).not.toHaveBeenCalled();
    expect(listbox).not.toHaveFocus();
    expect(screen.getByRole("option", { name: "Three" })).toHaveAttribute("aria-selected", "false");
  });

  it("does not move keyboard highlight on mouse hover", async () => {
    const user = userEvent.setup();
    renderList({ defaultHighlighted: "one" });
    const listbox = screen.getByRole("listbox");
    const oneOption = screen.getByRole("option", { name: "One" });
    const twoOption = screen.getByRole("option", { name: "Two" });

    expect(listbox).toHaveAttribute("aria-activedescendant", oneOption.id);
    await user.hover(twoOption);
    expect(listbox).toHaveAttribute("aria-activedescendant", oneOption.id);
  });

  it("uses a single active visual when selected and highlighted items differ", () => {
    renderList({ selectedId: "one", highlighted: "two", focused: true });

    const selectedOption = screen.getByRole("option", { name: "One" });
    const highlightedOption = screen.getByRole("option", { name: "Two" });

    expect(selectedOption).toHaveAttribute("aria-selected", "true");
    expect(selectedOption).not.toHaveAttribute("data-highlighted");
    expect(highlightedOption).toHaveAttribute("data-highlighted");
  });

  it("uses selected item as active visual when no highlight is set", () => {
    renderList({ selectedId: "one", highlighted: null, focused: true });

    expect(screen.getByRole("option", { name: "One" })).toHaveAttribute("data-highlighted");
  });

  it("keeps the selected item exposed as selected without the active visual when unfocused", () => {
    renderList({ selectedId: "one", highlighted: "one", focused: false });

    const selectedOption = screen.getByRole("option", { name: "One" });
    expect(selectedOption).toHaveAttribute("aria-selected", "true");
    expect(selectedOption).toHaveAttribute("data-selected");
    expect(selectedOption).not.toHaveAttribute("data-highlighted");
  });

  it("does not render disabled item as selected via controlled selectedId", () => {
    renderList({ selectedId: "three", focused: true });

    const disabledOption = screen.getByRole("option", { name: "Three" });
    expect(disabledOption).toHaveAttribute("aria-disabled", "true");
    expect(disabledOption).toHaveAttribute("aria-selected", "false");
    expect(disabledOption).not.toHaveAttribute("data-highlighted");
  });

  it("does not announce disabled item as highlighted via controlled state", () => {
    renderList({ highlighted: "three", focused: true });

    const list = screen.getByRole("listbox");
    const disabledOption = screen.getByRole("option", { name: "Three" });

    expect(list.getAttribute("aria-activedescendant") ?? "").not.toBe(disabledOption.id);
    expect(disabledOption).not.toHaveAttribute("data-highlighted");
  });

  it("fires onSelect in controlled mode without internal state change", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    const { rerender } = render(
      <NavigationList aria-label="Test nav" selectedId="one" onSelect={onSelect}>
        <NavigationList.Item id="one">
          <NavigationList.Title>One</NavigationList.Title>
        </NavigationList.Item>
        <NavigationList.Item id="two">
          <NavigationList.Title>Two</NavigationList.Title>
        </NavigationList.Item>
      </NavigationList>,
    );
    await user.click(screen.getByText("Two"));
    expect(onSelect).toHaveBeenCalledWith("two");
    expect(screen.getByRole("option", { name: "One" })).toHaveAttribute("aria-selected", "true");

    rerender(
      <NavigationList aria-label="Test nav" selectedId="two" onSelect={onSelect}>
        <NavigationList.Item id="one">
          <NavigationList.Title>One</NavigationList.Title>
        </NavigationList.Item>
        <NavigationList.Item id="two">
          <NavigationList.Title>Two</NavigationList.Title>
        </NavigationList.Item>
      </NavigationList>,
    );
    expect(screen.getByRole("option", { name: "Two" })).toHaveAttribute("aria-selected", "true");
  });

  it("has no a11y violations", async () => {
    const { container } = renderList();
    expect(await axe(container)).toHaveNoViolations();
  });

  it("moves highlight and activates the highlighted option from the listbox", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    const onEnter = vi.fn();
    renderList({ defaultHighlighted: "one", onSelect, onEnter });
    const listbox = screen.getByRole("listbox");
    listbox.focus();

    await user.keyboard("{ArrowDown}");
    expect(listbox).toHaveAttribute("aria-activedescendant", expect.stringContaining("-two"));
    await user.keyboard("{Enter}");

    expect(onSelect).toHaveBeenCalledWith("two");
    expect(onEnter).toHaveBeenCalledWith("two", expect.any(KeyboardEvent));
  });

  it("highlights a matching option with typeahead", async () => {
    const user = userEvent.setup();
    const onHighlightChange = vi.fn();
    render(
      <NavigationList aria-label="Test nav" onHighlightChange={onHighlightChange}>
        <NavigationList.Item id="alpha">
          <NavigationList.Title>Alpha</NavigationList.Title>
        </NavigationList.Item>
        <NavigationList.Item id="beta">
          <NavigationList.Title>Beta</NavigationList.Title>
        </NavigationList.Item>
        <NavigationList.Item id="charlie">
          <NavigationList.Title>Charlie</NavigationList.Title>
        </NavigationList.Item>
      </NavigationList>,
    );

    const listbox = screen.getByRole("listbox");
    listbox.focus();
    await user.keyboard("ch");

    const charlieOption = screen.getByRole("option", { name: "Charlie" });
    expect(listbox).toHaveAttribute("aria-activedescendant", charlieOption.id);
    expect(onHighlightChange).toHaveBeenCalledWith("charlie");
  });

  it("skips disabled options and reports non-wrapping boundaries", async () => {
    const user = userEvent.setup();
    const onNavigationBoundaryReached = vi.fn();
    render(
      <NavigationList
        aria-label="Test nav"
        defaultHighlighted="one"
        wrap={false}
        onNavigationBoundaryReached={onNavigationBoundaryReached}
      >
        <NavigationList.Item id="one">
          <NavigationList.Title>One</NavigationList.Title>
        </NavigationList.Item>
        <NavigationList.Item id="two" disabled>
          <NavigationList.Title>Two</NavigationList.Title>
        </NavigationList.Item>
        <NavigationList.Item id="three">
          <NavigationList.Title>Three</NavigationList.Title>
        </NavigationList.Item>
      </NavigationList>,
    );

    const listbox = screen.getByRole("listbox");
    const oneOption = screen.getByRole("option", { name: "One" });
    const twoOption = screen.getByRole("option", { name: "Two" });
    const threeOption = screen.getByRole("option", { name: "Three" });

    listbox.focus();
    await user.keyboard("{ArrowDown}");
    expect(listbox).toHaveAttribute("aria-activedescendant", threeOption.id);
    expect(listbox).not.toHaveAttribute("aria-activedescendant", twoOption.id);

    await user.keyboard("{ArrowDown}");
    expect(onNavigationBoundaryReached).toHaveBeenLastCalledWith(
      "next",
      expect.any(KeyboardEvent),
      "ArrowDown",
    );
    expect(listbox).toHaveAttribute("aria-activedescendant", threeOption.id);

    await user.keyboard("{ArrowUp}");
    expect(listbox).toHaveAttribute("aria-activedescendant", oneOption.id);

    await user.keyboard("{ArrowUp}");
    expect(onNavigationBoundaryReached).toHaveBeenLastCalledWith(
      "previous",
      expect.any(KeyboardEvent),
      "ArrowUp",
    );
    expect(listbox).toHaveAttribute("aria-activedescendant", oneOption.id);
  });

  it("autoFocus focuses the listbox and initializes the first enabled item", async () => {
    render(
      <NavigationList aria-label="Test nav" autoFocus>
        <NavigationList.Item id="one" disabled>
          <NavigationList.Title>One</NavigationList.Title>
        </NavigationList.Item>
        <NavigationList.Item id="two">
          <NavigationList.Title>Two</NavigationList.Title>
        </NavigationList.Item>
      </NavigationList>,
    );

    const listbox = screen.getByRole("listbox");
    const twoOption = screen.getByRole("option", { name: "Two" });

    await waitFor(() => {
      expect(listbox).toHaveFocus();
      expect(listbox).toHaveAttribute("aria-activedescendant", twoOption.id);
    });
  });

  it("excludes a hidden first item from listbox metadata so autoFocus skips it", async () => {
    render(
      <NavigationList aria-label="Test nav" autoFocus>
        <NavigationList.Item id="one" hidden>
          <NavigationList.Title>One</NavigationList.Title>
        </NavigationList.Item>
        <NavigationList.Item id="two">
          <NavigationList.Title>Two</NavigationList.Title>
        </NavigationList.Item>
      </NavigationList>,
    );

    const listbox = screen.getByRole("listbox");
    await waitFor(() =>
      expect(listbox).toHaveAttribute(
        "aria-activedescendant",
        screen.getByRole("option", { name: "Two" }).id,
      ),
    );
  });

  it("excludes an inert first item from listbox metadata so autoFocus skips it", async () => {
    render(
      <NavigationList aria-label="Test nav" autoFocus>
        <NavigationList.Item id="one" inert>
          <NavigationList.Title>One</NavigationList.Title>
        </NavigationList.Item>
        <NavigationList.Item id="two">
          <NavigationList.Title>Two</NavigationList.Title>
        </NavigationList.Item>
      </NavigationList>,
    );

    const listbox = screen.getByRole("listbox");
    await waitFor(() =>
      expect(listbox).toHaveAttribute(
        "aria-activedescendant",
        screen.getByRole("option", { name: "Two" }).id,
      ),
    );
  });

  it("excludes an aria-hidden first item from listbox metadata so autoFocus skips it", async () => {
    render(
      <NavigationList aria-label="Test nav" autoFocus>
        <NavigationList.Item id="one" aria-hidden="true">
          <NavigationList.Title>One</NavigationList.Title>
        </NavigationList.Item>
        <NavigationList.Item id="two">
          <NavigationList.Title>Two</NavigationList.Title>
        </NavigationList.Item>
      </NavigationList>,
    );

    const listbox = screen.getByRole("listbox");
    await waitFor(() =>
      expect(listbox).toHaveAttribute(
        "aria-activedescendant",
        screen.getByRole("option", { name: "Two" }).id,
      ),
    );
  });

  it("only references mounted description elements", () => {
    render(
      <NavigationList aria-label="Test nav">
        <NavigationList.Item id="one">
          <NavigationList.Title>One</NavigationList.Title>
        </NavigationList.Item>
        <NavigationList.Item id="two">
          <NavigationList.Title>Two</NavigationList.Title>
          <NavigationList.Subtitle>Subtitle</NavigationList.Subtitle>
          <NavigationList.Meta>Meta</NavigationList.Meta>
        </NavigationList.Item>
      </NavigationList>,
    );

    expect(screen.getByRole("option", { name: "One" })).not.toHaveAttribute("aria-describedby");
    const describedOption = screen.getByRole("option", { name: /Two/ });
    const describedBy = describedOption.getAttribute("aria-describedby");
    expect(describedBy).toContain("-two-desc-meta");
    expect(describedBy).toContain("-two-desc-sub");
  });

  it("keeps item ids unchanged while encoding DOM id references", async () => {
    const id = "release notes/v1.2?";
    const onSelect = vi.fn();
    const user = userEvent.setup();
    render(
      <NavigationList aria-label="Test nav" defaultHighlighted={id} onSelect={onSelect}>
        <NavigationList.Item id={id}>
          <NavigationList.Title>Release</NavigationList.Title>
          <NavigationList.Subtitle>Draft</NavigationList.Subtitle>
          <NavigationList.Meta>Updated</NavigationList.Meta>
        </NavigationList.Item>
        <NavigationList.Item id="other">
          <NavigationList.Title>Other</NavigationList.Title>
        </NavigationList.Item>
      </NavigationList>,
    );

    const listbox = screen.getByRole("listbox");
    const option = screen.getByRole("option", { name: /Release/ });
    const encodedId = encodeURIComponent(id);

    expect(option).toHaveAttribute("data-value", id);
    expect(option.id).toContain(encodedId);
    expect(listbox).toHaveAttribute("aria-activedescendant", option.id);
    expect(option).toHaveAttribute("aria-labelledby", `${option.id}-label`);
    expect(option.getAttribute("aria-describedby")).toContain(`${option.id}-desc-meta`);
    expect(option.getAttribute("aria-describedby")).toContain(`${option.id}-desc-sub`);

    await user.click(option);
    expect(onSelect).toHaveBeenCalledWith(id);
  });

  it("treats an empty string item id as a valid active descendant value", () => {
    render(
      <NavigationList aria-label="Test nav" defaultHighlighted="">
        <NavigationList.Item id="">
          <NavigationList.Title>Empty id</NavigationList.Title>
        </NavigationList.Item>
        <NavigationList.Item id="other">
          <NavigationList.Title>Other</NavigationList.Title>
        </NavigationList.Item>
      </NavigationList>,
    );

    const listbox = screen.getByRole("listbox");
    const option = closestElement(
      screen.getByText("Empty id"),
      "[role='option']",
      "empty-id option",
    );

    expect(listbox).toHaveAttribute("aria-activedescendant", option.id);
    expect(document.getElementById(option.id)).toBe(option);
  });
});

describe("NavigationList.Progress", () => {
  it("renders with role=progressbar", () => {
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
    expect(screen.getByRole("progressbar")).toBeInTheDocument();
  });

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
});

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

  it("has no a11y violations with section groups", async () => {
    const { container } = render(
      <NavigationList aria-label="Test nav">
        <NavigationList.Group label="Section" count={2}>
          <NavigationList.Item id="one">
            <NavigationList.Title>One</NavigationList.Title>
          </NavigationList.Item>
          <NavigationList.Item id="two">
            <NavigationList.Title>Two</NavigationList.Title>
          </NavigationList.Item>
        </NavigationList.Group>
      </NavigationList>,
    );
    expect(await axe(container)).toHaveNoViolations();
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

    await user.keyboard("{ArrowDown}");
    expect(listbox).toHaveAttribute("aria-activedescendant", expect.stringContaining("src-group"));

    await user.keyboard("{Enter}");
    expect(screen.queryByText("Button.tsx")).not.toBeInTheDocument();
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

  it("tree group header does not fire onSelect", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(
      <NavigationList aria-label="Test nav" onSelect={onSelect}>
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
    await user.keyboard("{Enter}");

    expect(onSelect).not.toHaveBeenCalled();
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

describe("NavigationList indicator variants", () => {
  function renderWithIndicator(indicator?: "bar" | "bar-thick" | "arrow" | "bracket") {
    return render(
      <NavigationList
        aria-label="Test nav"
        selectedId="one"
        focused
        {...(indicator ? { indicator } : {})}
      >
        <NavigationList.Item id="one">
          <NavigationList.Title>One</NavigationList.Title>
        </NavigationList.Item>
        <NavigationList.Item id="two">
          <NavigationList.Title>Two</NavigationList.Title>
        </NavigationList.Item>
      </NavigationList>,
    );
  }

  it("defaults to bar indicator", () => {
    const { container } = renderWithIndicator();
    // querySelector retained: data-indicator is a structural test hook on the indicator slot div, not an accessible element
    const slot = container.querySelector("[data-indicator]") as HTMLElement;
    expect(slot).toBeTruthy();
    expect(slot.getAttribute("data-indicator")).toBe("bar");
  });

  it("renders bar-thick indicator with wider slot", () => {
    const { container } = renderWithIndicator("bar-thick");
    // querySelector retained: data-indicator is a structural test hook on the indicator slot div
    const slots = container.querySelectorAll("[data-indicator='bar-thick']");
    expect(slots.length).toBeGreaterThan(0);
  });

  it("renders > glyph prefix on active item for arrow indicator", () => {
    renderWithIndicator("arrow");
    const activeItem = screen.getByRole("option", { name: "One" });
    expect(activeItem.textContent).toContain(">");

    const inactiveItem = screen.getByRole("option", { name: "Two" });
    expect(inactiveItem.textContent).toContain(">");
  });

  it("renders [ ] wrapping on items for bracket indicator", () => {
    renderWithIndicator("bracket");
    const activeItem = screen.getByRole("option", { name: "One" });
    expect(activeItem.textContent).toContain("[");
    expect(activeItem.textContent).toContain("]");
  });

  it("does not affect keyboard navigation when indicator changes", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(
      <NavigationList
        aria-label="Test nav"
        indicator="arrow"
        defaultHighlighted="one"
        onSelect={onSelect}
      >
        <NavigationList.Item id="one">
          <NavigationList.Title>One</NavigationList.Title>
        </NavigationList.Item>
        <NavigationList.Item id="two">
          <NavigationList.Title>Two</NavigationList.Title>
        </NavigationList.Item>
      </NavigationList>,
    );

    const listbox = screen.getByRole("listbox");
    listbox.focus();
    await user.keyboard("{ArrowDown}");
    await user.keyboard("{Enter}");

    expect(onSelect).toHaveBeenCalledWith("two");
  });

  it("has no a11y violations with bar-thick indicator", async () => {
    const { container } = renderWithIndicator("bar-thick");
    expect(await axe(container)).toHaveNoViolations();
  });

  it("has no a11y violations with arrow indicator", async () => {
    const { container } = renderWithIndicator("arrow");
    expect(await axe(container)).toHaveNoViolations();
  });

  it("has no a11y violations with bracket indicator", async () => {
    const { container } = renderWithIndicator("bracket");
    expect(await axe(container)).toHaveNoViolations();
  });
});
