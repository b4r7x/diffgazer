import { MENU_ITEMS } from "@diffgazer/core/schemas/presentation";
import { KeyboardProvider } from "@diffgazer/keys";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { HomeMenu } from "./menu";

function Wrapper({ children }: { children: ReactNode }) {
  return <KeyboardProvider>{children}</KeyboardProvider>;
}

function renderHomeMenu(props: Partial<React.ComponentProps<typeof HomeMenu>> = {}) {
  const onSelect = vi.fn();
  const onHighlightChange = vi.fn();
  render(
    <HomeMenu
      highlighted={null}
      onHighlightChange={onHighlightChange}
      onSelect={onSelect}
      items={MENU_ITEMS}
      isTrusted
      hasResumableSession={false}
      {...props}
    />,
    { wrapper: Wrapper },
  );
  return { onSelect, onHighlightChange };
}

describe("HomeMenu — Resume Last Review gating", () => {
  it("marks Resume Last Review aria-disabled when no resumable session", () => {
    renderHomeMenu({ hasResumableSession: false });
    const item = screen.getByRole("menuitem", { name: "Resume Last Review" });
    expect(item).toHaveAttribute("aria-disabled", "true");
  });

  it("does not mark Resume Last Review aria-disabled when a resumable session exists", () => {
    renderHomeMenu({ hasResumableSession: true });
    const item = screen.getByRole("menuitem", { name: "Resume Last Review" });
    expect(item).not.toHaveAttribute("aria-disabled");
  });

  it("does not call onSelect when a disabled Resume Last Review item is clicked", async () => {
    const user = userEvent.setup();
    const { onSelect } = renderHomeMenu({ hasResumableSession: false });
    await user.click(screen.getByRole("menuitem", { name: "Resume Last Review" }));
    expect(onSelect).not.toHaveBeenCalled();
  });

  it("calls onSelect with 'resume-review' when the item is enabled and clicked", async () => {
    const user = userEvent.setup();
    const { onSelect } = renderHomeMenu({ hasResumableSession: true });
    await user.click(screen.getByRole("menuitem", { name: "Resume Last Review" }));
    expect(onSelect).toHaveBeenCalledWith("resume-review");
  });

  it("does not call onSelect when Enter is pressed on a disabled Resume Last Review item", async () => {
    const user = userEvent.setup();
    const { onSelect } = renderHomeMenu({
      hasResumableSession: false,
      highlighted: "resume-review",
    });
    const menu = screen.getByRole("menu");
    menu.focus();
    await user.keyboard("{Enter}");
    expect(onSelect).not.toHaveBeenCalled();
  });

  it("names the persistent menu via its visible Main Menu title", () => {
    renderHomeMenu();
    expect(screen.getByRole("menu", { name: /main menu/i })).toBeInTheDocument();
  });

  it("advertises each item's jump key without folding it into the accessible name", () => {
    renderHomeMenu();
    for (const { label, shortcut } of MENU_ITEMS) {
      if (shortcut === undefined) continue;
      expect(screen.getByRole("menuitem", { name: label })).toHaveTextContent(`[${shortcut}]`);
    }
  });

  it("keeps the menu usable and announces the pending start while a review is starting", () => {
    renderHomeMenu({ pendingAction: "review-unstaged", hasResumableSession: true });
    expect(screen.getByRole("status")).toHaveTextContent(/starting review/i);
    for (const { label } of MENU_ITEMS) {
      expect(screen.getByRole("menuitem", { name: label })).not.toHaveAttribute("aria-disabled");
    }
  });

  it("still blocks the intrinsically unavailable rows while a review is starting", () => {
    renderHomeMenu({ pendingAction: "review-unstaged", hasResumableSession: false });
    expect(screen.getByRole("menuitem", { name: "Resume Last Review" })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
  });

  it("lets the user leave home while a review is starting", async () => {
    const user = userEvent.setup();
    const { onSelect } = renderHomeMenu({ pendingAction: "review-unstaged" });
    await user.click(screen.getByRole("menuitem", { name: "History" }));
    expect(onSelect).toHaveBeenCalledWith("history");
  });

  it("marks only the started row as running and keeps its accessible name", () => {
    renderHomeMenu({ pendingAction: "review-unstaged" });

    // The started row swaps its accelerator for the run state; its name is
    // unchanged, so the control the user activated is still the same control.
    const started = screen.getByRole("menuitem", { name: "Review Unstaged" });
    expect(started).toHaveTextContent(/starting/i);
    expect(started).not.toHaveTextContent("[r]");
    // Working, not merely blocked — the rest of the menu is only held.
    expect(started).toHaveAttribute("aria-busy", "true");

    // Every other row keeps advertising its key and carries no run state.
    const untouched = screen.getByRole("menuitem", { name: "Review Staged" });
    expect(untouched).toHaveTextContent("[R]");
    expect(untouched).not.toHaveTextContent(/starting/i);
    expect(untouched).not.toHaveAttribute("aria-busy");
  });

  it("leaves the menu unchanged when nothing is starting", () => {
    renderHomeMenu();
    // The region stays mounted and silent: one inserted in the same commit as
    // its text is skipped by some screen reader/browser pairs, and it is the
    // only channel that announces the start.
    expect(screen.getByRole("status")).toHaveTextContent("");
    expect(screen.getByRole("menuitem", { name: "Review Unstaged" })).toHaveTextContent("[r]");
    expect(screen.getByRole("menuitem", { name: "Review Unstaged" })).not.toHaveAttribute(
      "aria-busy",
    );
  });

  it("disables all review actions when the directory is untrusted regardless of resumable session", () => {
    renderHomeMenu({ isTrusted: false, hasResumableSession: true });
    expect(screen.getByRole("menuitem", { name: "Resume Last Review" })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
    expect(screen.getByRole("menuitem", { name: "Review Unstaged" })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
    expect(screen.getByRole("menuitem", { name: "Review Staged" })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
  });
});

describe("HomeMenu — focus chrome", () => {
  it("brackets the pane only while focus sits inside it", async () => {
    const user = userEvent.setup();
    render(
      <>
        <HomeMenu
          highlighted={null}
          onHighlightChange={vi.fn()}
          onSelect={vi.fn()}
          items={MENU_ITEMS}
          isTrusted
        />
        <button type="button">Outside</button>
      </>,
      { wrapper: Wrapper },
    );

    // data-state="focused" is Panel's bracket contract. The menu autofocuses a
    // frame after mount, so the brackets arrive with real focus, not at mount.
    const pane = screen.getByRole("region", { name: /main menu/i });
    await waitFor(() => expect(pane).toHaveAttribute("data-state", "focused"));

    await user.click(screen.getByRole("button", { name: "Outside" }));

    expect(screen.getByRole("button", { name: "Outside" })).toHaveFocus();
    expect(pane).not.toHaveAttribute("data-state");
  });
});
