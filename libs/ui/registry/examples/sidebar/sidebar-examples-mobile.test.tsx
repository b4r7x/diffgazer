import { stubMatchMedia } from "@diffgazer/core/testing/match-media";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import SidebarAutoTone from "./sidebar-auto-tone";
import SidebarCollapsible from "./sidebar-collapsible";
import SidebarDefault from "./sidebar-default";
import SidebarMobileSheet from "./sidebar-mobile-sheet";
import SidebarRail from "./sidebar-rail";
import SidebarRenderProp from "./sidebar-render-prop";
import SidebarVariantBar from "./sidebar-variant-bar";
import SidebarVariantCaret from "./sidebar-variant-caret";
import SidebarVariantInverted from "./sidebar-variant-inverted";
import SidebarVariantTerminal from "./sidebar-variant-terminal";
import SidebarVariantTree from "./sidebar-variant-tree";
import SidebarVariants from "./sidebar-variants";

const examples = [
  ["sidebar-auto-tone", SidebarAutoTone],
  ["sidebar-collapsible", SidebarCollapsible],
  ["sidebar-default", SidebarDefault],
  ["sidebar-mobile-sheet", SidebarMobileSheet],
  ["sidebar-rail", SidebarRail],
  ["sidebar-render-prop", SidebarRenderProp],
  ["sidebar-variant-bar", SidebarVariantBar],
  ["sidebar-variant-caret", SidebarVariantCaret],
  ["sidebar-variant-inverted", SidebarVariantInverted],
  ["sidebar-variant-terminal", SidebarVariantTerminal],
  ["sidebar-variant-tree", SidebarVariantTree],
  ["sidebar-variants", SidebarVariants],
  // sidebar-owner-window is omitted: it portals its nav into an iframe
  // document, which jsdom never loads from srcdoc.
] as const;

describe("sidebar examples on mobile", () => {
  const originalMatchMedia = window.matchMedia;

  afterEach(() => {
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      writable: true,
      value: originalMatchMedia,
    });
  });

  // A non-embedded Sidebar takes the sheet branch on mobile and mounts closed,
  // so a docs demo that forgets `embedded` renders an empty frame: no nav, no
  // trigger, nothing to tap. Every example must show navigation at rest.
  it.each(examples)("%s renders visible navigation at rest", (_name, Example) => {
    stubMatchMedia(true);

    render(<Example />);

    expect(screen.getAllByRole("navigation").length).toBeGreaterThan(0);
  });

  // The mobile-sheet example renders an embedded pane next to a sheet pane, so
  // the at-rest check above is satisfied by the embedded one alone. Drive the
  // sheet pane's trigger so the sheet branch itself stays covered.
  it("opens the sheet pane of sidebar-mobile-sheet from its trigger", async () => {
    const user = userEvent.setup();
    stubMatchMedia(true);

    render(<SidebarMobileSheet />);

    await user.click(screen.getByRole("button", { name: "Open navigation" }));

    const dialog = screen.getByRole("dialog");
    expect(dialog).toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: "Primary navigation" })).toBeInTheDocument();
  });
});
