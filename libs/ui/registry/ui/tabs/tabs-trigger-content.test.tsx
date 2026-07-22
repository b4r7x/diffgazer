import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { axe } from "../../../testing/axe";
import { requireElement, requireValue } from "../../testing/assertions";
import { Tabs } from "./index";

describe("Tabs.Trigger / Tabs.Content ARIA ownership", () => {
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
    expect(panel).toHaveAttribute("data-value", value);
    expect(tab.id).toContain(encodeURIComponent(value));
    expect(tab).toHaveAttribute("aria-controls", panel.id);
    expect(panel).toHaveAttribute("aria-labelledby", tab.id);

    await user.click(screen.getByRole("tab", { name: "Other" }));
    expect(screen.getByRole("tab", { name: "Other" })).toHaveAttribute("aria-selected", "true");
  });

  it("protects generated panel ids and inactive visibility from native overrides", () => {
    render(
      <Tabs defaultValue="one">
        <Tabs.List>
          <Tabs.Trigger value="one">One</Tabs.Trigger>
          <Tabs.Trigger value="two">Two</Tabs.Trigger>
        </Tabs.List>
        <Tabs.Content value="one" id="consumer-panel-id">
          Content one
        </Tabs.Content>
        <Tabs.Content value="two" hidden={false}>
          Content two
        </Tabs.Content>
      </Tabs>,
    );

    const tab = screen.getByRole("tab", { name: "One" });
    const activePanel = screen.getByRole("tabpanel", { name: "One" });
    const inactivePanel = screen.getByText("Content two");

    expect(activePanel).not.toHaveAttribute("id", "consumer-panel-id");
    expect(tab).toHaveAttribute("aria-controls", activePanel.id);
    expect(inactivePanel).toHaveAttribute("hidden");
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

  it("merges an external aria-labelledby with the generated trigger id", () => {
    render(
      <Tabs defaultValue="one">
        <Tabs.List>
          <Tabs.Trigger value="one">One</Tabs.Trigger>
        </Tabs.List>
        <span id="panel-extra-label">Additional context</span>
        <Tabs.Content value="one" aria-labelledby="panel-extra-label">
          Content one
        </Tabs.Content>
      </Tabs>,
    );

    const tab = screen.getByRole("tab", { name: "One" });
    const panel = screen.getByRole("tabpanel");
    const labelledBy = panel.getAttribute("aria-labelledby")?.split(/\s+/) ?? [];

    expect(labelledBy).toContain(tab.id);
    expect(labelledBy).toContain("panel-extra-label");
  });

  it("has no a11y violations", async () => {
    const { container } = render(
      <Tabs defaultValue="one">
        <Tabs.List>
          <Tabs.Trigger value="one">One</Tabs.Trigger>
          <Tabs.Trigger value="two">Two</Tabs.Trigger>
        </Tabs.List>
        <Tabs.Content value="one">Content one</Tabs.Content>
        <Tabs.Content value="two">Content two</Tabs.Content>
      </Tabs>,
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});
