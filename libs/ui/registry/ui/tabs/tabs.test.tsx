import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { type ReactNode, useState } from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { axe } from "../../../testing/axe";
import { requireElement } from "../../testing/assertions";
import { Tabs } from "./index";
import type { TabsProps } from "./tabs";

function renderTabs(props: Partial<TabsProps> = {}) {
  return render(
    <Tabs defaultValue="one" {...props}>
      <Tabs.List>
        <Tabs.Trigger value="one">One</Tabs.Trigger>
        <Tabs.Trigger value="two">Two</Tabs.Trigger>
        <Tabs.Trigger value="three">Three</Tabs.Trigger>
      </Tabs.List>
      <Tabs.Content value="one">Content one</Tabs.Content>
      <Tabs.Content value="two">Content two</Tabs.Content>
      <Tabs.Content value="three">Content three</Tabs.Content>
    </Tabs>,
  );
}

describe("Tabs", () => {
  it("supports direct namespaced compound parts with custom trigger UI", async () => {
    const user = userEvent.setup();
    render(
      <Tabs defaultValue="overview">
        <Tabs.List>
          <Tabs.Trigger value="overview">
            <span>Overview</span>
          </Tabs.Trigger>
          <Tabs.Trigger value="settings">
            <span>Settings</span>
          </Tabs.Trigger>
        </Tabs.List>
        <Tabs.Content value="overview">Overview panel</Tabs.Content>
        <Tabs.Content value="settings">Settings panel</Tabs.Content>
      </Tabs>,
    );

    await user.click(screen.getByRole("tab", { name: "Settings" }));

    expect(screen.getByRole("tab", { name: "Settings" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByText("Settings panel")).not.toHaveAttribute("hidden");
  });

  it("resolves a controlled value through a trigger rendered by a consumer wrapper", () => {
    function WrappedTab({ value, children }: { value: string; children: ReactNode }) {
      return <Tabs.Trigger value={value}>{children}</Tabs.Trigger>;
    }
    function WrappedPanel({ value, children }: { value: string; children: ReactNode }) {
      return <Tabs.Content value={value}>{children}</Tabs.Content>;
    }

    render(
      <Tabs value="second">
        <Tabs.List>
          <WrappedTab value="first">First</WrappedTab>
          <WrappedTab value="second">Second</WrappedTab>
        </Tabs.List>
        <WrappedPanel value="first">First panel</WrappedPanel>
        <WrappedPanel value="second">Second panel</WrappedPanel>
      </Tabs>,
    );

    // The static children walk cannot see through WrappedTab; without registration
    // the controlled value would fall back to the first tab.
    expect(screen.getByRole("tab", { name: "Second" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tab", { name: "First" })).toHaveAttribute("aria-selected", "false");
    expect(screen.getByText("Second panel")).not.toHaveAttribute("hidden");
  });

  it("warns in development when a controlled value matches no registered trigger", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    render(
      <Tabs value="ghost">
        <Tabs.List>
          <Tabs.Trigger value="one">One</Tabs.Trigger>
          <Tabs.Trigger value="two">Two</Tabs.Trigger>
        </Tabs.List>
        <Tabs.Content value="one">Content one</Tabs.Content>
        <Tabs.Content value="two">Content two</Tabs.Content>
      </Tabs>,
    );

    await waitFor(() => expect(warn).toHaveBeenCalled());
    expect(warn.mock.calls[0]?.[0]).toContain("ghost");
    expect(warn.mock.calls[0]?.[0]).toContain("Tabs");
    expect(screen.getByRole("tab", { name: "One" })).toHaveAttribute("aria-selected", "true");

    warn.mockRestore();
  });

  it("does not warn when a controlled value matches a wrapper-rendered trigger", async () => {
    function WrappedTab({ value, children }: { value: string; children: ReactNode }) {
      return <Tabs.Trigger value={value}>{children}</Tabs.Trigger>;
    }
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    render(
      <Tabs value="second">
        <Tabs.List>
          <WrappedTab value="first">First</WrappedTab>
          <WrappedTab value="second">Second</WrappedTab>
        </Tabs.List>
        <Tabs.Content value="first">First panel</Tabs.Content>
        <Tabs.Content value="second">Second panel</Tabs.Content>
      </Tabs>,
    );

    // Flush the deferred dev-warn frame; wrapper triggers register before it fires.
    await new Promise((resolve) => requestAnimationFrame(() => resolve(undefined)));
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });

  it("selects a tab on click", async () => {
    const user = userEvent.setup();
    renderTabs();
    await user.click(screen.getByRole("tab", { name: "Two" }));
    expect(screen.getByRole("tab", { name: "Two" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tab", { name: "One" })).toHaveAttribute("aria-selected", "false");
    expect(screen.getByText("Content two")).not.toHaveAttribute("hidden");
    expect(screen.getByText("Content one")).toHaveAttribute("hidden");
  });

  it("does not select a disabled tab on click", async () => {
    const user = userEvent.setup();
    render(
      <Tabs defaultValue="one">
        <Tabs.List>
          <Tabs.Trigger value="one">One</Tabs.Trigger>
          <Tabs.Trigger value="two" disabled>
            Two
          </Tabs.Trigger>
        </Tabs.List>
        <Tabs.Content value="one">Content one</Tabs.Content>
        <Tabs.Content value="two">Content two</Tabs.Content>
      </Tabs>,
    );
    await user.click(screen.getByRole("tab", { name: "Two" }));
    expect(screen.getByRole("tab", { name: "One" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tab", { name: "Two" })).toHaveAttribute("aria-selected", "false");
  });

  it("keeps explicit value undefined controlled instead of adopting internal selection", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <Tabs value={undefined} onChange={onChange}>
        <Tabs.List>
          <Tabs.Trigger value="one">One</Tabs.Trigger>
          <Tabs.Trigger value="two">Two</Tabs.Trigger>
        </Tabs.List>
        <Tabs.Content value="one">Content one</Tabs.Content>
        <Tabs.Content value="two">Content two</Tabs.Content>
      </Tabs>,
    );

    expect(screen.getByRole("tab", { name: "One" })).toHaveAttribute("aria-selected", "true");
    await user.click(screen.getByRole("tab", { name: "Two" }));
    expect(onChange).toHaveBeenCalledWith("two");
    expect(screen.getByRole("tab", { name: "One" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tab", { name: "Two" })).toHaveAttribute("aria-selected", "false");
  });

  it("respects controlled value and fires onChange", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const { rerender } = render(
      <Tabs value="one" onChange={onChange}>
        <Tabs.List>
          <Tabs.Trigger value="one">One</Tabs.Trigger>
          <Tabs.Trigger value="two">Two</Tabs.Trigger>
        </Tabs.List>
        <Tabs.Content value="one">Content one</Tabs.Content>
        <Tabs.Content value="two">Content two</Tabs.Content>
      </Tabs>,
    );
    await user.click(screen.getByRole("tab", { name: "Two" }));
    expect(onChange).toHaveBeenCalledWith("two");
    expect(screen.getByRole("tab", { name: "One" })).toHaveAttribute("aria-selected", "true");

    rerender(
      <Tabs value="two" onChange={onChange}>
        <Tabs.List>
          <Tabs.Trigger value="one">One</Tabs.Trigger>
          <Tabs.Trigger value="two">Two</Tabs.Trigger>
        </Tabs.List>
        <Tabs.Content value="one">Content one</Tabs.Content>
        <Tabs.Content value="two">Content two</Tabs.Content>
      </Tabs>,
    );
    expect(screen.getByRole("tab", { name: "Two" })).toHaveAttribute("aria-selected", "true");
  });

  it("has no a11y violations", async () => {
    const { container } = renderTabs();
    expect(await axe(container)).toHaveNoViolations();
  });

  it("selects the first enabled tab when uncontrolled tabs have no default value", () => {
    render(
      <Tabs>
        <Tabs.List>
          <Tabs.Trigger value="one">One</Tabs.Trigger>
          <Tabs.Trigger value="two">Two</Tabs.Trigger>
        </Tabs.List>
        <Tabs.Content value="one">Content one</Tabs.Content>
        <Tabs.Content value="two">Content two</Tabs.Content>
      </Tabs>,
    );
    expect(screen.getByRole("tab", { name: "One" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tab", { name: "One" })).toHaveAttribute("tabindex", "0");
    expect(screen.getByText("Content one")).not.toHaveAttribute("hidden");
  });

  it("keeps one enabled fallback tab selected and tabbable for invalid controlled values", () => {
    const onChange = vi.fn();

    render(
      <Tabs value="missing" onChange={onChange}>
        <Tabs.List>
          <Tabs.Trigger value="one">One</Tabs.Trigger>
          <Tabs.Trigger value="two">Two</Tabs.Trigger>
        </Tabs.List>
        <Tabs.Content value="one">Content one</Tabs.Content>
        <Tabs.Content value="two">Content two</Tabs.Content>
      </Tabs>,
    );

    expect(screen.getByRole("tab", { name: "One" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tab", { name: "One" })).toHaveAttribute("tabindex", "0");
    expect(screen.getByRole("tab", { name: "Two" })).toHaveAttribute("aria-selected", "false");
    expect(screen.getByText("Content one")).not.toHaveAttribute("hidden");
    expect(screen.getByText("Content two")).toHaveAttribute("hidden");
    expect(onChange).not.toHaveBeenCalled();
  });

  it("does not collect triggers from nested tabs when resolving parent fallback", () => {
    render(
      <Tabs value="missing">
        <Tabs.Content value="parent-panel">
          <Tabs defaultValue="nested-one">
            <Tabs.List>
              <Tabs.Trigger value="nested-one">Nested one</Tabs.Trigger>
              <Tabs.Trigger value="nested-two">Nested two</Tabs.Trigger>
            </Tabs.List>
            <Tabs.Content value="nested-one">Nested content</Tabs.Content>
            <Tabs.Content value="nested-two">Other nested content</Tabs.Content>
          </Tabs>
        </Tabs.Content>
        <Tabs.List>
          <Tabs.Trigger value="parent-one">Parent one</Tabs.Trigger>
          <Tabs.Trigger value="parent-two">Parent two</Tabs.Trigger>
        </Tabs.List>
        <Tabs.Content value="parent-one">Parent content</Tabs.Content>
        <Tabs.Content value="parent-two">Other parent content</Tabs.Content>
      </Tabs>,
    );

    expect(screen.getByRole("tab", { name: "Parent one" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(screen.getByRole("tab", { name: "Nested one", hidden: true })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(screen.getByText("Parent content")).not.toHaveAttribute("hidden");
    expect(screen.getByText("Nested content")).toBeInTheDocument();
  });

  it("skips disabled tabs when choosing an invalid controlled fallback", () => {
    render(
      <Tabs value="missing">
        <Tabs.List>
          <Tabs.Trigger value="one" disabled>
            One
          </Tabs.Trigger>
          <Tabs.Trigger value="two">Two</Tabs.Trigger>
        </Tabs.List>
        <Tabs.Content value="one">Content one</Tabs.Content>
        <Tabs.Content value="two">Content two</Tabs.Content>
      </Tabs>,
    );

    expect(screen.getByRole("tab", { name: "One" })).toHaveAttribute("aria-selected", "false");
    expect(screen.getByRole("tab", { name: "One" })).toHaveAttribute("tabindex", "-1");
    expect(screen.getByRole("tab", { name: "Two" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tab", { name: "Two" })).toHaveAttribute("tabindex", "0");
    expect(screen.getByText("Content two")).not.toHaveAttribute("hidden");
  });

  describe("skipped-trigger selection fallback", () => {
    function expectSecondTriggerSelected(container: HTMLElement) {
      const first = requireElement(
        container.querySelector('[role="tab"][data-value="one"]'),
        "first trigger",
      );
      const second = requireElement(
        container.querySelector('[role="tab"][data-value="two"]'),
        "second trigger",
      );
      expect(first).toHaveAttribute("aria-selected", "false");
      expect(first).toHaveAttribute("tabindex", "-1");
      expect(second).toHaveAttribute("aria-selected", "true");
      expect(second).toHaveAttribute("tabindex", "0");
    }

    it("skips a hidden first trigger when resolving an invalid controlled fallback", () => {
      const { container } = render(
        <Tabs value="missing">
          <Tabs.List>
            <Tabs.Trigger value="one" hidden>
              One
            </Tabs.Trigger>
            <Tabs.Trigger value="two">Two</Tabs.Trigger>
          </Tabs.List>
          <Tabs.Content value="one">Content one</Tabs.Content>
          <Tabs.Content value="two">Content two</Tabs.Content>
        </Tabs>,
      );
      expectSecondTriggerSelected(container);
    });

    it("skips an inert first trigger when resolving an invalid controlled fallback", () => {
      const { container } = render(
        <Tabs value="missing">
          <Tabs.List>
            <Tabs.Trigger value="one" inert>
              One
            </Tabs.Trigger>
            <Tabs.Trigger value="two">Two</Tabs.Trigger>
          </Tabs.List>
          <Tabs.Content value="one">Content one</Tabs.Content>
          <Tabs.Content value="two">Content two</Tabs.Content>
        </Tabs>,
      );
      expectSecondTriggerSelected(container);
    });

    it("skips an aria-hidden first trigger when resolving an invalid controlled fallback", () => {
      const { container } = render(
        <Tabs value="missing">
          <Tabs.List>
            <Tabs.Trigger value="one" aria-hidden="true">
              One
            </Tabs.Trigger>
            <Tabs.Trigger value="two">Two</Tabs.Trigger>
          </Tabs.List>
          <Tabs.Content value="one">Content one</Tabs.Content>
          <Tabs.Content value="two">Content two</Tabs.Content>
        </Tabs>,
      );
      expectSecondTriggerSelected(container);
    });

    it("seeds past a hidden first trigger before effects register tabs", () => {
      const markup = renderToString(
        <Tabs>
          <Tabs.List>
            <Tabs.Trigger value="one" hidden>
              One
            </Tabs.Trigger>
            <Tabs.Trigger value="two">Two</Tabs.Trigger>
          </Tabs.List>
          <Tabs.Content value="two">Content two</Tabs.Content>
        </Tabs>,
      );

      const container = document.createElement("div");
      container.innerHTML = markup;
      const tabs = within(container).getAllByRole("tab", { hidden: true });
      const selected = tabs.filter((tab) => tab.getAttribute("aria-selected") === "true");
      const tabbable = tabs.filter((tab) => tab.getAttribute("tabindex") === "0");

      expect(tabs).toHaveLength(2);
      expect(selected).toHaveLength(1);
      expect(selected[0]).toHaveTextContent("Two");
      expect(tabbable).toEqual(selected);
    });
  });

  it("renders one tabbable enabled tab before effects register tabs", () => {
    const markup = renderToString(
      <Tabs>
        <Tabs.List>
          <Tabs.Trigger value="one" disabled>
            One
          </Tabs.Trigger>
          <Tabs.Trigger value="two">Two</Tabs.Trigger>
          <Tabs.Trigger value="three">Three</Tabs.Trigger>
        </Tabs.List>
        <Tabs.Content value="two">Content two</Tabs.Content>
        <Tabs.Content value="three">Content three</Tabs.Content>
      </Tabs>,
    );

    const container = document.createElement("div");
    container.innerHTML = markup;
    const tabs = within(container).getAllByRole("tab");
    const selectedTabs = tabs.filter((tab) => tab.getAttribute("aria-selected") === "true");
    const tabbableTabs = tabs.filter((tab) => tab.getAttribute("tabindex") === "0");

    expect(tabs).toHaveLength(3);
    expect(selectedTabs).toHaveLength(1);
    expect(selectedTabs[0]).toHaveTextContent("Two");
    expect(tabbableTabs).toEqual(selectedTabs);
  });

  it("moves selection when the active uncontrolled tab is removed", async () => {
    const user = userEvent.setup();
    function RemovableTabs() {
      const [showFirst, setShowFirst] = useState(true);

      return (
        <>
          <button type="button" onClick={() => setShowFirst(false)}>
            Remove first
          </button>
          <Tabs defaultValue="one">
            <Tabs.List>
              {showFirst && <Tabs.Trigger value="one">One</Tabs.Trigger>}
              <Tabs.Trigger value="two">Two</Tabs.Trigger>
            </Tabs.List>
            {showFirst && <Tabs.Content value="one">Content one</Tabs.Content>}
            <Tabs.Content value="two">Content two</Tabs.Content>
          </Tabs>
        </>
      );
    }

    render(<RemovableTabs />);
    expect(screen.getByRole("tab", { name: "One" })).toHaveAttribute("aria-selected", "true");

    await user.click(screen.getByRole("button", { name: "Remove first" }));
    expect(screen.getByRole("tab", { name: "Two" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tab", { name: "Two" })).toHaveAttribute("tabindex", "0");
  });

  it("uses the latest onChange callback after rerender", async () => {
    const user = userEvent.setup();
    const firstCallback = vi.fn();
    const secondCallback = vi.fn();
    const { rerender } = render(
      <Tabs defaultValue="one" onChange={firstCallback}>
        <Tabs.List>
          <Tabs.Trigger value="one">One</Tabs.Trigger>
          <Tabs.Trigger value="two">Two</Tabs.Trigger>
        </Tabs.List>
        <Tabs.Content value="one">Content one</Tabs.Content>
        <Tabs.Content value="two">Content two</Tabs.Content>
      </Tabs>,
    );

    rerender(
      <Tabs defaultValue="one" onChange={secondCallback}>
        <Tabs.List>
          <Tabs.Trigger value="one">One</Tabs.Trigger>
          <Tabs.Trigger value="two">Two</Tabs.Trigger>
        </Tabs.List>
        <Tabs.Content value="one">Content one</Tabs.Content>
        <Tabs.Content value="two">Content two</Tabs.Content>
      </Tabs>,
    );

    await user.click(screen.getByRole("tab", { name: "Two" }));
    expect(firstCallback).not.toHaveBeenCalled();
    expect(secondCallback).toHaveBeenCalledWith("two");
  });

  it("composes consumer click handlers with internal selection", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(
      <Tabs defaultValue="one">
        <Tabs.List>
          <Tabs.Trigger value="one">One</Tabs.Trigger>
          <Tabs.Trigger value="two" onClick={onClick}>
            Two
          </Tabs.Trigger>
        </Tabs.List>
        <Tabs.Content value="one">Content one</Tabs.Content>
        <Tabs.Content value="two">Content two</Tabs.Content>
      </Tabs>,
    );

    await user.click(screen.getByRole("tab", { name: "Two" }));
    expect(onClick).toHaveBeenCalled();
    expect(screen.getByRole("tab", { name: "Two" })).toHaveAttribute("aria-selected", "true");
  });

  it("keeps the active tab when a consumer click handler prevents the built-in selection", async () => {
    const user = userEvent.setup();
    render(
      <Tabs defaultValue="one">
        <Tabs.List>
          <Tabs.Trigger value="one">One</Tabs.Trigger>
          <Tabs.Trigger value="two" onClick={(event) => event.preventDefault()}>
            Two
          </Tabs.Trigger>
        </Tabs.List>
        <Tabs.Content value="one">Content one</Tabs.Content>
        <Tabs.Content value="two">Content two</Tabs.Content>
      </Tabs>,
    );

    await user.click(screen.getByRole("tab", { name: "Two" }));
    expect(screen.getByRole("tab", { name: "One" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tab", { name: "Two" })).toHaveAttribute("aria-selected", "false");
  });

  it("keeps focus and selection when a consumer keydown handler prevents built-in ArrowRight navigation", async () => {
    const user = userEvent.setup();
    render(
      <Tabs defaultValue="one">
        <Tabs.List onKeyDown={(event) => event.preventDefault()}>
          <Tabs.Trigger value="one">One</Tabs.Trigger>
          <Tabs.Trigger value="two">Two</Tabs.Trigger>
        </Tabs.List>
        <Tabs.Content value="one">Content one</Tabs.Content>
        <Tabs.Content value="two">Content two</Tabs.Content>
      </Tabs>,
    );

    screen.getByRole("tab", { name: "One" }).focus();
    await user.keyboard("{ArrowRight}");
    expect(screen.getByRole("tab", { name: "One" })).toHaveFocus();
    expect(screen.getByRole("tab", { name: "One" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tab", { name: "Two" })).toHaveAttribute("aria-selected", "false");
  });

  it("does not crash when rendered without triggers or defaultValue", () => {
    render(
      <Tabs>
        <Tabs.List />
      </Tabs>,
    );

    expect(screen.queryByRole("tab")).toBeNull();
  });

  it("respects defaultValue once lazy-loaded triggers mount", async () => {
    const user = userEvent.setup();
    function LazyTabs() {
      const [showTriggers, setShowTriggers] = useState(false);
      return (
        <>
          <button type="button" onClick={() => setShowTriggers(true)}>
            Load triggers
          </button>
          <Tabs defaultValue="two">
            <Tabs.List>
              {showTriggers && <Tabs.Trigger value="one">One</Tabs.Trigger>}
              {showTriggers && <Tabs.Trigger value="two">Two</Tabs.Trigger>}
            </Tabs.List>
            {showTriggers && <Tabs.Content value="one">Content one</Tabs.Content>}
            {showTriggers && <Tabs.Content value="two">Content two</Tabs.Content>}
          </Tabs>
        </>
      );
    }

    render(<LazyTabs />);
    expect(screen.queryByRole("tab")).toBeNull();

    await user.click(screen.getByRole("button", { name: "Load triggers" }));
    expect(screen.getByRole("tab", { name: "Two" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByText("Content two")).not.toHaveAttribute("hidden");
  });
});
