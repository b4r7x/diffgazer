import { MENU_ITEMS } from "@diffgazer/core/schemas/presentation";
import { KeyboardProvider } from "@diffgazer/keys";
import { render, screen } from "@testing-library/react";
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
