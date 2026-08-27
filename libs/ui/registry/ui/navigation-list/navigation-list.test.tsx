import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRef } from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { axe } from "../../../testing/axe";
import { closestElement } from "../../testing/assertions";
import { NavigationList, type NavigationListProps } from "./index";

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

  it("highlights an item when focus enters one of its children", () => {
    render(
      <NavigationList aria-label="Test nav">
        <NavigationList.Item id="one">
          <NavigationList.Title>One</NavigationList.Title>
          <button type="button">Pin One</button>
        </NavigationList.Item>
      </NavigationList>,
    );

    act(() => {
      screen.getByRole("button", { name: "Pin One" }).focus();
    });

    expect(screen.getByRole("listbox")).toHaveAttribute(
      "aria-activedescendant",
      screen.getByRole("option", { name: "One" }).id,
    );
  });

  it("lets item focus handlers prevent highlight changes", () => {
    render(
      <NavigationList aria-label="Test nav">
        <NavigationList.Item id="one" onFocus={(event) => event.preventDefault()}>
          <NavigationList.Title>One</NavigationList.Title>
          <button type="button">Pin One</button>
        </NavigationList.Item>
      </NavigationList>,
    );

    act(() => {
      screen.getByRole("button", { name: "Pin One" }).focus();
    });

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

  it("selects the highlighted option on Space while the typeahead buffer is empty", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    const onEnter = vi.fn();
    renderList({ defaultHighlighted: "one", onSelect, onEnter });
    const listbox = screen.getByRole("listbox");
    listbox.focus();

    await user.keyboard(" ");

    expect(onSelect).toHaveBeenCalledWith("one");
    expect(onEnter).not.toHaveBeenCalled();
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

  it("leaves printable keys unclaimed with typeahead false while arrows still navigate", async () => {
    const windowKeys: Array<{ key: string; defaultPrevented: boolean }> = [];
    const recordKey = (event: KeyboardEvent) =>
      windowKeys.push({ key: event.key, defaultPrevented: event.defaultPrevented });
    window.addEventListener("keydown", recordKey);
    const user = userEvent.setup();
    renderList({ typeahead: false, defaultHighlighted: "one" });

    const listbox = screen.getByRole("listbox");
    listbox.focus();
    await user.keyboard("t");

    // No buffering: the highlight stays put and the key reaches the window
    // unclaimed so an external hotkey layer can own it.
    expect(listbox).toHaveAttribute("aria-activedescendant", expect.stringContaining("-one"));
    expect(windowKeys).toEqual([{ key: "t", defaultPrevented: false }]);
    window.removeEventListener("keydown", recordKey);

    await user.keyboard("{ArrowDown}");
    expect(listbox).toHaveAttribute("aria-activedescendant", expect.stringContaining("-two"));
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

  it("references each description subtree once in the accessible description", () => {
    render(
      <NavigationList aria-label="Test nav">
        <NavigationList.Item id="one">
          <NavigationList.Title>One</NavigationList.Title>
        </NavigationList.Item>
        <NavigationList.Item id="nested">
          <NavigationList.Title>Nested meta</NavigationList.Title>
          <NavigationList.Meta>
            <NavigationList.Badge variant="info">NEW</NavigationList.Badge>
            <NavigationList.Subtitle>3 files changed</NavigationList.Subtitle>
          </NavigationList.Meta>
        </NavigationList.Item>
        <NavigationList.Item id="two">
          <NavigationList.Title>Two</NavigationList.Title>
          <NavigationList.Subtitle>Subtitle</NavigationList.Subtitle>
          <NavigationList.Meta>Meta</NavigationList.Meta>
        </NavigationList.Item>
      </NavigationList>,
    );

    expect(screen.getByRole("option", { name: "One" })).not.toHaveAttribute("aria-describedby");

    const nestedOption = screen.getByRole("option", { name: /Nested meta/ });
    expect(nestedOption).toHaveAccessibleDescription("NEW3 files changed");
    expect(nestedOption.getAttribute("aria-describedby")).toBe(`${nestedOption.id}-desc-meta`);
    expect(nestedOption.getAttribute("aria-describedby")).not.toContain("-desc-sub");

    const siblingOption = screen.getByRole("option", { name: /Two/ });
    expect(siblingOption).toHaveAccessibleDescription("Meta Subtitle");
    const siblingDescribedBy = siblingOption.getAttribute("aria-describedby");
    expect(siblingDescribedBy).toContain("-two-desc-meta");
    expect(siblingDescribedBy).toContain("-two-desc-sub");
  });

  it("only references aria-labelledby when a Title actually renders the label element", () => {
    render(
      <NavigationList aria-label="Test nav">
        <NavigationList.Item id="titled">
          <NavigationList.Title>Titled</NavigationList.Title>
        </NavigationList.Item>
        <NavigationList.Item id="bare">
          <NavigationList.Badge variant="info">3</NavigationList.Badge>
        </NavigationList.Item>
      </NavigationList>,
    );

    const titled = screen.getByRole("option", { name: "Titled" });
    expect(titled.getAttribute("aria-labelledby")).toBe(`${titled.id}-label`);

    const bare = screen.getByRole("option", { name: "3" });
    expect(bare).not.toHaveAttribute("aria-labelledby");
  });

  it("exposes a named group for both the section and tree variants", () => {
    render(
      <NavigationList aria-label="Test nav">
        <NavigationList.Group label="Sections" count={1} defaultExpanded>
          <NavigationList.Item id="one">
            <NavigationList.Title>One</NavigationList.Title>
          </NavigationList.Item>
        </NavigationList.Group>
        <NavigationList.Group label="Trees" variant="tree" defaultExpanded>
          <NavigationList.Item id="two">
            <NavigationList.Title>Two</NavigationList.Title>
          </NavigationList.Item>
        </NavigationList.Group>
      </NavigationList>,
    );

    // variant is documented as a visual treatment, so it must not change which
    // grouping semantics the listbox exposes.
    expect(screen.getByRole("group", { name: "Sections (1)" })).toBeInTheDocument();
    expect(screen.getByRole("group", { name: "Trees" })).toBeInTheDocument();
  });

  it("describes the option with its subtitle", () => {
    render(
      <NavigationList aria-label="Test nav">
        <NavigationList.Item id="one">
          <NavigationList.Title>One</NavigationList.Title>
          <NavigationList.Subtitle>
            a very long subtitle that will not fit into the available row width at all
          </NavigationList.Subtitle>
        </NavigationList.Item>
      </NavigationList>,
    );

    const option = screen.getByRole("option", { name: /One/ });
    expect(option.getAttribute("aria-describedby")).toContain(`${option.id}-desc-sub`);

    const subtitle = document.getElementById(`${option.id}-desc-sub`);
    expect(subtitle).not.toBeNull();
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
