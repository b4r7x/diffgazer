import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { axe } from "../../../testing/axe";
import { ruleBody } from "../../testing/css-contract";
import { Dialog } from "../dialog";
import { Menu } from "../menu";
import { Popover } from "../popover";
import { Select } from "../select";
import { Tooltip } from "../tooltip";
import { OVERLAY_SURFACE, OVERLAY_SURFACE_MODAL } from "./overlay-surface";

/**
 * The class recipe IS the contract here: one elevation grammar for the whole
 * overlay family. These assertions pin that every overlay slot resolves the same
 * fill/hairline/lip custom properties rather than re-spelling its own.
 */

const THEME_CSS = readFileSync(
  resolve(fileURLToPath(import.meta.url), "../../../../styles/theme.css"),
  "utf8",
);

function themeBlock(selector: string): string {
  const block = ruleBody(THEME_CSS, selector);
  if (block === null) throw new Error(`Missing or unbalanced theme.css block for ${selector}`);
  return block;
}

function shadowHard(block: string): string {
  const value = block.match(/^\s*--shadow-hard:\s*([^;]+);/m)?.[1];
  if (value === undefined) throw new Error("Missing --shadow-hard declaration");
  return value.trim();
}

describe("overlay elevation tokens", () => {
  const dark = themeBlock(':root, [data-theme="dark"]');
  const light = themeBlock('[data-theme="light"]');

  it("mixes --shadow-hard from the foreground in both themes so it is visible on either page", () => {
    // A near-black offset over a near-black page composites to ~1.05:1 and
    // disappears; mixing from --base-fg keeps the offset readable in dark.
    for (const value of [shadowHard(dark), shadowHard(light)]) {
      expect(value).toContain("var(--base-fg)");
      expect(value).not.toContain("rgb(0 0 0");
    }
  });

  it("uses the same offset and mix ratio in both themes", () => {
    expect(shadowHard(dark)).toBe(shadowHard(light));
  });

  it("keeps a distinct --surface-1 step off the page background in both themes", () => {
    for (const block of [dark, light]) {
      const surface = block.match(/^\s*--surface-1:\s*([^;]+);/m)?.[1]?.trim();
      const background = block.match(/^\s*--base-bg:\s*([^;]+);/m)?.[1]?.trim();
      expect(surface).toBeDefined();
      expect(surface).not.toBe(background);
    }
  });
});

describe("overlay surface tiers", () => {
  it("anchored and modal tiers share one fill and one inner lip", () => {
    for (const recipe of [OVERLAY_SURFACE, OVERLAY_SURFACE_MODAL]) {
      expect(recipe).toContain("bg-[color:var(--surface-1)]");
      expect(recipe).toContain("inset_0_1px_0_var(--surface-1-highlight)");
    }
  });

  it("reserves the hard offset shadow for the modal tier", () => {
    expect(OVERLAY_SURFACE_MODAL).toContain("var(--shadow-hard)");
    expect(OVERLAY_SURFACE).not.toContain("var(--shadow-hard)");
  });

  it("gives Popover the anchored tier", async () => {
    const user = userEvent.setup();
    render(
      <Popover>
        <Popover.Trigger>Open</Popover.Trigger>
        <Popover.Content role="dialog" aria-label="Details">
          Body
        </Popover.Content>
      </Popover>,
    );
    await user.click(screen.getByRole("button", { name: "Open" }));

    expect(screen.getByRole("dialog", { name: "Details" })).toHaveClass(
      ...OVERLAY_SURFACE.split(" "),
    );
  });

  it("gives Tooltip the anchored tier through Popover", async () => {
    const user = userEvent.setup();
    render(
      <Tooltip>
        <Tooltip.Trigger>
          <button type="button">Hint</button>
        </Tooltip.Trigger>
        <Tooltip.Content>Explanation</Tooltip.Content>
      </Tooltip>,
    );
    await user.hover(screen.getByRole("button", { name: "Hint" }));

    expect(await screen.findByRole("tooltip")).toHaveClass(...OVERLAY_SURFACE.split(" "));
  });

  it("gives Select content the anchored tier", async () => {
    const user = userEvent.setup();
    render(
      <Select aria-label="Fruit" defaultValue="apple">
        <Select.Trigger>Fruit</Select.Trigger>
        <Select.Content>
          <Select.Item value="apple">Apple</Select.Item>
          <Select.Item value="pear">Pear</Select.Item>
        </Select.Content>
      </Select>,
    );
    await user.click(screen.getByRole("combobox"));

    expect(screen.getByRole("listbox")).toHaveClass(...OVERLAY_SURFACE.split(" "));
  });

  it("gives Menu submenu content the anchored tier", async () => {
    const user = userEvent.setup();
    render(
      <Menu aria-label="Actions" defaultHighlighted="edit">
        <Menu.Sub>
          <Menu.SubTrigger id="edit">Edit</Menu.SubTrigger>
          <Menu.SubContent>
            <Menu.Item id="undo">Undo</Menu.Item>
          </Menu.SubContent>
        </Menu.Sub>
      </Menu>,
    );
    await user.click(screen.getByRole("menuitem", { name: "Edit" }));

    const panel = screen.getByRole("menu", { name: "Edit" }).parentElement;
    expect(panel).toHaveClass(...OVERLAY_SURFACE.split(" "));
  });

  it("gives Dialog the modal tier", () => {
    render(
      <Dialog open>
        <Dialog.Content>
          <Dialog.Title>Settings</Dialog.Title>
        </Dialog.Content>
      </Dialog>,
    );

    expect(screen.getByRole("dialog", { name: "Settings" })).toHaveClass(
      ...OVERLAY_SURFACE_MODAL.split(" "),
    );
  });

  it("has no a11y violations on a modal-tier surface", async () => {
    const { container } = render(
      <Dialog open>
        <Dialog.Content>
          <Dialog.Title>Settings</Dialog.Title>
        </Dialog.Content>
      </Dialog>,
    );

    expect(await axe(container)).toHaveNoViolations();
  });
});
