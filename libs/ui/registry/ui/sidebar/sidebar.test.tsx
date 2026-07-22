import { getTabbableElements } from "@diffgazer/keys";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Ref } from "react";
import { describe, expect, it, vi } from "vitest";
import { axe } from "../../../testing/axe";
import { requireElement } from "../../testing/assertions";
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
    const trigger = screen.getByRole("button", { name: "Collapse sidebar" });

    await user.click(trigger);

    expect(onClick).toHaveBeenCalledOnce();
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(trigger).toHaveAccessibleName("Expand sidebar");
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
