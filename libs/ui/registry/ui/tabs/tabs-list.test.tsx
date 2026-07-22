import { testNavigationBehavior } from "@diffgazer/keys/testing/navigation-behavior";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { axe } from "../../../testing/axe";
import { tabsDoc } from "../../component-docs/tabs";
import { SEGMENTED_VARIANTS } from "../../lib/segmented-variants";
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

describe("Tabs.List navigation", () => {
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

  it("has no a11y violations", async () => {
    const { container } = renderTabs();
    expect(await axe(container)).toHaveNoViolations();
  });
});

describe("Tabs.List navigation boundary", () => {
  it("fires onNavigationBoundaryReached at the edges when loop is false", async () => {
    const user = userEvent.setup();
    const onNavigationBoundaryReached = vi.fn();
    render(
      <Tabs defaultValue="one" activationMode="manual">
        <Tabs.List loop={false} onNavigationBoundaryReached={onNavigationBoundaryReached}>
          <Tabs.Trigger value="one">One</Tabs.Trigger>
          <Tabs.Trigger value="two">Two</Tabs.Trigger>
        </Tabs.List>
        <Tabs.Content value="one">Content one</Tabs.Content>
        <Tabs.Content value="two">Content two</Tabs.Content>
      </Tabs>,
    );

    screen.getByRole("tab", { name: "One" }).focus();
    await user.keyboard("{ArrowLeft}");
    expect(onNavigationBoundaryReached).toHaveBeenCalledWith(
      "previous",
      expect.any(KeyboardEvent),
      "ArrowLeft",
    );
    expect(screen.getByRole("tab", { name: "One" })).toHaveFocus();

    await user.keyboard("{ArrowRight}");
    expect(screen.getByRole("tab", { name: "Two" })).toHaveFocus();
    await user.keyboard("{ArrowRight}");
    expect(onNavigationBoundaryReached).toHaveBeenCalledWith(
      "next",
      expect.any(KeyboardEvent),
      "ArrowRight",
    );
    expect(screen.getByRole("tab", { name: "Two" })).toHaveFocus();
    expect(onNavigationBoundaryReached).toHaveBeenCalledTimes(2);
  });

  it("wraps by default without firing onNavigationBoundaryReached", async () => {
    const user = userEvent.setup();
    const onNavigationBoundaryReached = vi.fn();
    render(
      <Tabs defaultValue="one" activationMode="manual">
        <Tabs.List onNavigationBoundaryReached={onNavigationBoundaryReached}>
          <Tabs.Trigger value="one">One</Tabs.Trigger>
          <Tabs.Trigger value="two">Two</Tabs.Trigger>
        </Tabs.List>
        <Tabs.Content value="one">Content one</Tabs.Content>
        <Tabs.Content value="two">Content two</Tabs.Content>
      </Tabs>,
    );

    screen.getByRole("tab", { name: "One" }).focus();
    await user.keyboard("{ArrowLeft}");
    expect(screen.getByRole("tab", { name: "Two" })).toHaveFocus();
    expect(onNavigationBoundaryReached).not.toHaveBeenCalled();
  });
});

describe("Tabs.List semantics", () => {
  it("protects tablist semantics and state attributes from native overrides", () => {
    const hostileProps = {
      role: "list",
      "aria-orientation": "vertical",
      "data-variant": "consumer-variant",
      "data-orientation": "consumer-orientation",
      "data-wrap": "consumer-wrap",
    };

    render(
      <Tabs defaultValue="one" orientation="horizontal" variant="pill">
        <Tabs.List {...hostileProps} wrap={false} aria-label="Owned tab list">
          <Tabs.Trigger value="one">One</Tabs.Trigger>
        </Tabs.List>
        <Tabs.Content value="one">Content one</Tabs.Content>
      </Tabs>,
    );

    const tablist = screen.getByRole("tablist", { name: "Owned tab list" });
    expect(tablist).toHaveAttribute("aria-orientation", "horizontal");
    expect(tablist).toHaveAttribute("data-variant", "pill");
    expect(tablist).toHaveAttribute("data-orientation", "horizontal");
    expect(tablist).toHaveAttribute("data-wrap", "false");
    expect(screen.queryByRole("list")).not.toBeInTheDocument();

    const ownershipNote = tabsDoc.notes?.find((note) => note.title === "Tab list semantics");
    expect(ownershipNote?.content).toContain("owns its tablist role");
  });
});

describe("Tabs.List keyboard navigation", () => {
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

describe("Tabs.List variants", () => {
  it("keeps variant metadata aligned with runtime values, default, and data attributes", () => {
    const documentedVariants = SEGMENTED_VARIANTS.map((variant) => JSON.stringify(variant)).join(
      " | ",
    );
    const variantProp = tabsDoc.props?.Tabs?.variant;
    const variantAttribute = tabsDoc.dataAttributes?.find(
      (entry) => entry.attribute === "data-variant",
    );

    expect(variantProp?.type).toBe(documentedVariants);
    expect(variantProp?.defaultValue).toBe('"underline"');
    expect(variantAttribute).toMatchObject({
      appliesTo: "Tabs.List / Tabs.Trigger",
      values: documentedVariants,
    });

    for (const variant of SEGMENTED_VARIANTS) {
      const rendered = renderTabs({ variant });
      expect(screen.getByRole("tablist")).toHaveAttribute("data-variant", variant);
      for (const trigger of screen.getAllByRole("tab")) {
        expect(trigger).toHaveAttribute("data-variant", variant);
      }
      rendered.unmount();
    }
  });

  it("defaults to variant='underline' and propagates it via data-variant on the tablist", () => {
    renderTabs();
    expect(screen.getByRole("tablist")).toHaveAttribute("data-variant", "underline");
    for (const trigger of screen.getAllByRole("tab")) {
      expect(trigger).toHaveAttribute("data-variant", "underline");
    }
  });

  it("uses wrapped row-local treatments for horizontal pill and underline variants", async () => {
    const user = userEvent.setup();
    const { container } = render(
      <Tabs defaultValue="a" variant="pill">
        <Tabs.List aria-label="Wrapped tabs">
          <Tabs.Trigger value="a">Alpha label with spaces</Tabs.Trigger>
          <Tabs.Trigger value="b">Beta label with spaces</Tabs.Trigger>
        </Tabs.List>
        <Tabs.Content value="a">Alpha content</Tabs.Content>
        <Tabs.Content value="b">Beta content</Tabs.Content>
      </Tabs>,
    );

    const tablist = screen.getByRole("tablist", { name: "Wrapped tabs" });
    const alpha = screen.getByRole("tab", { name: "Alpha label with spaces" });
    const beta = screen.getByRole("tab", { name: "Beta label with spaces" });
    expect(tablist).toHaveAttribute("data-wrap", "true");
    expect(alpha).toHaveAttribute("data-wrap", "true");
    expect(beta).toHaveAttribute("data-wrap", "true");
    expect(container.querySelector('[data-slot="tabs-pill"]')).toBeNull();

    alpha.focus();
    await user.keyboard("{ArrowRight}");
    expect(beta).toHaveFocus();
    expect(beta).toHaveAttribute("aria-selected", "true");
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
    // Both triggers carry the bracket spans (width stays steady); CSS reveals them
    // only on the active one.
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

describe("Tabs.List indicator", () => {
  it("renders a sliding pill indicator when wrapping is disabled", () => {
    const { container } = render(
      <Tabs defaultValue="b" variant="pill">
        <Tabs.List wrap={false}>
          <Tabs.Trigger value="a">Alpha</Tabs.Trigger>
          <Tabs.Trigger value="b">Beta</Tabs.Trigger>
        </Tabs.List>
        <Tabs.Content value="a">Alpha content</Tabs.Content>
        <Tabs.Content value="b">Beta content</Tabs.Content>
      </Tabs>,
    );
    expect(screen.getByRole("tablist")).toHaveAttribute("data-wrap", "false");
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
        <Tabs.List wrap={false}>
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

  it("renders a floating underline indicator when wrapping is disabled", () => {
    const { container } = render(
      <Tabs defaultValue="b" variant="underline">
        <Tabs.List wrap={false}>
          <Tabs.Trigger value="a">Alpha</Tabs.Trigger>
          <Tabs.Trigger value="b">Beta</Tabs.Trigger>
        </Tabs.List>
        <Tabs.Content value="a">Alpha content</Tabs.Content>
        <Tabs.Content value="b">Beta content</Tabs.Content>
      </Tabs>,
    );
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
});
