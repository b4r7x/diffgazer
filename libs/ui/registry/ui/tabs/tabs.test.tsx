import { testNavigationBehavior } from "@diffgazer/keys/testing/navigation-behavior";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { type ReactNode, useState } from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, expectTypeOf, it, vi } from "vitest";
import { axe } from "../../../testing/axe";
import { requireElement, requireValue } from "../../testing/assertions";
import { Tabs } from "./index";
import type { TabsProps } from "./tabs";
import type { TabsTriggerProps } from "./tabs-trigger";

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

    // Without registration the controlled value would silently fall back to the
    // first tab because the static children walk cannot see through WrappedTab.
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
    // The unregistered value still resolves to the first enabled tab (no crash).
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

    // Flush the deferred dev-warn frame: the wrapper triggers register before it
    // fires, so no warning should appear for the legitimately-rendered value.
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

  it("moves focus with ArrowRight/ArrowLeft in horizontal mode (automatic)", async () => {
    const user = userEvent.setup();
    renderTabs();
    screen.getByRole("tab", { name: "One" }).focus();
    await user.keyboard("{ArrowRight}");
    expect(screen.getByRole("tab", { name: "Two" })).toHaveFocus();
    expect(screen.getByRole("tab", { name: "Two" })).toHaveAttribute("aria-selected", "true");

    await user.keyboard("{ArrowLeft}");
    expect(screen.getByRole("tab", { name: "One" })).toHaveFocus();
    expect(screen.getByRole("tab", { name: "One" })).toHaveAttribute("aria-selected", "true");
  });

  it("moves focus with ArrowDown/ArrowUp in vertical mode (automatic)", async () => {
    const user = userEvent.setup();
    renderTabs({ orientation: "vertical" });
    screen.getByRole("tab", { name: "One" }).focus();
    await user.keyboard("{ArrowDown}");
    expect(screen.getByRole("tab", { name: "Two" })).toHaveFocus();
    expect(screen.getByRole("tab", { name: "Two" })).toHaveAttribute("aria-selected", "true");

    await user.keyboard("{ArrowUp}");
    expect(screen.getByRole("tab", { name: "One" })).toHaveFocus();
    expect(screen.getByRole("tab", { name: "One" })).toHaveAttribute("aria-selected", "true");
  });

  it("in manual mode, arrow keys move focus but do not select", async () => {
    const user = userEvent.setup();
    renderTabs({ activationMode: "manual" });
    screen.getByRole("tab", { name: "One" }).focus();
    await user.keyboard("{ArrowRight}");
    expect(screen.getByRole("tab", { name: "Two" })).toHaveFocus();
    expect(screen.getByRole("tab", { name: "One" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tab", { name: "Two" })).toHaveAttribute("aria-selected", "false");
    expect(screen.getByRole("tab", { name: "One" })).toHaveAttribute("tabindex", "-1");
    expect(screen.getByRole("tab", { name: "Two" })).toHaveAttribute("tabindex", "0");
  });

  it("in manual mode, restores the selected tab as tabbable when focus leaves the tablist", async () => {
    const user = userEvent.setup();
    render(
      <>
        <Tabs defaultValue="one" activationMode="manual">
          <Tabs.List>
            <Tabs.Trigger value="one">One</Tabs.Trigger>
            <Tabs.Trigger value="two">Two</Tabs.Trigger>
          </Tabs.List>
          <Tabs.Content value="one">Content one</Tabs.Content>
          <Tabs.Content value="two">Content two</Tabs.Content>
        </Tabs>
        <button type="button">After</button>
      </>,
    );

    const one = screen.getByRole("tab", { name: "One" });
    const two = screen.getByRole("tab", { name: "Two" });
    one.focus();
    await user.keyboard("{ArrowRight}");
    expect(two).toHaveAttribute("tabindex", "0");

    await user.tab();
    expect(screen.getByRole("tabpanel", { name: "One" })).toHaveFocus();
    expect(one).toHaveAttribute("tabindex", "0");
    expect(two).toHaveAttribute("tabindex", "-1");
  });

  it("in manual mode, Enter activates the focused tab", async () => {
    const user = userEvent.setup();
    renderTabs({ activationMode: "manual" });
    screen.getByRole("tab", { name: "One" }).focus();
    await user.keyboard("{ArrowRight}");
    expect(screen.getByRole("tab", { name: "Two" })).toHaveFocus();
    await user.keyboard("{Enter}");
    expect(screen.getByRole("tab", { name: "Two" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByText("Content two")).not.toHaveAttribute("hidden");
  });

  it("wraps focus around by default", async () => {
    const user = userEvent.setup();
    renderTabs({ activationMode: "manual" });
    screen.getByRole("tab", { name: "One" }).focus();
    await user.keyboard("{ArrowRight}");
    await user.keyboard("{ArrowRight}");
    expect(screen.getByRole("tab", { name: "Three" })).toHaveFocus();
    await user.keyboard("{ArrowRight}");
    expect(screen.getByRole("tab", { name: "One" })).toHaveFocus();
  });

  it("in manual mode, Space activates the focused tab", async () => {
    const user = userEvent.setup();
    renderTabs({ activationMode: "manual" });
    screen.getByRole("tab", { name: "One" }).focus();

    await user.keyboard("{ArrowRight}");
    expect(screen.getByRole("tab", { name: "Two" })).toHaveFocus();
    expect(screen.getByRole("tab", { name: "Two" })).toHaveAttribute("aria-selected", "false");

    await user.keyboard(" ");
    expect(screen.getByRole("tab", { name: "Two" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByText("Content two")).not.toHaveAttribute("hidden");
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

  it("keeps value strings unchanged while encoding DOM id references", async () => {
    const user = userEvent.setup();
    const value = "release notes/v1.2?";
    render(
      <Tabs defaultValue={value}>
        <Tabs.List>
          <Tabs.Trigger value={value}>Release</Tabs.Trigger>
          <Tabs.Trigger value="other">Other</Tabs.Trigger>
        </Tabs.List>
        <Tabs.Content value={value}>Release content</Tabs.Content>
        <Tabs.Content value="other">Other content</Tabs.Content>
      </Tabs>,
    );

    const tab = screen.getByRole("tab", { name: "Release" });
    const panel = screen.getByRole("tabpanel", { name: "Release" });

    expect(tab).toHaveAttribute("data-value", value);
    expect(tab.id).toContain(encodeURIComponent(value));
    expect(tab).toHaveAttribute("aria-controls", panel.id);
    expect(panel).toHaveAttribute("aria-labelledby", tab.id);

    await user.click(screen.getByRole("tab", { name: "Other" }));
    expect(screen.getByRole("tab", { name: "Other" })).toHaveAttribute("aria-selected", "true");
  });

  it("only emits aria-controls for tabs with a rendered panel", () => {
    render(
      <Tabs defaultValue="one">
        <Tabs.List>
          <Tabs.Trigger value="one">One</Tabs.Trigger>
          <Tabs.Trigger value="missing">Missing panel</Tabs.Trigger>
        </Tabs.List>
        <Tabs.Content value="one">Content one</Tabs.Content>
      </Tabs>,
    );

    const tab = screen.getByRole("tab", { name: "One" });
    const missing = screen.getByRole("tab", { name: "Missing panel" });
    const panelId = requireValue(tab.getAttribute("aria-controls"), "tab panel aria-controls");

    expect(requireElement(document.getElementById(panelId), "tab panel")).toBeInTheDocument();
    expect(missing).not.toHaveAttribute("aria-controls");
  });

  it("omits aria-labelledby for content without a matching trigger", () => {
    render(
      <Tabs defaultValue="one">
        <Tabs.List>
          <Tabs.Trigger value="one">One</Tabs.Trigger>
        </Tabs.List>
        <Tabs.Content value="one">Content one</Tabs.Content>
        <Tabs.Content value="missing">Missing trigger content</Tabs.Content>
      </Tabs>,
    );

    const missingPanel = screen.getByText("Missing trigger content");
    expect(missingPanel).not.toHaveAttribute("aria-labelledby");
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

describe("Tabs keyboard navigation", () => {
  testNavigationBehavior({
    setup: () => {
      const rendered = renderTabs({ activationMode: "manual" });
      screen.getByRole("tab", { name: "One" }).focus();
      return rendered;
    },
    items: ["One", "Two", "Three"],
    initialActive: 0,
    cases: [
      { key: "{ArrowRight}", expectedActiveIndex: 1, label: "ArrowRight" },
      { key: "{ArrowRight}{ArrowRight}", expectedActiveIndex: 2, label: "ArrowRight twice" },
      {
        key: "{ArrowRight}{ArrowRight}{ArrowRight}",
        expectedActiveIndex: 0,
        label: "ArrowRight wraps",
      },
      { key: "{ArrowLeft}", expectedActiveIndex: 2, label: "ArrowLeft wraps to end" },
      { key: "{End}", expectedActiveIndex: 2, label: "End jumps to last" },
      { key: "{Home}", expectedActiveIndex: 0, label: "Home stays at first" },
    ],
  });
});

describe("Tabs variants", () => {
  it("defaults to variant='underline' and propagates it via data-variant on the tablist", () => {
    renderTabs();
    expect(screen.getByRole("tablist")).toHaveAttribute("data-variant", "underline");
  });

  it("propagates variant='default' via data-variant on the tablist", () => {
    renderTabs({ variant: "default" });
    expect(screen.getByRole("tablist")).toHaveAttribute("data-variant", "default");
  });

  it("renders a sliding pill indicator for variant='pill'", () => {
    const { container } = render(
      <Tabs defaultValue="b" variant="pill">
        <Tabs.List>
          <Tabs.Trigger value="a">Alpha</Tabs.Trigger>
          <Tabs.Trigger value="b">Beta</Tabs.Trigger>
        </Tabs.List>
        <Tabs.Content value="a">Alpha content</Tabs.Content>
        <Tabs.Content value="b">Beta content</Tabs.Content>
      </Tabs>,
    );
    // The sliding indicator is a presentational element with no ARIA role; its
    // per-variant presence is the public DOM contract that tabs.css positions.
    expect(container.querySelectorAll('[data-slot="tabs-pill"]').length).toBe(1);
  });

  it("resolves the pill indicator inside a same-origin iframe ownerDocument", () => {
    const iframe = document.createElement("iframe");
    document.body.appendChild(iframe);
    const iframeDoc = iframe.contentDocument;
    if (!iframeDoc) {
      iframe.remove();
      throw new Error("iframe.contentDocument is null; cannot exercise cross-document tabs");
    }
    const container = iframeDoc.createElement("div");
    iframeDoc.body.appendChild(container);

    render(
      <Tabs defaultValue="b" variant="pill">
        <Tabs.List>
          <Tabs.Trigger value="a">Alpha</Tabs.Trigger>
          <Tabs.Trigger value="b">Beta</Tabs.Trigger>
        </Tabs.List>
        <Tabs.Content value="a">Alpha content</Tabs.Content>
        <Tabs.Content value="b">Beta content</Tabs.Content>
      </Tabs>,
      { container },
    );

    expect(container.querySelectorAll('[data-slot="tabs-pill"]').length).toBe(1);

    iframe.remove();
  });

  it("omits the sliding pill indicator for variants other than 'pill'", () => {
    const { container } = render(
      <Tabs defaultValue="b" variant="default">
        <Tabs.List>
          <Tabs.Trigger value="a">Alpha</Tabs.Trigger>
          <Tabs.Trigger value="b">Beta</Tabs.Trigger>
        </Tabs.List>
        <Tabs.Content value="a">Alpha content</Tabs.Content>
        <Tabs.Content value="b">Beta content</Tabs.Content>
      </Tabs>,
    );
    expect(container.querySelector('[data-slot="tabs-pill"]')).toBeNull();
  });

  it("renders a floating underline indicator for variant='underline'", () => {
    const { container } = render(
      <Tabs defaultValue="b" variant="underline">
        <Tabs.List>
          <Tabs.Trigger value="a">Alpha</Tabs.Trigger>
          <Tabs.Trigger value="b">Beta</Tabs.Trigger>
        </Tabs.List>
        <Tabs.Content value="a">Alpha content</Tabs.Content>
        <Tabs.Content value="b">Beta content</Tabs.Content>
      </Tabs>,
    );
    // Like the pill, the floating underline is a presentational, role-less
    // element; its per-variant presence is the documented DOM contract.
    expect(container.querySelectorAll('[data-slot="tabs-underline"]').length).toBe(1);
  });

  it("does not render underline indicator for variant='pill'", () => {
    const { container } = render(
      <Tabs defaultValue="b" variant="pill">
        <Tabs.List>
          <Tabs.Trigger value="a">Alpha</Tabs.Trigger>
          <Tabs.Trigger value="b">Beta</Tabs.Trigger>
        </Tabs.List>
        <Tabs.Content value="a">Alpha content</Tabs.Content>
        <Tabs.Content value="b">Beta content</Tabs.Content>
      </Tabs>,
    );
    expect(container.querySelector('[data-slot="tabs-underline"]')).toBeNull();
  });

  it("renders bracket markers only on the active trigger in variant='bracket'", () => {
    render(
      <Tabs defaultValue="b" variant="bracket">
        <Tabs.List>
          <Tabs.Trigger value="a">Alpha</Tabs.Trigger>
          <Tabs.Trigger value="b">Beta</Tabs.Trigger>
        </Tabs.List>
        <Tabs.Content value="a">Alpha content</Tabs.Content>
        <Tabs.Content value="b">Beta content</Tabs.Content>
      </Tabs>,
    );
    // Both triggers carry the bracket marker spans (so width stays steady),
    // but only the active one has data-state="active" set — the CSS opacity rule
    // on group-data-[state=active]/segmented-item reveals them visually.
    const activeTrigger = screen.getByRole("tab", { name: /beta/i });
    const inactiveTrigger = screen.getByRole("tab", { name: /alpha/i });
    expect(activeTrigger).toHaveAttribute("data-state", "active");
    expect(inactiveTrigger).toHaveAttribute("data-state", "inactive");
    expect(activeTrigger).toHaveTextContent(/^\[\s*Beta\s*\]$/);
    expect(inactiveTrigger).toHaveTextContent(/^\[\s*Alpha\s*\]$/);
  });

  it("marks the active trigger via data-state in variant='default'", () => {
    render(
      <Tabs defaultValue="b" variant="default">
        <Tabs.List>
          <Tabs.Trigger value="a">Alpha</Tabs.Trigger>
          <Tabs.Trigger value="b">Beta</Tabs.Trigger>
        </Tabs.List>
        <Tabs.Content value="a">Alpha content</Tabs.Content>
        <Tabs.Content value="b">Beta content</Tabs.Content>
      </Tabs>,
    );
    expect(screen.getByRole("tab", { name: /alpha/i })).toHaveAttribute("data-state", "inactive");
    expect(screen.getByRole("tab", { name: /beta/i })).toHaveAttribute("data-state", "active");
  });
});

describe("Tabs types", () => {
  it("narrows value to the supplied literal union", () => {
    type Narrow = TabsProps<"preview" | "code">;

    expectTypeOf<Narrow["value"]>().toEqualTypeOf<"preview" | "code" | undefined>();
    expectTypeOf<Narrow["defaultValue"]>().toEqualTypeOf<"preview" | "code" | undefined>();
    expectTypeOf<NonNullable<Narrow["onChange"]>>()
      .parameter(0)
      .toEqualTypeOf<"preview" | "code">();
  });

  it("rejects TabsTrigger values outside the literal union", () => {
    type Trigger = TabsTriggerProps<"preview" | "code">;

    expectTypeOf<Trigger["value"]>().toEqualTypeOf<"preview" | "code">();
    // "tests" is not part of the union; the prop type must reject it.
    expectTypeOf<"tests">().not.toMatchTypeOf<Trigger["value"]>();
    expectTypeOf<"preview">().toMatchTypeOf<Trigger["value"]>();
  });

  it("keeps the loose default contract when no generic is supplied", () => {
    expectTypeOf<TabsProps["value"]>().toEqualTypeOf<string | undefined>();
    expectTypeOf<TabsTriggerProps["value"]>().toEqualTypeOf<string>();
  });

  it("does not expose a polymorphic render or asChild escape hatch on Tabs.Trigger", () => {
    // WAI-ARIA forbids a role="tab" from navigating URLs — Tabs.Trigger must
    // not be swappable into <a> via render/asChild. Verify the prop type does
    // not include either key.
    expectTypeOf<TabsTriggerProps>().toHaveProperty("value");
    expectTypeOf<TabsTriggerProps>().not.toHaveProperty("render");
    expectTypeOf<TabsTriggerProps>().not.toHaveProperty("asChild");
  });
});
