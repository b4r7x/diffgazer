import type { ProviderListRow } from "@diffgazer/core/providers";
import { getProviderActionLayout, getProviderRowControls } from "@diffgazer/core/providers";
import {
  buildProviderRows,
  configurationStatus,
  ZAI_CONFIGURATION,
} from "@diffgazer/core/testing/provider-fixtures";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { type ComponentProps, useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { ProviderOverflowMenu } from "./overflow-menu";

function findRow(configurationId: string, rows = buildProviderRows()): ProviderListRow {
  const row = rows.find(
    (candidate) => candidate.configuration?.configurationId === configurationId,
  );
  if (!row) throw new Error(`Missing fixture row: ${configurationId}`);
  return row;
}

const GEMINI_ROW = findRow("gemini-primary");
const NO_MODEL_ROW = findRow(
  "zai-primary",
  buildProviderRows([configurationStatus(ZAI_CONFIGURATION, "model-missing")]),
);

type HarnessProps = Pick<
  ComponentProps<typeof ProviderOverflowMenu>,
  "onAction" | "highlighted"
> & {
  row: ProviderListRow;
};

/** Owns the menu the way the page does, so it can open and close for real. */
function Harness({ row, ...props }: HarnessProps) {
  const [open, setOpen] = useState(false);
  const layout = getProviderActionLayout(row, null);
  const control = getProviderRowControls(layout).find(({ id }) => id === "more");
  if (!control) throw new Error("Expected a More control");
  return (
    <ProviderOverflowMenu
      {...props}
      layout={layout}
      control={control}
      overflowMenu={{ open, onOpenChange: setOpen }}
    />
  );
}

function renderMenu(row: ProviderListRow, props: Partial<HarnessProps> = {}) {
  const onAction = vi.fn();
  render(<Harness row={row} onAction={onAction} {...props} />);
  return { onAction, trigger: screen.getByRole("button", { name: "More actions" }) };
}

async function openMenu(user: ReturnType<typeof userEvent.setup>, trigger: HTMLElement) {
  await user.click(trigger);
  const menu = await screen.findByRole("menu", { name: "More actions" });
  await waitFor(() => expect(menu).toHaveFocus());
  return menu;
}

describe("ProviderOverflowMenu", () => {
  it("opens with the destructive entry last and routes a pick through the handler", async () => {
    const user = userEvent.setup();
    const { onAction, trigger } = renderMenu(GEMINI_ROW);
    expect(trigger).toHaveAttribute("aria-haspopup", "menu");
    expect(trigger).toHaveAttribute("aria-expanded", "false");

    const menu = await openMenu(user, trigger);
    expect(trigger).toHaveAttribute("aria-expanded", "true");
    const items = within(menu).getAllByRole("menuitem");
    expect(items).toHaveLength(3);
    expect(items[0]).toHaveAccessibleName("Update configuration");
    expect(items[1]).toHaveAccessibleName("Verify");
    expect(items[2]).toHaveAccessibleName("Delete configuration");
    // The accelerator is taught in the row but kept out of the accessible name.
    expect(items[0]).toHaveTextContent("[e]");
    const separator = within(menu).getByRole("separator");
    expect(items[2]?.compareDocumentPosition(separator)).toBe(Node.DOCUMENT_POSITION_PRECEDING);

    await user.click(within(menu).getByRole("menuitem", { name: /Verify/ }));

    expect(onAction).toHaveBeenCalledWith(expect.objectContaining({ id: "verify" }));
    await waitFor(() =>
      expect(screen.queryByRole("menu", { name: "More actions" })).not.toBeInTheDocument(),
    );
  });

  it("keeps an entry the state cannot run in the menu, disabled, with its reason", async () => {
    const user = userEvent.setup();
    const { onAction, trigger } = renderMenu(NO_MODEL_ROW);

    await openMenu(user, trigger);

    const verify = screen.getByRole("menuitem", { name: /Verify/ });
    expect(verify).toHaveAttribute("aria-disabled", "true");
    expect(verify).toHaveTextContent("Select model first");
    await user.click(verify);
    expect(onAction).not.toHaveBeenCalled();
  });

  it("runs a menu entry from the key it advertises", async () => {
    const user = userEvent.setup();
    const { onAction, trigger } = renderMenu(GEMINI_ROW);

    await openMenu(user, trigger);
    await user.keyboard("v");

    expect(onAction).toHaveBeenCalledWith(expect.objectContaining({ id: "verify" }));
    await waitFor(() => expect(screen.queryByRole("menu")).not.toBeInTheDocument());
  });

  it("leaves a disabled entry's key to typeahead instead of running it", async () => {
    const user = userEvent.setup();
    const { onAction, trigger } = renderMenu(NO_MODEL_ROW);

    const menu = await openMenu(user, trigger);
    await user.keyboard("v");

    expect(onAction).not.toHaveBeenCalled();
    expect(menu).toBeInTheDocument();
  });

  it("returns focus to the trigger when the menu closes on Escape", async () => {
    const user = userEvent.setup();
    const { trigger } = renderMenu(GEMINI_ROW);

    await openMenu(user, trigger);
    await user.keyboard("{Escape}");

    await waitFor(() => expect(screen.queryByRole("menu")).not.toBeInTheDocument());
    expect(trigger).toHaveFocus();
  });

  it("drops the row's highlight ring while the menu owns focus and restores it on close", async () => {
    const user = userEvent.setup();
    const { trigger } = renderMenu(GEMINI_ROW, { highlighted: true });
    expect(trigger).toHaveAttribute("data-highlighted");

    await openMenu(user, trigger);
    expect(trigger).not.toHaveAttribute("data-highlighted");

    await user.keyboard("{Escape}");

    await waitFor(() => expect(screen.queryByRole("menu")).not.toBeInTheDocument());
    expect(trigger).toHaveAttribute("data-highlighted");
    expect(trigger).toHaveFocus();
  });

  it("keeps ArrowLeft and ArrowRight inside the open menu, as a toolbar's menu button does", async () => {
    const user = userEvent.setup();
    const { trigger } = renderMenu(GEMINI_ROW);

    const menu = await openMenu(user, trigger);
    await user.keyboard("{ArrowDown}");
    const highlightedId = menu.getAttribute("aria-activedescendant");
    expect(highlightedId).toBeTruthy();

    await user.keyboard("{ArrowLeft}");
    expect(menu).toHaveFocus();
    expect(menu).toHaveAttribute("aria-activedescendant", highlightedId);
    await user.keyboard("{ArrowRight}");
    expect(menu).toHaveFocus();
    expect(menu).toHaveAttribute("aria-activedescendant", highlightedId);
    expect(trigger).toHaveAttribute("aria-expanded", "true");
  });

  it("closes on Tab and hands focus back to the trigger before the tab sequence moves on", async () => {
    const user = userEvent.setup();
    const { trigger } = renderMenu(GEMINI_ROW);

    const menu = await openMenu(user, trigger);
    // fireEvent retained: direct keydown asserts synchronous focus handoff before browser Tab movement.
    fireEvent.keyDown(menu, { key: "Tab" });

    await waitFor(() => expect(screen.queryByRole("menu")).not.toBeInTheDocument());
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(trigger).toHaveFocus();
  });
});
