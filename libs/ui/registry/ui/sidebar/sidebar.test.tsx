import { getTabbableElements } from "@diffgazer/keys";
import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRef, type Ref } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { axe } from "../../../testing/axe";
import { requireAttribute, requireElement, requireValue } from "../../testing/assertions";
import { Sidebar } from "./index";

type SidebarState = "open" | "rail" | "hidden";

function renderSidebar(
  props: {
    state?: SidebarState;
    defaultState?: SidebarState;
    onStateChange?: (state: SidebarState) => void;
  } = {},
) {
  return render(
    <Sidebar.Provider {...props}>
      <Sidebar>
        <Sidebar.Header>Header</Sidebar.Header>
        <Sidebar.Content>
          <Sidebar.Section>
            <Sidebar.SectionTitle>Section</Sidebar.SectionTitle>
            <Sidebar.Item>Item 1</Sidebar.Item>
          </Sidebar.Section>
        </Sidebar.Content>
        <Sidebar.Footer>Footer</Sidebar.Footer>
        <Sidebar.Trigger>Toggle</Sidebar.Trigger>
      </Sidebar>
    </Sidebar.Provider>,
  );
}

describe("Sidebar", () => {
  it.each([
    ["open", false, false],
    ["open", true, true],
    ["rail", false, false],
    ["rail", true, true],
    ["hidden", false, true],
    ["hidden", true, true],
  ] as const)("merges inert in %s state when caller inert is %s", (state, inert, expected) => {
    render(
      <Sidebar.Provider defaultState={state}>
        <Sidebar>
          <Sidebar.Content data-testid="sidebar-content" inert={inert} />
        </Sidebar>
      </Sidebar.Provider>,
    );

    const content = screen.getByTestId("sidebar-content");
    if (expected) expect(content).toHaveAttribute("inert");
    else expect(content).not.toHaveAttribute("inert");
  });

  it("toggles open state via SidebarTrigger", async () => {
    const user = userEvent.setup();
    renderSidebar();
    const trigger = screen.getByRole("button", { name: "Collapse sidebar" });
    const content = screen.getByText("Item 1").closest("[id]") as HTMLElement;
    expect(trigger).toHaveAttribute("aria-expanded", "true");
    expect(trigger).toHaveAttribute("aria-controls", content.id);
    expect(content).not.toHaveAttribute("aria-hidden");

    await user.click(trigger);
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(trigger).toHaveAttribute("aria-label", "Expand sidebar");
  });

  it.each([
    ["rail", "rail"],
    ["hidden", "hidden"],
  ] as const)("keeps %s on the sidebar DOM while exposing collapsed on the trigger", (state, providerState) => {
    render(
      <Sidebar.Provider defaultState={state}>
        <Sidebar data-testid="sidebar-root">
          <Sidebar.Content data-testid="sidebar-content" />
        </Sidebar>
        <Sidebar.Trigger data-testid="sidebar-trigger" />
      </Sidebar.Provider>,
    );

    expect(screen.getByTestId("sidebar-root")).toHaveAttribute("data-state", providerState);
    expect(screen.getByTestId("sidebar-content")).toHaveAttribute("data-state", providerState);
    expect(screen.getByTestId("sidebar-trigger")).toHaveAttribute("data-state", "collapsed");
  });

  it("removes the complete hidden sidebar from landmarks and tab order", () => {
    const { container } = render(
      <>
        <button type="button">Before</button>
        <Sidebar.Provider defaultState="hidden">
          <Sidebar>
            <Sidebar.Header>
              <button type="button">Hidden header action</button>
            </Sidebar.Header>
            <Sidebar.Content>
              <Sidebar.Item as="button">Hidden item</Sidebar.Item>
            </Sidebar.Content>
            <Sidebar.Footer>
              <a href="/account">Hidden footer action</a>
            </Sidebar.Footer>
          </Sidebar>
          <Sidebar.Trigger>Toggle</Sidebar.Trigger>
        </Sidebar.Provider>
        <button type="button">After</button>
      </>,
    );

    const hiddenNav = requireElement<HTMLElement>(
      container.querySelector<HTMLElement>('[data-slot="sidebar"]'),
      "hidden sidebar navigation",
    );
    expect(hiddenNav).toHaveAttribute("aria-hidden", "true");
    expect(hiddenNav).toHaveAttribute("inert");
    expect(screen.queryByRole("navigation", { name: "Primary" })).not.toBeInTheDocument();
    expect(screen.getByRole("navigation", { hidden: true })).toBe(hiddenNav);
    expect(hiddenNav).toHaveAttribute("aria-label", "Primary");

    expect(getTabbableElements(container)).toEqual([
      screen.getByRole("button", { name: "Before" }),
      screen.getByRole("button", { name: "Expand sidebar" }),
      screen.getByRole("button", { name: "After" }),
    ]);
  });

  it("calls custom onClick on trigger alongside toggle", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(
      <Sidebar.Provider>
        <Sidebar>
          <Sidebar.Trigger onClick={onClick}>Toggle</Sidebar.Trigger>
        </Sidebar>
      </Sidebar.Provider>,
    );
    await user.click(screen.getByRole("button", { name: "Collapse sidebar" }));
    expect(onClick).toHaveBeenCalled();
  });

  it("does not toggle when trigger click is prevented", async () => {
    const user = userEvent.setup();
    render(
      <Sidebar.Provider>
        <Sidebar>
          <Sidebar.Trigger onClick={(event) => event.preventDefault()}>Toggle</Sidebar.Trigger>
        </Sidebar>
      </Sidebar.Provider>,
    );
    const trigger = screen.getByRole("button", { name: "Collapse sidebar" });

    await user.click(trigger);
    expect(trigger).toHaveAttribute("aria-expanded", "true");
  });

  it("respects controlled state prop", async () => {
    const user = userEvent.setup();
    const onStateChange = vi.fn();
    renderSidebar({ state: "open", onStateChange });
    const trigger = screen.getByRole("button", { name: "Collapse sidebar" });

    await user.click(trigger);
    expect(onStateChange).toHaveBeenCalledWith("rail");
    expect(trigger).toHaveAttribute("aria-expanded", "true");
  });

  it("has no a11y violations", async () => {
    const { container } = renderSidebar();
    expect(await axe(container)).toHaveNoViolations();
  });

  it("toggles open state when used without explicit SidebarProvider", async () => {
    const user = userEvent.setup();
    render(
      <Sidebar>
        <Sidebar.Trigger>Toggle</Sidebar.Trigger>
      </Sidebar>,
    );
    const trigger = screen.getByRole("button", { name: "Collapse sidebar" });
    expect(trigger).toHaveAttribute("aria-expanded", "true");

    await user.click(trigger);
    expect(trigger).toHaveAttribute("aria-expanded", "false");
  });

  it("honors prevented content keydown before moving focus", async () => {
    const user = userEvent.setup();
    render(
      <Sidebar.Provider>
        <Sidebar>
          <Sidebar.Content onKeyDown={(event) => event.preventDefault()}>
            <Sidebar.Item as="button" value="one">
              One
            </Sidebar.Item>
            <Sidebar.Item as="button" value="two">
              Two
            </Sidebar.Item>
          </Sidebar.Content>
        </Sidebar>
      </Sidebar.Provider>,
    );
    const first = screen.getByRole("button", { name: "One" });
    first.focus();

    await user.keyboard("{ArrowDown}");
    expect(first).toHaveFocus();
  });

  it("navigates between sidebar items that omit an explicit value via derived value", async () => {
    const user = userEvent.setup();
    render(
      <Sidebar.Provider>
        <Sidebar>
          <Sidebar.Content>
            <Sidebar.Item as="button">One</Sidebar.Item>
            <Sidebar.Item as="button">Two</Sidebar.Item>
            <Sidebar.Item as="button">Three</Sidebar.Item>
          </Sidebar.Content>
        </Sidebar>
      </Sidebar.Provider>,
    );
    const first = screen.getByRole("button", { name: "One" });
    const second = screen.getByRole("button", { name: "Two" });

    expect(first).toHaveAttribute("data-value");
    expect(first.getAttribute("data-value")).not.toBe("");

    first.focus();
    await user.keyboard("{ArrowDown}");
    expect(second).toHaveFocus();
  });

  it("navigates sidebar items without selecting nested data-value descendants", async () => {
    const user = userEvent.setup();
    render(
      <Sidebar.Provider>
        <Sidebar>
          <Sidebar.Content>
            <Sidebar.Item as="button" value="one">
              One <span data-value="nested">nested</span>
            </Sidebar.Item>
            <Sidebar.Item as="button" value="two">
              Two
            </Sidebar.Item>
          </Sidebar.Content>
        </Sidebar>
      </Sidebar.Provider>,
    );
    const first = screen.getByRole("button", { name: "One nested" });
    const second = screen.getByRole("button", { name: "Two" });
    first.focus();

    await user.keyboard("{ArrowDown}");
    expect(second).toHaveFocus();
  });

  it("keeps disabled render-prop items inert and out of tab order", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(
      <Sidebar.Provider>
        <Sidebar>
          <Sidebar.Content>
            <Sidebar.Item disabled onClick={onClick}>
              {({ itemPrefix, ref, ...itemProps }) => (
                <a href="/settings" ref={ref as Ref<HTMLAnchorElement> | undefined} {...itemProps}>
                  {itemPrefix}
                  Settings
                </a>
              )}
            </Sidebar.Item>
          </Sidebar.Content>
        </Sidebar>
      </Sidebar.Provider>,
    );
    const item = screen.getByRole("link", { name: "Settings" });

    await user.click(item);

    expect(onClick).not.toHaveBeenCalled();
    expect(item).toHaveAttribute("aria-disabled", "true");
    expect(item).toHaveAttribute("tabindex", "-1");
  });

  it("renders the render-prop itemPrefix as content, not as a DOM attribute", () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    render(
      <Sidebar.Provider>
        <Sidebar>
          <Sidebar.Content>
            <Sidebar.Item active>
              {({ itemPrefix, ref, ...itemProps }) => (
                <a href="/dashboard" ref={ref as Ref<HTMLAnchorElement> | undefined} {...itemProps}>
                  {itemPrefix}
                  Dashboard
                </a>
              )}
            </Sidebar.Item>
          </Sidebar.Content>
        </Sidebar>
      </Sidebar.Provider>,
    );
    const item = screen.getByRole("link", { name: "Dashboard" });

    expect(item).not.toHaveAttribute("itemprefix");
    expect(item.querySelector("svg")).not.toBeNull();
    expect(errorSpy).not.toHaveBeenCalled();
    errorSpy.mockRestore();
  });

  it("keeps disabled anchor items inert and out of tab order", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(
      <Sidebar.Provider>
        <Sidebar>
          <Sidebar.Content>
            <Sidebar.Item as="a" href="/settings" disabled onClick={onClick}>
              Settings
            </Sidebar.Item>
          </Sidebar.Content>
        </Sidebar>
      </Sidebar.Provider>,
    );
    const item = screen.getByRole("link", { name: "Settings" });

    await user.click(item);
    expect(onClick).not.toHaveBeenCalled();
    expect(item).toHaveAttribute("aria-disabled", "true");
    expect(item).toHaveAttribute("tabindex", "-1");
  });

  it("skips disabled items in keyboard tab order", async () => {
    const user = userEvent.setup();
    render(
      <>
        <button type="button">Before</button>
        <Sidebar.Provider>
          <Sidebar>
            <Sidebar.Content>
              <Sidebar.Item as="a" href="/one">
                One
              </Sidebar.Item>
              <Sidebar.Item as="a" href="/two" disabled>
                Two
              </Sidebar.Item>
              <Sidebar.Item as="a" href="/three">
                Three
              </Sidebar.Item>
            </Sidebar.Content>
          </Sidebar>
        </Sidebar.Provider>
        <button type="button">After</button>
      </>,
    );

    await user.tab();
    expect(screen.getByRole("button", { name: "Before" })).toHaveFocus();
    await user.tab();
    expect(screen.getByRole("link", { name: "One" })).toHaveFocus();
    await user.tab();
    expect(screen.getByRole("link", { name: "Three" })).toHaveFocus();
    expect(screen.getByRole("link", { name: "Two" })).not.toHaveFocus();
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

describe("Sidebar variants", () => {
  function renderWithVariant(variant: "caret" | "inverted" | "bar" | "terminal" | "tree") {
    return render(
      <Sidebar variant={variant}>
        <Sidebar.Content>
          <Sidebar.Section collapsible defaultOpen>
            <Sidebar.SectionTitle>Section</Sidebar.SectionTitle>
            <Sidebar.SectionContent>
              <Sidebar.Item as="button">Install</Sidebar.Item>
              <Sidebar.Item as="button" active>
                Quickstart
              </Sidebar.Item>
              <Sidebar.Item as="button">Theming</Sidebar.Item>
            </Sidebar.SectionContent>
          </Sidebar.Section>
        </Sidebar.Content>
      </Sidebar>,
    );
  }

  it("defaults to caret variant on the nav root", () => {
    render(
      <Sidebar>
        <Sidebar.Content>
          <Sidebar.Item as="button">Item</Sidebar.Item>
        </Sidebar.Content>
      </Sidebar>,
    );
    expect(screen.getByRole("navigation")).toHaveAttribute("data-variant", "caret");
  });

  it("propagates the variant prop to the nav root", () => {
    render(
      <Sidebar variant="inverted">
        <Sidebar.Content>
          <Sidebar.Item as="button">Item</Sidebar.Item>
        </Sidebar.Content>
      </Sidebar>,
    );
    expect(screen.getByRole("navigation")).toHaveAttribute("data-variant", "inverted");
  });

  it("caret variant marks the active item and reserves the chevron marker slot", () => {
    renderWithVariant("caret");
    const active = screen.getByRole("button", { name: /Quickstart/i });
    expect(active).toHaveAttribute("aria-current", "page");
    expect(active).toHaveAttribute("data-selected");
    expect(active.querySelector("svg")).not.toBeNull();
    const inactive = screen.getByRole("button", { name: /Install/i });
    expect(inactive.querySelector("svg")).not.toBeNull();
    expect(inactive).not.toHaveAttribute("aria-current");
  });

  it("inverted variant marks the active item without a glyph prefix", () => {
    renderWithVariant("inverted");
    const active = screen.getByRole("button", { name: "Quickstart" });
    expect(active).toHaveAttribute("aria-current", "page");
    expect(active).toHaveAttribute("data-selected");
    expect(active.textContent).not.toMatch(/[▸▾[\]*]/);
  });

  it("bar variant marks the active item without a glyph prefix", () => {
    renderWithVariant("bar");
    const active = screen.getByRole("button", { name: "Quickstart" });
    expect(active).toHaveAttribute("aria-current", "page");
    expect(active).toHaveAttribute("data-selected");
    expect(active.textContent).not.toMatch(/[▸▾[\]*]/);
  });

  it("terminal variant reserves the chevron prompt slot and marks the active item", () => {
    renderWithVariant("terminal");
    const active = screen.getByRole("button", { name: /Quickstart/i });
    const inactive = screen.getByRole("button", { name: /Install/i });
    expect(active).toHaveAttribute("aria-current", "page");
    expect(active).toHaveAttribute("data-selected");
    expect(active.querySelector("svg")).not.toBeNull();
    expect(inactive.querySelector("svg")).not.toBeNull();
    expect(inactive).not.toHaveAttribute("data-selected");
  });

  it("tree variant renders a chevron fold handle and no connector glyphs in text", () => {
    renderWithVariant("tree");
    expect(screen.getByRole("navigation")).toHaveAttribute("data-variant", "tree");
    const heading = screen.getByRole("heading", { name: /Section/i });
    expect(heading.querySelector("svg")).not.toBeNull();
    expect(heading.textContent).not.toMatch(/[▼▶]/);

    const quickstart = screen.getByRole("button", { name: /Quickstart/i });
    expect(quickstart.textContent).not.toMatch(/[├└─]/);
    expect(quickstart).toHaveAttribute("aria-current", "page");
    expect(quickstart).toHaveAttribute("data-selected");
  });

  it("tree variant keeps fragment-composed items as direct siblings for the connector corner", () => {
    function FragmentItems() {
      return (
        <>
          <Sidebar.Item as="button">Alpha</Sidebar.Item>
          <Sidebar.Item as="button">Beta</Sidebar.Item>
        </>
      );
    }
    render(
      <Sidebar variant="tree">
        <Sidebar.Content>
          <Sidebar.Section>
            <Sidebar.SectionTitle>Section</Sidebar.SectionTitle>
            <Sidebar.SectionContent>
              <FragmentItems />
            </Sidebar.SectionContent>
          </Sidebar.Section>
        </Sidebar.Content>
      </Sidebar>,
    );

    // The └ corner is :last-child driven, so fragments must keep items siblings.
    expect(screen.getByRole("button", { name: /Beta/i }).matches(":last-child")).toBe(true);
    expect(screen.getByRole("button", { name: /Alpha/i }).matches(":last-child")).toBe(false);
  });

  it("keeps a single Primary nav landmark and h3 section title across variants", () => {
    renderWithVariant("bar");
    const nav = screen.getByRole("navigation");
    expect(nav).toHaveAccessibleName("Primary");
    expect(nav).toHaveAttribute("data-variant", "bar");
    expect(screen.getByRole("heading", { level: 3, name: "Section" })).toBeInTheDocument();
  });
});

describe("Sidebar Cmd/Ctrl+B hotkey", () => {
  it("cycles open ↔ rail on Cmd+B", () => {
    const onStateChange = vi.fn();
    render(
      <Sidebar.Provider defaultState="open" onStateChange={onStateChange}>
        <Sidebar>
          <Sidebar.Content>
            <Sidebar.Item as="button">Item</Sidebar.Item>
          </Sidebar.Content>
        </Sidebar>
      </Sidebar.Provider>,
    );

    act(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "b", metaKey: true }));
    });
    expect(onStateChange).toHaveBeenLastCalledWith("rail");

    act(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "b", metaKey: true }));
    });
    expect(onStateChange).toHaveBeenLastCalledWith("open");
  });

  it("toggles hidden state on Shift+Cmd+B", () => {
    const onStateChange = vi.fn();
    render(
      <Sidebar.Provider defaultState="open" onStateChange={onStateChange}>
        <Sidebar>
          <Sidebar.Content>
            <Sidebar.Item as="button">Item</Sidebar.Item>
          </Sidebar.Content>
        </Sidebar>
      </Sidebar.Provider>,
    );

    act(() => {
      window.dispatchEvent(
        new KeyboardEvent("keydown", { key: "b", metaKey: true, shiftKey: true }),
      );
    });
    expect(onStateChange).toHaveBeenLastCalledWith("hidden");
  });

  it("does not bind the hotkey for a provider-less Sidebar", () => {
    render(
      <Sidebar>
        <Sidebar.Content>
          <Sidebar.Item as="button">Item</Sidebar.Item>
        </Sidebar.Content>
      </Sidebar>,
    );

    act(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "b", metaKey: true }));
    });
    expect(screen.getByRole("navigation")).toHaveAttribute("data-state", "open");
  });

  it("does not toggle when focus is in an editable target", () => {
    const onStateChange = vi.fn();
    render(
      <Sidebar.Provider defaultState="open" onStateChange={onStateChange}>
        <Sidebar>
          <Sidebar.Content>
            <Sidebar.Item as="button">Item</Sidebar.Item>
          </Sidebar.Content>
        </Sidebar>
        <input aria-label="search" />
      </Sidebar.Provider>,
    );
    const input = screen.getByLabelText("search");
    input.focus();

    act(() => {
      input.dispatchEvent(new KeyboardEvent("keydown", { key: "b", metaKey: true, bubbles: true }));
    });
    expect(onStateChange).not.toHaveBeenCalled();
  });

  it("does not toggle when focus is in a select or textarea", () => {
    const onStateChange = vi.fn();
    render(
      <Sidebar.Provider defaultState="open" onStateChange={onStateChange}>
        <Sidebar>
          <Sidebar.Content>
            <Sidebar.Item as="button">Item</Sidebar.Item>
          </Sidebar.Content>
        </Sidebar>
        <select aria-label="filter">
          <option>One</option>
        </select>
        <textarea aria-label="notes" />
      </Sidebar.Provider>,
    );

    for (const label of ["filter", "notes"]) {
      const el = screen.getByLabelText(label);
      el.focus();
      act(() => {
        el.dispatchEvent(new KeyboardEvent("keydown", { key: "b", metaKey: true, bubbles: true }));
      });
    }
    expect(onStateChange).not.toHaveBeenCalled();
  });

  it("does not toggle for an editable target inside an open shadow root", () => {
    const onStateChange = vi.fn();
    render(
      <Sidebar.Provider defaultState="open" onStateChange={onStateChange}>
        <Sidebar>
          <Sidebar.Content>
            <Sidebar.Item as="button">Item</Sidebar.Item>
          </Sidebar.Content>
        </Sidebar>
      </Sidebar.Provider>,
    );

    const host = document.createElement("div");
    document.body.append(host);
    const shadowRoot = host.attachShadow({ mode: "open" });
    const input = document.createElement("input");
    shadowRoot.append(input);
    input.focus();

    // A composed keydown surfaces the host as event.target on the window
    // listener; only composedPath()[0] reveals the editable shadow input.
    act(() => {
      input.dispatchEvent(
        new KeyboardEvent("keydown", {
          key: "b",
          metaKey: true,
          bubbles: true,
          composed: true,
        }),
      );
    });

    expect(onStateChange).not.toHaveBeenCalled();
    host.remove();
  });
});

describe("Sidebar rail-mode naming", () => {
  // jsdom loads no stylesheet, so the Tailwind rail-hide toggle never applies
  // and the visible label would double the sr-only copy in the computed name.
  // Replicate that rule via an attribute selector jsdom can match.
  function applyRailHideStyle() {
    const style = document.createElement("style");
    style.textContent =
      '[data-state="rail"] [class~="group-data-[state=rail]/sidebar:hidden"] { display: none; }';
    document.head.appendChild(style);
    return () => style.remove();
  }

  it("exposes the exact label name for icon-only items in rail state", () => {
    const removeRailHideStyle = applyRailHideStyle();
    render(
      <Sidebar.Provider defaultState="rail">
        <Sidebar>
          <Sidebar.Content>
            <Sidebar.Item as="button">
              <span aria-hidden="true">⚙</span>
              <Sidebar.ItemLabel>Settings</Sidebar.ItemLabel>
            </Sidebar.Item>
            <Sidebar.Item href="#dashboard">
              <span aria-hidden="true">D</span>
              <Sidebar.ItemLabel>Dashboard</Sidebar.ItemLabel>
            </Sidebar.Item>
          </Sidebar.Content>
        </Sidebar>
      </Sidebar.Provider>,
    );

    expect(screen.getByRole("navigation")).toHaveAttribute("data-state", "rail");
    expect(screen.getByRole("button", { name: "Settings" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Dashboard" })).toBeInTheDocument();

    removeRailHideStyle();
  });

  it("does not add a rail name copy for render-prop items", () => {
    render(
      <Sidebar.Provider defaultState="rail">
        <Sidebar>
          <Sidebar.Content>
            <Sidebar.Item>
              {({ itemPrefix, ref, ...itemProps }) => (
                <a {...itemProps} ref={ref as Ref<HTMLAnchorElement>} href="#profile">
                  {itemPrefix}
                  <span aria-hidden="true">P</span>
                  <Sidebar.ItemLabel>Profile</Sidebar.ItemLabel>
                </a>
              )}
            </Sidebar.Item>
          </Sidebar.Content>
        </Sidebar>
      </Sidebar.Provider>,
    );

    expect(screen.getByRole("link", { name: "Profile" })).toBeInTheDocument();
  });
});

describe("Sidebar mobile sheet", () => {
  const originalMatchMedia = window.matchMedia;

  function stubMatchMedia(isMobile: boolean) {
    let matches = isMobile;
    const listeners = new Set<EventListenerOrEventListenerObject>();
    const mql = {
      get matches() {
        return matches;
      },
      media: "(max-width: 1023px)",
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn((_type: string, listener: EventListenerOrEventListenerObject) => {
        listeners.add(listener);
      }),
      removeEventListener: vi.fn((_type: string, listener: EventListenerOrEventListenerObject) => {
        listeners.delete(listener);
      }),
      dispatchEvent: vi.fn(),
    } as MediaQueryList;
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      writable: true,
      value: vi.fn().mockReturnValue(mql),
    });
    return {
      setMobile(next: boolean) {
        matches = next;
        const event = new Event("change");
        for (const listener of listeners) {
          if (typeof listener === "function") listener(event);
          else listener.handleEvent(event);
        }
      },
    };
  }

  afterEach(() => {
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      writable: true,
      value: originalMatchMedia,
    });
  });

  it("renders the Dialog sheet branch when the viewport matches the mobile breakpoint", () => {
    stubMatchMedia(true);
    render(
      <Sidebar.Provider>
        <Sidebar>
          <Sidebar.Content>
            <Sidebar.Item as="button">Item</Sidebar.Item>
          </Sidebar.Content>
        </Sidebar>
      </Sidebar.Provider>,
    );
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it.each([
    ["uncontrolled", { defaultState: "rail" as const }],
    ["controlled", { state: "rail" as const }],
  ])("presents a %s rail state as an open mobile sidebar", (_mode, providerProps) => {
    stubMatchMedia(true);
    render(
      <Sidebar.Provider {...providerProps}>
        <Sidebar>
          <Sidebar.Content>
            <Sidebar.Item as="button">
              <Sidebar.ItemLabel>Item label</Sidebar.ItemLabel>
            </Sidebar.Item>
          </Sidebar.Content>
        </Sidebar>
      </Sidebar.Provider>,
    );

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: "Primary" })).toHaveAttribute(
      "data-state",
      "open",
    );
    expect(screen.getByText("Item label")).toBeInTheDocument();
  });

  it("restores a desktop rail presentation after a mobile resize", () => {
    const viewport = stubMatchMedia(false);
    render(
      <Sidebar.Provider defaultState="rail">
        <Sidebar>
          <Sidebar.Content>
            <Sidebar.Item as="button">Item</Sidebar.Item>
          </Sidebar.Content>
        </Sidebar>
      </Sidebar.Provider>,
    );

    expect(screen.getByRole("navigation", { name: "Primary" })).toHaveAttribute(
      "data-state",
      "rail",
    );

    act(() => viewport.setMobile(true));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: "Primary" })).toHaveAttribute(
      "data-state",
      "open",
    );

    act(() => viewport.setMobile(false));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: "Primary" })).toHaveAttribute(
      "data-state",
      "rail",
    );
  });

  it("toggles every visible mobile state through hidden and back to open", async () => {
    const user = userEvent.setup();
    stubMatchMedia(true);
    render(
      <Sidebar.Provider defaultState="rail">
        <Sidebar>
          <Sidebar.Content>
            <Sidebar.Item as="button">Item</Sidebar.Item>
          </Sidebar.Content>
        </Sidebar>
        <Sidebar.Trigger>Toggle</Sidebar.Trigger>
      </Sidebar.Provider>,
    );

    await user.click(screen.getByRole("button", { name: "Close navigation" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Open navigation" }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: "Primary" })).toHaveAttribute(
      "data-state",
      "open",
    );
  });

  it("uses the mobile visible-hidden transition for Cmd+B", () => {
    const onStateChange = vi.fn();
    stubMatchMedia(true);
    render(
      <Sidebar.Provider defaultState="rail" onStateChange={onStateChange}>
        <Sidebar>
          <Sidebar.Content>
            <Sidebar.Item as="button">Item</Sidebar.Item>
          </Sidebar.Content>
        </Sidebar>
      </Sidebar.Provider>,
    );

    act(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "b", metaKey: true }));
    });
    expect(onStateChange).toHaveBeenLastCalledWith("hidden");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    act(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "b", metaKey: true }));
    });
    expect(onStateChange).toHaveBeenLastCalledWith("open");
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("requests hidden from a controlled mobile rail without exposing rail presentation", async () => {
    const user = userEvent.setup();
    const onStateChange = vi.fn();
    stubMatchMedia(true);
    render(
      <Sidebar.Provider state="rail" onStateChange={onStateChange}>
        <Sidebar>
          <Sidebar.Content>
            <Sidebar.Item as="button">Item</Sidebar.Item>
          </Sidebar.Content>
        </Sidebar>
        <Sidebar.Trigger>Toggle</Sidebar.Trigger>
      </Sidebar.Provider>,
    );

    expect(screen.getByRole("navigation", { name: "Primary" })).toHaveAttribute(
      "data-state",
      "open",
    );
    await user.click(screen.getByRole("button", { name: "Close navigation" }));
    expect(onStateChange).toHaveBeenCalledWith("hidden");
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("renders the plain nav (no Dialog) on desktop viewports", () => {
    stubMatchMedia(false);
    render(
      <Sidebar.Provider>
        <Sidebar>
          <Sidebar.Content>
            <Sidebar.Item as="button">Item</Sidebar.Item>
          </Sidebar.Content>
        </Sidebar>
      </Sidebar.Provider>,
    );
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: "Primary" })).toBeInTheDocument();
  });

  it("renders inline navigation on mobile when embedded is true", () => {
    stubMatchMedia(true);
    render(
      <Sidebar.Provider>
        <Sidebar embedded>
          <Sidebar.Content>
            <Sidebar.Item as="button">Item</Sidebar.Item>
          </Sidebar.Content>
        </Sidebar>
      </Sidebar.Provider>,
    );
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: "Primary" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Item" })).toBeInTheDocument();
  });

  it("subscribes to the sidebar owner window and cleans up the exact media query", () => {
    stubMatchMedia(false);
    const iframe = document.createElement("iframe");
    document.body.append(iframe);
    const frameDocument = requireValue(iframe.contentDocument, "iframe document");
    const frameWindow = requireValue(iframe.contentWindow, "iframe window");
    const dialogPrototype = Object.getPrototypeOf(
      frameDocument.createElement("dialog"),
    ) as HTMLDialogElement;
    Object.defineProperties(dialogPrototype, {
      showModal: {
        configurable: true,
        value(this: HTMLDialogElement) {
          this.setAttribute("open", "");
        },
      },
      close: {
        configurable: true,
        value(this: HTMLDialogElement) {
          this.removeAttribute("open");
        },
      },
    });
    let matches = true;
    const listeners = new Set<EventListenerOrEventListenerObject>();
    const addEventListener = vi.fn((type: string, listener: EventListenerOrEventListenerObject) => {
      if (type === "change") listeners.add(listener);
    });
    const removeEventListener = vi.fn(
      (type: string, listener: EventListenerOrEventListenerObject) => {
        if (type === "change") listeners.delete(listener);
      },
    );
    const mediaQueryList = {
      get matches() {
        return matches;
      },
      media: "(max-width: 1023px)",
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener,
      removeEventListener,
      dispatchEvent: vi.fn(),
    } as MediaQueryList;
    const frameMatchMedia = vi.fn(() => mediaQueryList);
    Object.defineProperty(frameWindow, "matchMedia", {
      configurable: true,
      writable: true,
      value: frameMatchMedia,
    });

    const rendered = render(
      <Sidebar.Provider>
        <Sidebar>
          <Sidebar.Content>
            <Sidebar.Item as="button">Frame item</Sidebar.Item>
          </Sidebar.Content>
        </Sidebar>
      </Sidebar.Provider>,
      { baseElement: frameDocument.body, container: frameDocument.body },
    );

    expect(rendered.getByRole("dialog")).toBeInTheDocument();
    expect(frameMatchMedia).toHaveBeenCalledTimes(1);
    expect(window.matchMedia).not.toHaveBeenCalled();
    expect(addEventListener).toHaveBeenCalledTimes(1);

    act(() => {
      matches = false;
      for (const listener of listeners) {
        if (typeof listener === "function") listener(new Event("change"));
        else listener.handleEvent(new Event("change"));
      }
    });

    expect(rendered.queryByRole("dialog")).not.toBeInTheDocument();
    expect(rendered.getByRole("navigation", { name: "Primary" })).toBeInTheDocument();

    rendered.unmount();
    expect(removeEventListener).toHaveBeenCalledWith("change", addEventListener.mock.calls[0]?.[1]);
    expect(listeners).toHaveLength(0);
    iframe.remove();
  });
});
